import { describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const getSessionRole = vi.fn();
const proxyStrapiRequest = vi.fn();
const isAnalystRole = vi.fn();

vi.mock('@/lib/strapi-server', () => ({
  getSessionRole,
  proxyStrapiRequest,
}));

vi.mock('@/lib/roles', () => ({
  isAnalystRole,
}));

describe('station id route guards', () => {
  it('rejects patch requests from non-analyst users', async () => {
    const { PATCH } = await import('./route');
    getSessionRole.mockResolvedValueOnce('viewer');
    isAnalystRole.mockReturnValueOnce(false);

    const request = new NextRequest('http://localhost:3000/api/stations/5', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Blocked' }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: '5' }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'Analyst role required.',
    });
    expect(proxyStrapiRequest).not.toHaveBeenCalled();
  });

  it('forwards delete requests for analyst users', async () => {
    const { DELETE } = await import('./route');
    getSessionRole.mockResolvedValueOnce('analyst');
    isAnalystRole.mockReturnValueOnce(true);
    proxyStrapiRequest.mockResolvedValueOnce(
      NextResponse.json({ ok: true }, { status: 200 }),
    );

    const request = new NextRequest('http://localhost:3000/api/stations/7', {
      method: 'DELETE',
    });

    const response = await DELETE(request, {
      params: Promise.resolve({ id: '7' }),
    });

    expect(proxyStrapiRequest).toHaveBeenCalledWith(
      request,
      '/api/stations/7',
      {
        method: 'DELETE',
        requireAuth: true,
      },
    );
    expect(response.status).toBe(200);
  });
});