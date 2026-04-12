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
} from 'recharts';
import { getMeasurements } from '@/lib/strapi';
import type { Measurement, StationVariable } from '@/lib/strapi';
import { useTranslation } from '@/lib/use-app-translation';

interface StationChartProps {
  stationId: number;
  variable: StationVariable;
  from: string;
  to: string;
}

const VARIABLE_LABELS: Record<StationVariable, string> = {
  level_m: 'Nível (m)',
  flow_m3s: 'Vazão (m³/s)',
  precipitation_mm: 'Chuva (mm)',
  water_surface_elevation_m: 'Altimetria (m)',
};

const VARIABLE_COLORS: Record<StationVariable, string> = {
  level_m: '#2563eb',
  flow_m3s: '#16a34a',
  precipitation_mm: '#0891b2',
  water_surface_elevation_m: '#9333ea',
};

const VARIABLE_UNITS: Record<StationVariable, string> = {
  level_m: 'm',
  flow_m3s: 'm³/s',
  precipitation_mm: 'mm',
  water_surface_elevation_m: 'm',
};

function formatDate(ts: string): string {
  const d = new Date(ts);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1)
    .toString()
    .padStart(2, '0')}`;
}

interface ChartPoint {
  date: string;
  value: number | null;
}

function prepareData(measurements: Measurement[]): ChartPoint[] {
  return measurements.map((m) => ({
    date: formatDate(m.attributes.datetime),
    value: m.attributes.value,
  }));
}

function SkeletonChart() {
  return (
    <div className="flex h-48 animate-pulse flex-col gap-2 p-2">
      <div className="h-4 w-1/3 rounded bg-gray-200" />
      <div className="flex-1 rounded bg-gray-100" />
    </div>
  );
}

export default function StationChart({
  stationId,
  variable,
  from,
  to,
}: StationChartProps) {
  const { t } = useTranslation();
  const { data, error, isLoading } = useSWR(
    ['measurements', stationId, variable, from, to],
    () => getMeasurements(stationId, variable, from, to),
    { revalidateOnFocus: false },
  );

  if (isLoading) return <SkeletonChart />;

  if (error) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg bg-red-50 text-sm text-red-600">
        {t('stationChart.loadError')}
      </div>
    );
  }

  const measurements = data?.data ?? [];

  if (measurements.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-400">
        {t('stationChart.noMeasurements')}
      </div>
    );
  }

  const chartData = prepareData(measurements);
  const unit = VARIABLE_UNITS[variable];
  const label = VARIABLE_LABELS[variable];
  const color = VARIABLE_COLORS[variable];

  return (
    <div className="w-full">
      <p className="mb-2 text-xs font-medium text-gray-500">{label}</p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.24)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickFormatter={(v: number) => v.toFixed(1)}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            formatter={(value: number) => [
              `${value.toFixed(2)} ${unit}`,
              label,
            ]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="value"
            name={label}
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
