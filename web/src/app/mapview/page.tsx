'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { getAppSettings, getStations, getUserPreferences } from '@/lib/strapi';
import type { MapStylePreference, Station, StationVariable } from '@/lib/strapi';
import { useTranslation } from '@/lib/use-app-translation';

// Dynamic import to avoid SSR issues with mapbox-gl
const MapboxMap = dynamic(() => import('@/components/MapboxMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gray-100">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
    </div>
  ),
});

const VARIABLES: StationVariable[] = [
  'level_m',
  'flow_m3s',
  'precipitation_mm',
  'water_surface_elevation_m',
];

function getPast30Days() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

export default function MapPage() {
  const { t } = useTranslation();
  const { status } = useSession();


  const { data: stationsData } = useSWR('map-stations', () => getStations(), {
    revalidateOnFocus: false,
  });
  const { data: appSettingsData } = useSWR('app-settings', () => getAppSettings(), {
    revalidateOnFocus: false,
  });
  const { data: preferencesData, isLoading: isPreferencesLoading } = useSWR(
    status === 'authenticated' ? 'user-preferences' : null,
    () => getUserPreferences(),
    {
      revalidateOnFocus: false,
    },
  );

  const stations = stationsData?.data ?? [];
  const appSettings = appSettingsData?.data;
  const preferences = preferencesData?.data;
  const { from, to } = getPast30Days();
  const variableLabels: Record<StationVariable, string> = {
    level_m: t('stationSearch.level'),
    flow_m3s: t('stationSearch.flow'),
    precipitation_mm: t('stationSearch.precipitation'),
    water_surface_elevation_m: t('stationSearch.elevation'),
  };

  const handleStationDoubleClick = useCallback((station: Station) => {

    
  }, []);

  const handleStationSelect = useCallback((station: Station) => {

    // The map component will fly to the station when it receives new initialViewState
    // We communicate via a state prop
    setFlyTarget({
      longitude: station.attributes.longitude,
      latitude: station.attributes.latitude,
      zoom: 12,
    });
  }, []);

  const [flyTarget, setFlyTarget] = useState({
    longitude: -52,
    latitude: -15,
    zoom: 4,
  });
  const [mapStyle, setMapStyle] = useState<MapStylePreference>('outdoors');

  useEffect(() => {
    const source = preferences?.map ?? appSettings?.map;

    if (!source) {
      return;
    }

    setFlyTarget({
      longitude: source.centerLongitude,
      latitude: source.centerLatitude,
      zoom: source.defaultZoom,
    });
    setMapStyle(source.mapStyle);
  }, [appSettings, preferences]);

  return (
    <div className="relative flex h-screen w-full overflow-hidden">
      {/* Map */}
      <div className="flex-1">
        {!isPreferencesLoading || preferences ? (
          <MapboxMap
            key={mapStyle}
            initialViewState={flyTarget}
            mapStyle={mapStyle}
            stations={stations}
            onStationDoubleClick={handleStationDoubleClick}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-100 dark:bg-slate-950">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          </div>
        )}
      </div>

 
    </div>
  );
}
