import { NextResponse } from 'next/server';
import { listForecastTileGroups } from '@/lib/forecast-tiles';

const TITILER_INTERNAL_URL =
  process.env.TITILER_INTERNAL_URL ?? 'http://titiler:8080';

/**
 * List grouped forecast GeoTIFF frames and expose internal tile URL templates
 * for the public map forecast drawer.
 */
export async function GET() {
  try {
    const groups = await listForecastTileGroups();

    return NextResponse.json({
      data: groups.map((group) => ({
        ...group,
        frames: group.frames.map((frame) => ({
          ...frame,
          tileUrl: `/api/forecast-tiles/${encodeURIComponent(frame.slug)}/{z}/{x}/{y}.png`,
          metadataUrl: `/api/forecast-tiles/${encodeURIComponent(frame.slug)}/metadata`,
          sourceUrl: `${TITILER_INTERNAL_URL}/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.png?url=${encodeURIComponent(`/data/geotiffs/${frame.fileName}`)}`,
        })),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Could not read forecast tile directory.',
      },
      { status: 500 },
    );
  }
}