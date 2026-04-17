import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// We'll dynamically import the route so the environment is the same as the module.
describe('titiler proxy header sanitization', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('forwards only whitelisted headers and injects token (without logging it)', async () => {
    // Mock fetch so we can inspect the target and headers passed
    const mockFetch = vi.fn().mockResolvedValueOnce(new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } }));
    // stub global.fetch
    // @ts-ignore
    global.fetch = mockFetch;

    // set a fake internal URL and token env
    process.env.TITILER_INTERNAL_URL = 'http://example-titiler:8000';
    process.env.TITILER_INTERNAL_TOKEN = 'test-token-123';

    const { GET } = await import('./[...path]/route');

    // Build a request with many headers, including hop-by-hop and sensitive ones
    const headers: Record<string, string> = {
      'Accept': 'image/png',
      'User-Agent': 'vitest-client/1.0',
      'Connection': 'keep-alive',
      'Proxy-Authorization': 'secret',
      'Cookie': 'session=bad',
      'X-Custom-Header': 'should-not-be-forwarded',
      'Referer': 'http://app.local/page',
    };

    const req = new NextRequest('http://localhost:3000/api/titiler/cog/info?url=file:///app/images/test.tif', {
      method: 'GET',
      headers,
    });

    const resp = await GET(req as unknown as Request);

    expect(mockFetch).toHaveBeenCalledOnce();
    const calledTarget = mockFetch.mock.calls[0][0] as string;
    const calledInit = mockFetch.mock.calls[0][1] as any;

    // target should contain our internal URL and the access_token query param
    expect(calledTarget).toContain('http://example-titiler:8000');
    expect(calledTarget).toContain('access_token=test-token-123');

    // Headers sent should NOT include Connection, Proxy-Authorization, Cookie, or X-Custom-Header
    const sentHeaders = calledInit.headers || {};
    expect(sentHeaders['Connection']).toBeUndefined();
    expect(sentHeaders['Proxy-Authorization']).toBeUndefined();
    expect(sentHeaders['Cookie']).toBeUndefined();
    expect(sentHeaders['X-Custom-Header']).toBeUndefined();

  // Whitelisted headers should be present (fetch headers may be lowercased)
  expect(sentHeaders['accept'] || sentHeaders['Accept']).toBe('image/png');
  expect(sentHeaders['user-agent'] || sentHeaders['User-Agent']).toBe('vitest-client/1.0');
  expect(sentHeaders['referer'] || sentHeaders['Referer']).toBe('http://app.local/page');

  // Authorization must be injected (server token)
  expect(sentHeaders['authorization'] || sentHeaders['Authorization']).toBeDefined();

    // The response should be a NextResponse-like; check status
    expect((resp as any).status).toBe(200);
  });
});
