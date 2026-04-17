import { NextResponse } from 'next/server';
import pino from 'pino';

// Structured logger used for server-side proxies. Default level respects
// LOG_LEVEL env var, falling back to 'info' in production.
const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

const TITILER_INTERNAL_URL = process.env.TITILER_INTERNAL_URL ?? 'http://hfs-titiler:8000';
const TITILER_INTERNAL_TOKEN = process.env.TITILER_INTERNAL_TOKEN ?? null;

async function proxyRequest(request: Request, pathSegments?: string[]) {
  // Build the target URL by using the request pathname if params are not available.
  const reqUrl = new URL(request.url);
  // Expected incoming path: /api/titiler/<...rest>
  const prefix = '/api/titiler/';
  let path = '';

  if (pathSegments && pathSegments.length) {
    path = pathSegments.join('/');
  } else if (reqUrl.pathname.startsWith(prefix)) {
    path = reqUrl.pathname.slice(prefix.length).replace(/^\//, '');
  }

  // If the target TiTiler instance is running with a root-path (e.g. --root-path /map)
  // requests may include an extra "map" segment. Normalize by stripping a leading
  // "map/" segment to avoid forwarding duplicated paths (which produce /map/map/...)
  if (path.startsWith('map/')) {
    path = path.slice(4);
  } else if (path === 'map') {
    path = '';
  }

  const search = reqUrl.search || '';

  // If an internal token is configured, prefer passing it as the `access_token`
  // query parameter which is what TiTiler's global token expects. Only append
  // if the caller did not already include an access_token.
  let tokenSuffix = '';
  try {
    const sp = new URLSearchParams(search.replace(/^\?/, ''));
    if (TITILER_INTERNAL_TOKEN && !sp.has('access_token')) {
      tokenSuffix = (search ? '&' : '?') + 'access_token=' + encodeURIComponent(TITILER_INTERNAL_TOKEN);
    }
  } catch (e) {
    // fallback: append token if parsing fails
    if (TITILER_INTERNAL_TOKEN) tokenSuffix = (search ? '&' : '?') + 'access_token=' + encodeURIComponent(TITILER_INTERNAL_TOKEN);
  }

  // Normalize the TiTiler target so we never produce a duplicated '/map/map/'
  // path when the internal URL already includes a root path like '/map'.
  const internalBase = TITILER_INTERNAL_URL.replace(/\/$/, '');

  // Remove any leading "map/" segments from the path so we can re-add a
  // single canonical /map prefix depending on the internal base.
  while (path.startsWith('map/')) {
    path = path.slice(4);
  }

  // Decide whether to include a single 'map' prefix in the final URL. If the
  // internal base already ends with '/map', don't add another; otherwise add
  // the 'map' prefix so targets like '/map/cog/info' remain valid.
  const needsMapPrefix = !internalBase.endsWith('/map');
  const prefixPath = needsMapPrefix ? 'map/' : '';

  const target = `${internalBase}/${prefixPath}${path}${search}${tokenSuffix}`;

  // Whitelist headers to forward to TiTiler. Prefer explicit allowed list instead
  // of copying everything and removing forbidden keys. This keeps the proxy
  // behavior predictable and prevents accidental leaking of client cookies
  // or connection control headers that break undici/node fetch.
  const allowed = new Set([
    'accept',
    'accept-language',
    'accept-encoding',
    'cache-control',
    'if-none-match',
    'if-modified-since',
    'range',
    'content-type',
    'referer',
    'user-agent',
    // allow custom x-requested-with for some clients
    'x-requested-with',
  ]);

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (allowed.has(lower)) headers[key] = value;
  });

  // Inject internal token only on server-side proxy (don't log it below)
  if (TITILER_INTERNAL_TOKEN) {
    headers['authorization'] = `Bearer ${TITILER_INTERNAL_TOKEN}`;
  }

  // Structured log the upstream target and sanitized headers (exclude token)
  try {
    const logged = { target, headers: { ...headers } } as any;
    if (logged.headers.authorization) {
      // avoid logging secrets
      logged.headers.authorization = 'REDACTED';
    }
    // pino structured logging
    logger.debug({ target: logged.target, headers: logged.headers }, 'titiler-proxy.forward');
  } catch (e) {
    // If logging fails, fall back to no-op (don't let logging crash the proxy)
    logger.error({ err: e }, 'titiler-proxy.logging_error');
  }

  // If this is a CORS preflight request, respond immediately with permissive
  // but safe CORS headers (mirror Origin if present).
  if (request.method === 'OPTIONS') {
    const origin = request.headers.get('origin') ?? '*';
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,Range',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '600',
    };
    return new NextResponse(null, { status: 204, headers: corsHeaders });
  }

  // Forward body for methods that may include one
  const init: RequestInit = {
    method: request.method,
    headers,
    // body can only be forwarded if the request has a body
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    redirect: 'follow',
  };

  let resp: Response;
  try {
    resp = await fetch(target, init);
  } catch (err: any) {
    // Return a 502 Bad Gateway with a small error payload so the browser
    // doesn't get a generic 500 and we have a clearer client-facing message.
    return new NextResponse(JSON.stringify({ error: 'upstream_fetch_failed', message: String(err?.message ?? err) }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Build a streaming response preserving a safe set of headers and add CORS
  // headers so browser requests (if routed through the proxy) succeed.
  const responseHeaders = new Headers();
  resp.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    // Do NOT forward content-length: when proxying streaming responses the
    // content-length header from the upstream server can mismatch the bytes
    // actually sent by Next (or be inaccurate for error payloads) and causes
    // browsers to raise ERR_CONTENT_LENGTH_MISMATCH. Forward other safe headers.
    if (['content-type', 'cache-control', 'expires', 'etag', 'last-modified'].includes(lower)) {
      responseHeaders.set(key, value);
    }
    if (lower === 'x-titiler-cache-status') {
      responseHeaders.set(key, value);
    }
  });

  // Add CORS response headers mirroring Origin when present
  const origin = request.headers.get('origin');
  if (origin) {
    responseHeaders.set('Access-Control-Allow-Origin', origin);
    responseHeaders.set('Access-Control-Allow-Credentials', 'true');
  } else {
    // fallback permissive header for internal clients
    responseHeaders.set('Access-Control-Allow-Origin', '*');
  }

  return new NextResponse(resp.body, {
    status: resp.status,
    headers: responseHeaders,
  });
}

export async function GET(request: Request) {
  return proxyRequest(request);
}

export async function POST(request: Request) {
  return proxyRequest(request);
}

export async function PUT(request: Request) {
  return proxyRequest(request);
}

export async function DELETE(request: Request) {
  return proxyRequest(request);
}

export async function PATCH(request: Request) {
  return proxyRequest(request);
}

export async function OPTIONS(request: Request) {
  return proxyRequest(request);
}

// Support HEAD requests so client probes (used by LoadBestTile) succeed.
export async function HEAD(request: Request) {
  return proxyRequest(request);
}
