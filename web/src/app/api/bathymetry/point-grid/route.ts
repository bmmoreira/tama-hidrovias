import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/** Same temporary pin as /api/bathymetry/depth -- only one snapshot is
 *  loaded today, see scripts/load_bathymetry_parquet.py. */
const DEFAULT_REFERENCE_DATE = '2022-10-01T00:00:00Z';

/**
 * Builds a regular depth grid for the Madeira river flythrough's 3D
 * wireframe directly from `bathymetry_points` (real PostGIS data), as
 * opposed to /api/bathymetry/raster-grid's TiTiler-crop-and-decode path for
 * Tapajós (which only has a bathymetry GeoTIFF, not a loaded point table).
 *
 * This is the cheaper of the two approaches where it's available: one
 * indexed bbox query (`geom &&`, using the same GiST index
 * /api/bathymetry/depth's nearest-neighbor lookup relies on) instead of a
 * TiTiler round trip plus a server-side GeoTIFF decode. It also returns
 * real measured values straight from the source data, not values resampled
 * through a raster reprojection.
 *
 * Unlike the raster-grid route, the "grid" here isn't resampled to a
 * requested size -- it's reconstructed directly from the data's own
 * cell_row/cell_col indices (preserved from the original 100m hydraulic
 * model grid by scripts/load_bathymetry_parquet.py), so points are only
 * returned where they actually exist. A bbox straddling the river bank
 * will have real gaps (no cell on dry land) -- same nodata-as-null
 * handling the Three.js wireframe builder already does for Tapajós covers
 * this without any special-casing.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bbox = searchParams.get('bbox');
  const referenceDate = searchParams.get('date') ?? DEFAULT_REFERENCE_DATE;

  if (!bbox) {
    return NextResponse.json({ error: 'bbox query param is required.' }, { status: 400 });
  }

  const bboxParts = bbox.split(',').map(Number);
  if (bboxParts.length !== 4 || bboxParts.some((n) => !Number.isFinite(n))) {
    return NextResponse.json({ error: 'bbox must be "minx,miny,maxx,maxy".' }, { status: 400 });
  }
  const [minx, miny, maxx, maxy] = bboxParts;

  try {
    const result = await pool.query(
      `SELECT cell_row, cell_col, depth_m,
              ST_X(geom::geometry) AS lng, ST_Y(geom::geometry) AS lat
       FROM bathymetry_points
       WHERE reference_date = $1
         AND geom && ST_MakeEnvelope($2, $3, $4, $5, 4326)::geography`,
      [referenceDate, minx, miny, maxx, maxy],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ data: null });
    }

    const rows = result.rows as { cell_row: number; cell_col: number; depth_m: number; lng: number; lat: number }[];

    const minRow = Math.min(...rows.map((r) => r.cell_row));
    const maxRow = Math.max(...rows.map((r) => r.cell_row));
    const minCol = Math.min(...rows.map((r) => r.cell_col));
    const maxCol = Math.max(...rows.map((r) => r.cell_col));

    const width = maxCol - minCol + 1;
    const height = maxRow - minRow + 1;
    const values: (number | null)[] = new Array(width * height).fill(null);
    // Real per-point lng/lat, not re-derived from an evenly-spaced
    // interpolation across bounds -- the source grid is regular in the
    // *original UTM projection's* meters (cell_row/cell_col), not in lng/lat
    // degrees. Over a long, winding river this can drift a real amount
    // (UTM grid north vs. true north, convergence angle), so positions are
    // carried through as-sampled rather than assumed to line up with a
    // simple rectangular lng/lat grid the way a TiTiler-resampled raster
    // crop (see /api/bathymetry/raster-grid) genuinely does.
    const lngLats: ([number, number] | null)[] = new Array(width * height).fill(null);

    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    for (const row of rows) {
      const gridRow = row.cell_row - minRow;
      const gridCol = row.cell_col - minCol;
      const index = gridRow * width + gridCol;
      values[index] = row.depth_m;
      lngLats[index] = [row.lng, row.lat];
      minLng = Math.min(minLng, row.lng);
      maxLng = Math.max(maxLng, row.lng);
      minLat = Math.min(minLat, row.lat);
      maxLat = Math.max(maxLat, row.lat);
    }

    return NextResponse.json({
      data: {
        width,
        height,
        bounds: [minLng, minLat, maxLng, maxLat],
        values,
        lngLats,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not query bathymetry point grid.' },
      { status: 500 },
    );
  }
}
