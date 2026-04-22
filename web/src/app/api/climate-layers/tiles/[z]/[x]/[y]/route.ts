import { NextRequest, NextResponse } from 'next/server';
import { getStrapiAccessToken } from '@/lib/strapi-server';

const TITILER_INTERNAL_URL =
  process.env.TITILER_INTERNAL_URL ?? 'http://titiler:8080';
const STRAPI_INTERNAL_URL =
  process.env.STRAPI_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_STRAPI_URL ??
  'http://strapi:1337';

function toSourceUrl(source: string) {
  if (source.startsWith('http://') || source.startsWith('https://')) {
    return source;
  }

  if (source.startsWith('/')) {
    return `${STRAPI_INTERNAL_URL}${source}`;
  }

  return `${STRAPI_INTERNAL_URL}/${source}`;
}

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{
      z: string;
      x: string;
      y: string;
    }>;
  },
) {
  const accessToken = await getStrapiAccessToken(request);

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 },
    );
  }

  const { z, x, y } = await context.params;
  const tileY = y.replace(/\.png$/i, '');
  const source = request.nextUrl.searchParams.get('source');

  if (!source) {
    return NextResponse.json(
      { error: 'Climate layer source is required.' },
      { status: 400 },
    );
  }

  const upstreamUrl = new URL(
    `${TITILER_INTERNAL_URL}/cog/tiles/WebMercatorQuad/${z}/${x}/${tileY}.png`,
  );
  upstreamUrl.searchParams.set('url', toSourceUrl(source));

  const colormap = request.nextUrl.searchParams.get('colormap');
  const min = request.nextUrl.searchParams.get('min');
  const max = request.nextUrl.searchParams.get('max');

  if (colormap) {
    upstreamUrl.searchParams.set('colormap_name', colormap);
  }

  if (min && max) {
    upstreamUrl.searchParams.set('rescale', `${min},${max}`);
  }

  const response = await fetch(upstreamUrl, {
    headers: {
      Accept: request.headers.get('accept') ?? 'image/png',
    },
    cache: 'no-store',
  });

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
      'Cache-Control': 'no-store',
    },
  });
}