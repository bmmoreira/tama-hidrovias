'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { getStations } from '@/lib/strapi';
import type { Station } from '@/lib/strapi';
import StationChart from '@/components/StationChart';

export default function DashboardCharts() {
  const { data: stationsData } = useSWR('dashboard-stations', () =>
    getStations({ 'pagination[pageSize]': '10' }),
  );

  const stations: Station[] = stationsData?.data ?? [];
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const stationId = selectedId ?? stations[0]?.id;

  const to = new Date().toISOString();
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-gray-800">
          Medições Recentes
        </h2>
        {stations.length > 0 && (
          <select
            value={stationId ?? ''}
            onChange={(e) => setSelectedId(Number(e.target.value))}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
          >
            {stations.map((s: Station) => (
              <option key={s.id} value={s.id}>
                {s.attributes.name} ({s.attributes.code})
              </option>
            ))}
          </select>
        )}
      </div>

      {stationId ? (
        <StationChart
          stationId={stationId}
          variable="level_m"
          from={from}
          to={to}
        />
      ) : (
        <div className="flex h-48 items-center justify-center text-sm text-gray-400">
          Nenhuma estação disponível
        </div>
      )}
    </div>
  );
}
