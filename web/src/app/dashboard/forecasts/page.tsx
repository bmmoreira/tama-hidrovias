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

const VARIABLES: StationVariable[] = ['level_m', 'flow_m3s', 'precipitation_mm'];
const VARIABLE_LABELS: Record<StationVariable, string> = {
  level_m: 'Nível (m)',
  flow_m3s: 'Vazão (m³/s)',
  precipitation_mm: 'Chuva (mm)',
  water_surface_elevation_m: 'Altimetria (m)',
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
    .padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}h`;
}

export default function ForecastsPage() {
  const [stationId, setStationId] = useState<number | null>(null);
  const [variable, setVariable] =
    useState<StationVariable>('level_m');

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
        <h1 className="text-2xl font-bold text-gray-900">Previsões</h1>
        <p className="text-sm text-gray-500">
          Previsões hidrológicas para os próximos 15 dias
        </p>
      </div>

      {/* Selectors */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row">
        <select
          value={activeStationId ?? ''}
          onChange={(e) => setStationId(Number(e.target.value))}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
        >
          {stations.map((s: Station) => (
            <option key={s.id} value={s.id}>
              {s.attributes.name} ({s.attributes.code})
            </option>
          ))}
        </select>
        <select
          value={variable}
          onChange={(e) =>
            setVariable(e.target.value as StationVariable)
          }
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
        >
          {VARIABLES.map((v) => (
            <option key={v} value={v}>
              {VARIABLE_LABELS[v]}
            </option>
          ))}
        </select>
      </div>

      {/* Forecast chart */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">
          Previsão — {VARIABLE_LABELS[variable]}
          {runs[0]?.[0] && (
            <span className="ml-2 text-xs font-normal text-gray-400">
              Emissão: {formatDate(runs[0][0])}
            </span>
          )}
        </h2>

        {isLoading && (
          <div className="flex h-56 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          </div>
        )}

        {!isLoading && chartData.length === 0 && (
          <div className="flex h-56 items-center justify-center text-sm text-gray-400">
            Nenhuma previsão disponível para esta estação/variável.
          </div>
        )}

        {!isLoading && chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart
              data={chartData}
              margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickFormatter={(v: number) => v.toFixed(1)}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(value: number, name: string) => [
                  `${value.toFixed(2)} ${unit}`,
                  name === 'valor' ? VARIABLE_LABELS[variable] : 'Dispersão',
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="valor"
                name={VARIABLE_LABELS[variable]}
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Recent runs table */}
      {runs.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-gray-800">
              Rodadas Recentes
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Modelo
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Emissão
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">
                    Horizontes (dias)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {runs.map(([issuedAt, runForecasts]) => (
                  <tr key={issuedAt} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {runForecasts[0]?.attributes.model ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDate(issuedAt)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {runForecasts.length} prazos
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
