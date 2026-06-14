'use client';

import useSWR from 'swr';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Brush,
} from 'recharts';
import { getSwotMeasurements } from '@/lib/strapi';
import type { SwotMeasurement } from '@/lib/strapi';
import { useTranslation } from '@/lib/use-app-translation';

export interface SwotChartProps {
  stationId: string;
}

function formatDate(ts: string): string {
  const d = new Date(ts);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1)
    .toString()
    .padStart(2, '0')}/${d.getFullYear()}`;
}

interface ChartPoint {
  date: string;
  mean: number | null;
  median: number | null;
}

function prepareData(measurements: SwotMeasurement[]): ChartPoint[] {
  return measurements.map((m) => ({
    date: formatDate(m.attributes.datetime),
    mean: m.attributes.mean ?? null,
    median: m.attributes.median ?? null,
  }));
}

function SkeletonChart() {
  return (
    <div className="flex h-[350px] animate-pulse flex-col gap-2 p-2">
      <div className="h-4 w-1/3 rounded bg-gray-200" />
      <div className="flex-1 rounded bg-gray-100" />
      <div className="h-12 w-full rounded bg-gray-200 mt-4" />
    </div>
  );
}

export default function SwotChart({ stationId }: SwotChartProps) {
  const { t } = useTranslation();
  
  // Fetching SWOT measurements for the selected station
  // Sorting ascending so time flows left to right on the chart
  const { data, error, isLoading } = useSWR(
    ['swot-measurements', stationId],
    () => getSwotMeasurements({ 
      'filters[station_id][$eq]': stationId,
      'pagination[pageSize]': '500',
      'sort[0]': 'datetime:asc'
    }),
    { revalidateOnFocus: false },
  );

  if (isLoading) return <SkeletonChart />;

  if (error) {
    return (
      <div className="flex h-[350px] items-center justify-center rounded-lg bg-red-50 text-sm text-red-600">
        {t('stationChart.loadError') || 'Error loading SWOT measurements.'}
      </div>
    );
  }

  const measurements = data?.data ?? [];

  if (measurements.length === 0) {
    return (
      <div className="flex h-[350px] items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-400">
        {t('stationChart.noMeasurements') || 'No measurements found.'}
      </div>
    );
  }

  const chartData = prepareData(measurements);

  return (
    <div className="w-full flex flex-col gap-2">
      <p className="text-xs font-medium text-gray-500">
        {t('dashboard.swotMeasurements') || 'SWOT Measurements'}
      </p>
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.24)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickFormatter={(v: number) => v.toFixed(2)}
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} verticalAlign="top" height={36} />
          <Line
            type="monotone"
            dataKey="mean"
            name={t('dashboard.swot.mean') || 'Mean (m)'}
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="median"
            name={t('dashboard.swot.median') || 'Median (m)'}
            stroke="#16a34a"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
          <Brush 
            dataKey="date" 
            height={40} 
            stroke="#94a3b8" 
            fill="rgba(148,163,184,0.1)"
            tickFormatter={() => ''}
            className="mt-4"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
