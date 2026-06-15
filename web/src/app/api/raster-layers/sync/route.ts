import { NextRequest, NextResponse } from 'next/server';
import { getSessionRole, getStrapiAccessToken } from '@/lib/strapi-server';
import { canAccessAdmin } from '@/lib/roles';
import { parseRasterLayerFilename } from '@/lib/raster-layer-filename';

const TITILER_INTERNAL_URL =
  process.env.TITILER_INTERNAL_URL ?? 'http://titiler:8080';

const STRAPI_INTERNAL_URL =
  process.env.STRAPI_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_STRAPI_URL ??
  'http://localhost:1337';

type TitilerInfoResponse = {
  bounds?: [number, number, number, number];
  crs?: unknown;
  dtype?: string;
  nodata_value?: number | null;
  width?: number;
  height?: number;
  count?: number;
};

type TitilerStatisticsResponse = {
  [band: string]: {
    min?: number;
    max?: number;
    percentile_2?: number;
    percentile_98?: number;
  };
};

async function fetchTitilerJson<T>(url: URL): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`TiTiler request failed with status ${response.status}.`);
  }

  return (await response.json()) as T;
}

export async function POST(request: NextRequest) {
  const role = await getSessionRole(request);

  if (!canAccessAdmin(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const accessToken = await getStrapiAccessToken(request);

  if (!accessToken) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const filePath = typeof body?.path === 'string' ? body.path : null;

  if (!filePath || filePath.includes('..')) {
    return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
  }

  const fileName = filePath.split('/').pop() ?? filePath;
  const parsed = parseRasterLayerFilename(fileName);
  const sourceUrl = `/data/geotiffs/${filePath}`;

  try {
    const infoUrl = new URL(`${TITILER_INTERNAL_URL}/cog/info`);
    infoUrl.searchParams.set('url', sourceUrl);

    const statisticsUrl = new URL(`${TITILER_INTERNAL_URL}/cog/statistics`);
    statisticsUrl.searchParams.set('url', sourceUrl);

    const [info, statistics] = await Promise.all([
      fetchTitilerJson<TitilerInfoResponse>(infoUrl),
      fetchTitilerJson<TitilerStatisticsResponse>(statisticsUrl),
    ]);

    const bandStats = statistics.b1 ?? Object.values(statistics)[0] ?? {};

    const payload = {
      layer_id: parsed.layer_id,
      display_name: parsed.display_name,
      file_url: filePath,
      area_name: parsed.area_name,
      hydrology_variable: parsed.hydrology_variable,
      acquisition_date: parsed.acquisition_date,
      acquisition_time: parsed.acquisition_time,
      file_projection: parsed.file_projection,
      computed_min: bandStats.percentile_2 ?? bandStats.min ?? 0,
      computed_max: bandStats.percentile_98 ?? bandStats.max ?? 0,
      colormap_name: 'viridis',
      bounds: info.bounds ?? null,
      crs: info.crs != null ? String(info.crs) : null,
      dtype: info.dtype ?? null,
      nodata_value: info.nodata_value ?? null,
      width: info.width ?? null,
      height: info.height ?? null,
      band_count: info.count ?? null,
    };

    const response = await fetch(`${STRAPI_INTERNAL_URL}/api/raster-layers/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const json = await response.json().catch(() => ({
      error: 'Invalid JSON response from Strapi.',
    }));

    return NextResponse.json(json, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to sync raster layer metadata.',
      },
      { status: 500 },
    );
  }
}
