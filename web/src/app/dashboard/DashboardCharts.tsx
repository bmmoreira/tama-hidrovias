'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { getSwotMeasurements } from '@/lib/strapi';
import SwotChart from '@/components/SwotChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/lib/use-app-translation';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function DashboardCharts() {
  const { t } = useTranslation();
  
  // Fetch a batch of recent SWOT measurements to extract available station IDs
  const { data: swotData } = useSWR('dashboard-swot-stations', () =>
    getSwotMeasurements({ 'pagination[pageSize]': '1000' })
  );

  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [typedId, setTypedId] = useState<string>('');

  // Extract unique station IDs from the measurements
  const uniqueStations = useMemo(() => {
    if (!swotData?.data) return [];
    const ids = new Set<string>();
    swotData.data.forEach((m: any) => {
      if (m.attributes?.station_id) {
        ids.add(m.attributes.station_id);
      }
    });
    return Array.from(ids);
  }, [swotData]);

  const activeStationId = selectedStationId ?? uniqueStations[0];

  const handleSelectChange = (value: string) => {
    setSelectedStationId(value);
    setTypedId(value);
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTypedId(val);
    if (val.trim() !== '') {
      setSelectedStationId(val.trim());
    } else {
      setSelectedStationId(uniqueStations[0] || null);
    }
  };

  return (
    <Card>
      <CardHeader className="mb-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base text-gray-800 dark:text-slate-100">
          {t('dashboard.recentMeasurementsChart') || 'Recent SWOT Measurements'}
        </CardTitle>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input 
            placeholder={t('dashboard.typeStationId') || 'Type Station ID...'} 
            value={typedId}
            onChange={handleTypeChange}
            className="sm:w-48"
          />
          {uniqueStations.length > 0 && (
            <Select
              value={activeStationId ?? ''}
              onValueChange={handleSelectChange}
            >
              <SelectTrigger className="sm:w-60">
                <SelectValue placeholder={t('dashboard.selectStation') || 'Select Station'} />
              </SelectTrigger>
              <SelectContent>
                {uniqueStations.map((stationId) => (
                  <SelectItem key={stationId} value={stationId}>
                    Station ID: {stationId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {activeStationId ? (
          <SwotChart stationId={activeStationId} />
        ) : (
          <div className="flex h-48 items-center justify-center text-sm text-gray-400 dark:text-slate-500">
            {t('dashboard.noStation') || 'No stations available.'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
