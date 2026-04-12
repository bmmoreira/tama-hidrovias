import type { Station } from '@/lib/strapi';
'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { getStations, getForecasts } from '@/lib/strapi';
import type { Forecast, StationVariable } from '@/lib/strapi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/lib/use-app-translation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const VARIABLES: StationVariable[] = ['level_m', 'flow_m3s', 'precipitation_mm'];
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
    .padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}h`;
}

export default function ForecastsPage() {
  const { t } = useTranslation();
  const [stationId, setStationId] = useState<number | null>(null);
  const [variable, setVariable] =
    useState<StationVariable>('level_m');

  const variableLabels: Record<StationVariable, string> = {
    level_m: t('forecasts.level'),
    flow_m3s: t('forecasts.flow'),
    precipitation_mm: t('forecasts.precipitation'),
    water_surface_elevation_m: t('forecasts.elevation'),
  };

  const { data: stationsData } = useSWR('forecast-stations', () =>
    getStations(),
  );
  const stations = stationsData?.data ?? [];
  const activeStationId = stationId ?? stations[0]?.id ?? null;

  const { data: forecastsData, isLoading } = useSWR(
    activeStationId ? ['forecasts', activeStationId, variable] : null,
    () => getForecasts(activeStationId!, variable),
    { revalidateOnFocus: false },
  );

  const forecasts = forecastsData?.data ?? [];

  // Group forecasts by model run (issued_at)
  const runs = useMemo(() => {
    const map = new Map<string, Forecast[]>();
    forecasts.forEach((f: Forecast) => {
      const key = f.attributes.issued_at;
      const existing = map.get(key) ?? [];
      existing.push(f);
      map.set(key, existing);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 5); // last 5 runs
  }, [forecasts]);

  // Chart data: latest run
  const latestRun = runs[0]?.[1] ?? [];
  const chartData = latestRun.map((f) => ({
    date: formatDate(f.attributes.valid_at),
    valor: f.attributes.value,
  }));

  const unit = VARIABLE_UNITS[variable];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{t('forecasts.title')}</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {t('forecasts.subtitle')}
        </p>
      </div>

      {/* Selectors */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          value={String(activeStationId ?? '')}
          onValueChange={(value) => setStationId(Number(value))}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder={t('forecasts.selectStation')} />
          </SelectTrigger>
          <SelectContent>
          {stations.map((s: Station) => (
            <SelectItem key={s.id} value={String(s.id)}>
              {s.attributes.name} ({s.attributes.code})
            </SelectItem>
          ))}
          </SelectContent>
        </Select>
        <Select
          value={variable}
          onValueChange={(value) => setVariable(value as StationVariable)}
        >
          <SelectTrigger className="sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
          {VARIABLES.map((v) => (
            <SelectItem key={v} value={v}>
              {variableLabels[v]}
            </SelectItem>
          ))}
          </SelectContent>
        </Select>
        </div>
      </Card>

      {/* Forecast chart */}
      <Card>
        <CardHeader>
        <CardTitle className="mb-0 text-sm font-semibold text-gray-700 dark:text-slate-200">
          {t('forecasts.forecastLabel')} — {variableLabels[variable]}
          {runs[0]?.[0] && (
            <span className="ml-2 text-xs font-normal text-gray-400 dark:text-slate-500">
              {t('forecasts.issuedAt')}: {formatDate(runs[0][0])}
            </span>
          )}
        </CardTitle>
        </CardHeader>
        <CardContent>

        {isLoading && (
          <div className="flex h-56 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          </div>
        )}

        {!isLoading && chartData.length === 0 && (
          <div className="flex h-56 items-center justify-center text-sm text-gray-400 dark:text-slate-500">
            {t('forecasts.noForecasts')}
          </div>
        )}

        {!isLoading && chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart
              data={chartData}
              margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
            >
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
                contentStyle={{ fontSize: 12, borderRadius: 8, backgroundColor: '#020817', borderColor: '#1e293b', color: '#e2e8f0' }}
                formatter={(value: number, name: string) => [
                  `${value.toFixed(2)} ${unit}`,
                  name === 'valor' ? variableLabels[variable] : 'Dispersão',
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="valor"
                name={variableLabels[variable]}
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
        </CardContent>
      </Card>

      {/* Recent runs table */}
      {runs.length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b border-gray-100 px-5 py-3 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-slate-100">
              {t('forecasts.recentRuns')}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 dark:border-slate-800 dark:bg-slate-900">
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-300">
                    {t('forecasts.model')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-300">
                    {t('forecasts.issuance')}
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-slate-300">
                    {t('forecasts.horizons')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                {runs.map(([issuedAt, runForecasts]) => (
                  <tr key={issuedAt} className="hover:bg-gray-50 dark:hover:bg-slate-900/60">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-slate-100">
                      {runForecasts[0]?.attributes.model ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-300">
                      {formatDate(issuedAt)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-slate-400">
                      {runForecasts.length} {t('forecasts.leadTimes')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
