import { getToken } from 'next-auth/jwt';
import { NextResponse, type NextRequest } from 'next/server';

const STRAPI_INTERNAL_URL =
  process.env.STRAPI_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_STRAPI_URL ??
  'http://localhost:1337';

function buildStrapiUrl(pathname: string, search: string = '') {
  return `${STRAPI_INTERNAL_URL}${pathname}${search}`;
}

async function getSessionToken(request: NextRequest) {
  return getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
}

export async function getStrapiAccessToken(request: NextRequest) {
  const token = await getSessionToken(request);

  return typeof token?.strapiJwt === 'string' ? token.strapiJwt : null;
}

export async function getSessionRole(request: NextRequest) {
  const token = await getSessionToken(request);

  return typeof token?.role === 'string' ? token.role : null;
}

export async function proxyStrapiRequest(
  request: NextRequest,
  pathname: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    requireAuth?: boolean;
    body?: string;
  } = {},
) {
  const accessToken = await getStrapiAccessToken(request);

  if (options.requireAuth && !accessToken) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 },
    );
  }

  const headers = new Headers({
    Accept: 'application/json',
  });

  if (options.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(buildStrapiUrl(pathname, request.nextUrl.search), {
    method: options.method ?? 'GET',
    headers,
    body: options.body ?? null,
    cache: 'no-store',
  });

  const contentType = response.headers.get('content-type') ?? 'application/json';

  if (contentType.includes('application/json')) {
    const json = await response.json().catch(() => ({
      error: 'Invalid JSON response from Strapi.',
    }));
    return NextResponse.json(json, { status: response.status });
  }

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: {
      'Content-Type': contentType,
    },
  });
}
