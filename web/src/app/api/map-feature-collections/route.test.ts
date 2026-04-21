import { describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const getSessionRole = vi.fn();
const proxyStrapiRequest = vi.fn();
const canAccessAdmin = vi.fn();

vi.mock('@/lib/strapi-server', () => ({
  getSessionRole,
  proxyStrapiRequest,
}));

vi.mock('@/lib/roles', () => ({
  canAccessAdmin,
}));

describe('map feature collection route', () => {
  it('rejects put requests from users without write access', async () => {
    const { PUT } = await import('./route');
    getSessionRole.mockResolvedValueOnce('viewer');
    canAccessAdmin.mockReturnValueOnce(false);

    const request = new NextRequest(
      'http://localhost:3000/api/map-feature-collections',
      {
        method: 'PUT',
        body: JSON.stringify({ featureCollection: { type: 'FeatureCollection', features: [] } }),
      },
    );

    const response = await PUT(request);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'Analyst or admin access required.',
    });
    expect(proxyStrapiRequest).not.toHaveBeenCalled();
  });

  it('forwards put requests for users with write access', async () => {
    const { PUT } = await import('./route');
    getSessionRole.mockResolvedValueOnce('analyst');
    canAccessAdmin.mockReturnValueOnce(true);
    proxyStrapiRequest.mockResolvedValueOnce(
      NextResponse.json({ data: { id: 1 } }, { status: 200 }),
    );

    const payload = {
      name: 'sv',
      featureCollection: {
        type: 'FeatureCollection',
        features: [],
      },
    };

    const request = new NextRequest(
      'http://localhost:3000/api/map-feature-collections',
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    );

    const response = await PUT(request);

    expect(proxyStrapiRequest).toHaveBeenCalledWith(
      request,
      '/api/map-feature-collections/current',
      {
        method: 'PUT',
        requireAuth: true,
        body: JSON.stringify(payload),
      },
    );
    expect(response.status).toBe(200);
  });
});