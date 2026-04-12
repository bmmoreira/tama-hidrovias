import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('station mutation helpers', () => {
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ ok: true }),
    }) as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;

    if (typeof originalWindow === 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (globalThis as typeof globalThis & { window?: Window }).window;
    } else {
      globalThis.window = originalWindow;
    }
  });

  it('uses the internal station route for browser-side station updates', async () => {
    globalThis.window = {} as Window & typeof globalThis;
    const { updateStation } = await import('./strapi');

    await updateStation(12, {
      name: 'Station A',
      code: 'STA-001',
      source: 'Virtual',
      latitude: -3.1,
      longitude: -60.2,
      basin: 'Amazonas',
      river: 'Negro',
      active: true,
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/stations/12',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          name: 'Station A',
          code: 'STA-001',
          source: 'Virtual',
          latitude: -3.1,
          longitude: -60.2,
          basin: 'Amazonas',
          river: 'Negro',
          active: true,
        }),
      }),
    );
  });

  it('uses the internal station route for browser-side station deletion', async () => {
    globalThis.window = {} as Window & typeof globalThis;
    const { deleteStation } = await import('./strapi');

    await deleteStation(21);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/stations/21',
      expect.objectContaining({
        method: 'DELETE',
      }),
    );
  });
});