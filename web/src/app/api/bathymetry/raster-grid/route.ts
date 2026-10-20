import { NextResponse } from 'next/server';
import { fromArrayBuffer } from 'geotiff';
import { resolveForecastTileSource } from '@/lib/forecast-tiles';

const TITILER_INTERNAL_URL = process.env.TITILER_INTERNAL_URL ?? 'http://titiler:8080';

/** Clamped so a careless query can't ask TiTiler/this route to generate (and
 *  this route to decode) an unreasonably large grid. 128x128 is already far
 *  more resolution than the riverFlythroughTerrain prototype's single static
 *  chunk needs. */
const MAX_GRID_SIZE = 128;

/**
 * Crops a small, regular-grid window out of a bathymetry GeoTIFF and returns
 * its raw depth values as JSON -- the data source for
 * `riverFlythroughTerrain.ts`'s Three.js wireframe, which needs actual
 * sampled depth values on a grid, not a rendered PNG tile (what every other
 * forecast-tiles route returns).
 *
 * Proxies TiTiler's `/cog/bbox/.../{w}x{h}.tif` (a small cropped GeoTIFF, not
 * a full re-render) and decodes it server-side with the `geotiff` package --
 * chosen over asking TiTiler for `.npy` because decoding an actual GeoTIFF
 * (bands + nodata mask) is a well-trodden, actively maintained path, over
 * hand-rolling a `.npy` header parser for a one-off feature.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');
  const bbox = searchParams.get('bbox');
  const size = Math.min(Number(searchParams.get('size')) || 64, MAX_GRID_SIZE);

  if (!slug || !bbox) {
    return NextResponse.json({ error: 'slug and bbox query params are required.' }, { status: 400 });
  }

  const bboxParts = bbox.split(',').map(Number);
  if (bboxParts.length !== 4 || bboxParts.some((n) => !Number.isFinite(n))) {
    return NextResponse.json({ error: 'bbox must be "minx,miny,maxx,maxy".' }, { status: 400 });
  }
  const [minx, miny, maxx, maxy] = bboxParts;

  const tileSource = await resolveForecastTileSource(slug);
  if (!tileSource) {
    return NextResponse.json({ error: 'Bathymetry GeoTIFF not found.' }, { status: 404 });
  }

  try {
    const upstreamUrl = new URL(
      `${TITILER_INTERNAL_URL}/cog/bbox/${minx},${miny},${maxx},${maxy}/${size}x${size}.tif`,
    );
    upstreamUrl.searchParams.set('url', `/data/geotiffs/${tileSource.fileName}`);

    const response = await fetch(upstreamUrl, { cache: 'no-store' });
    if (!response.ok) {
      return NextResponse.json(
        { error: `TiTiler bbox request failed with status ${response.status}.` },
        { status: 502 },
      );
    }

    const buffer = await response.arrayBuffer();
    const tiff = await fromArrayBuffer(buffer);
    const image = await tiff.getImage();
    const rasters = await image.readRasters();

    const width = image.getWidth();
    const height = image.getHeight();
    // Band 1 is the depth value; band 2 (when present -- TiTiler adds it
    // whenever a crop can include nodata) is a 0/255 validity mask.
    const depthBand = rasters[0] as Float32Array | Uint16Array | Int16Array;
    const maskBand = rasters.length > 1 ? (rasters[1] as Uint8Array) : null;

    const values: (number | null)[] = new Array(depthBand.length);
    for (let i = 0; i < depthBand.length; i++) {
      const isValid = maskBand ? maskBand[i] !== 0 : Number.isFinite(depthBand[i]);
      values[i] = isValid ? depthBand[i] : null;
    }

    return NextResponse.json({
      data: {
        width,
        height,
        bounds: [minx, miny, maxx, maxy],
        values,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not read bathymetry raster grid.' },
      { status: 500 },
    );
  }
}
