import { NextResponse } from 'next/server';
import { resolveForecastTileSource } from '@/lib/forecast-tiles';

const TITILER_INTERNAL_URL =
  process.env.TITILER_INTERNAL_URL ?? 'http://titiler:8080';

type TitilerStatisticsResponse = {
  [band: string]: {
    min?: number;
    max?: number;
    percentile_2?: number;
    percentile_98?: number;
  };
};

async function fetchTitilerJson<T>(url: URL) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`TiTiler request failed with status ${response.status}.`);
  }

  return (await response.json()) as T;
}

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      slug: string;
    }>;
  },
) {
  const { slug } = await context.params;
  const tileSource = await resolveForecastTileSource(slug);

  if (!tileSource) {
    return NextResponse.json(
      { error: 'Forecast GeoTIFF not found.' },
      { status: 404 },
    );
  }

  try {
    const sourceUrl = `/data/geotiffs/${tileSource.fileName}`;
    const infoUrl = new URL(`${TITILER_INTERNAL_URL}/cog/info`);
    infoUrl.searchParams.set('url', sourceUrl);

    const statisticsUrl = new URL(`${TITILER_INTERNAL_URL}/cog/statistics`);
    statisticsUrl.searchParams.set('url', sourceUrl);

    const [info, statistics] = await Promise.all([
      fetchTitilerJson<{
        bounds?: [number, number, number, number];
      }>(infoUrl),
      fetchTitilerJson<TitilerStatisticsResponse>(statisticsUrl),
    ]);

    const bandStats = statistics.b1 ?? Object.values(statistics)[0] ?? {};

    return NextResponse.json({
      data: {
        bounds: info.bounds ?? null,
        min: bandStats.min ?? null,
        max: bandStats.max ?? null,
        recommendedMin: bandStats.percentile_2 ?? bandStats.min ?? null,
        recommendedMax: bandStats.percentile_98 ?? bandStats.max ?? null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Could not read forecast layer metadata.',
      },
      { status: 500 },
    );
  }
}