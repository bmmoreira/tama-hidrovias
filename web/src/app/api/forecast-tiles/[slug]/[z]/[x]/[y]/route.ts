import { NextRequest, NextResponse } from 'next/server';
import { resolveForecastTileSource } from '@/lib/forecast-tiles';

const TITILER_INTERNAL_URL =
  process.env.TITILER_INTERNAL_URL ?? 'http://titiler:8080';
const TILE_CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=86400';
// Mapbox expects a decodable image response even for out-of-bounds tiles.
const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==',
  'base64',
);

/**
 * Proxy raster tile requests from the public map through Next.js so the
 * frontend can stay on internal API routes while TiTiler handles GeoTIFF
 * rendering. Missing tiles are translated to a transparent PNG to avoid image
 * decode failures in the browser.
 */
export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{
      slug: string;
      z: string;
      x: string;
      y: string;
    }>;
  },
) {
  const { slug, z, x, y } = await context.params;
  const tileY = y.replace(/\.png$/i, '');
  const tileSource = await resolveForecastTileSource(slug);

  if (!tileSource) {
    return NextResponse.json(
      { error: 'Forecast GeoTIFF not found.' },
      { status: 404 },
    );
  }

  const upstreamUrl = new URL(
    `${TITILER_INTERNAL_URL}/cog/tiles/WebMercatorQuad/${z}/${x}/${tileY}.png`,
  );
  upstreamUrl.searchParams.set('url', `/data/geotiffs/${tileSource.fileName}`);

  const colormap = request.nextUrl.searchParams.get('colormap');
  const min = request.nextUrl.searchParams.get('min');
  const max = request.nextUrl.searchParams.get('max');

  if (colormap) {
    upstreamUrl.searchParams.set('colormap_name', colormap);
  }

  if (min && max) {
    upstreamUrl.searchParams.set('rescale', `${min},${max}`);
  }

  const response = await fetch(
    upstreamUrl,
    {
      headers: {
        Accept: request.headers.get('accept') ?? 'image/png',
      },
      cache: 'no-store',
    },
  );

  if (response.status === 404) {
    return new NextResponse(TRANSPARENT_PNG, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': String(TRANSPARENT_PNG.byteLength),
        'Cache-Control': TILE_CACHE_CONTROL,
      },
    });
  }

  if (!response.ok) {
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') ?? 'text/plain',
      },
    });
  }

  return new NextResponse(response.body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('content-type') ?? 'image/png',
      'Cache-Control': TILE_CACHE_CONTROL,
    },
  });
}