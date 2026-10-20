import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * There's no mapping yet from "which forecast GeoTIFF frame is currently
 * selected in the Camadas de Previsão drawer" to "which bathymetry
 * snapshot in bathymetry_points to query" -- the forecast drawer's active
 * frame isn't even threaded through to this route today (see
 * ForecastOverlayConfig in ForecastDrawer.tsx, which carries a tile URL
 * and bounds, not a date). Until that matching exists, every query is
 * temporarily pinned to the one reference_date currently loaded by
 * scripts/load_bathymetry_parquet.py. Remove this once a real frame→date
 * match is wired up, and pass the frame's own date through as a query
 * param instead of hardcoding it here.
 */
const TEMP_FORCED_REFERENCE_DATE = '2022-10-01T00:00:00Z';

/** See scripts/load_bathymetry_parquet.py's own copy of this constant --
 *  half the source grid's 100m cell spacing, plus slack. Keep both in sync. */
const MAX_MATCH_DISTANCE_M = 150;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lngParam = searchParams.get('lng');
  const latParam = searchParams.get('lat');
  // Number(null) is 0, not NaN -- check for the missing-param case
  // explicitly instead of letting that coercion quirk silently treat a
  // missing param as "0,0" and (only incidentally) fail the distance check.
  const lng = lngParam === null ? NaN : Number(lngParam);
  const lat = latParam === null ? NaN : Number(latParam);

  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return NextResponse.json(
      { error: 'lng and lat query params are required and must be numbers.' },
      { status: 400 },
    );
  }

  try {
    const result = await pool.query(
      `SELECT
         depth_m,
         wse_m,
         reference_date,
         ST_Distance(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_m
       FROM bathymetry_points
       WHERE reference_date = $3
       ORDER BY geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
       LIMIT 1`,
      [lng, lat, TEMP_FORCED_REFERENCE_DATE],
    );

    const row = result.rows[0];
    if (!row || row.distance_m > MAX_MATCH_DISTANCE_M) {
      return NextResponse.json({ data: null });
    }

    return NextResponse.json({
      data: {
        depthM: row.depth_m,
        wseM: row.wse_m,
        referenceDate: row.reference_date,
        distanceM: row.distance_m,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Could not query bathymetry data.',
      },
      { status: 500 },
    );
  }
}
