'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { getStations } from '@/lib/strapi';
import type { Station } from '@/lib/strapi';
import StationChart from '@/components/StationChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
    <Card>
      <CardHeader className="mb-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base text-gray-800 dark:text-slate-100">
          Medições Recentes
        </CardTitle>
        {stations.length > 0 && (
          <Select
            value={String(stationId ?? '')}
            onValueChange={(value) => setSelectedId(Number(value))}
          >
            <SelectTrigger className="sm:w-80">
              <SelectValue placeholder="Selecione uma estação" />
            </SelectTrigger>
            <SelectContent>
            {stations.map((s: Station) => (
              <SelectItem key={s.id} value={String(s.id)}>
                {s.attributes.name} ({s.attributes.code})
              </SelectItem>
            ))}
            </SelectContent>
          </Select>
        )}
      </CardHeader>

      <CardContent>
        {stationId ? (
        <StationChart
          stationId={stationId}
          variable="level_m"
          from={from}
          to={to}
        />
      ) : (
        <div className="flex h-48 items-center justify-center text-sm text-gray-400 dark:text-slate-500">
          Nenhuma estação disponível
        </div>
      )}
      </CardContent>
    </Card>
  );
}
