'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { getAppSettings, getStations, getUserPreferences } from '@/lib/strapi';
import type { MapStylePreference } from '@/lib/strapi';
import StationExplorerOverlay from '@/components/maps/StationExplorerOverlay';
import { useStationExplorer } from '@/components/maps/useStationExplorer';

// Dynamic import to avoid SSR issues with mapbox-gl
const MapboxMap = dynamic(() => import('@/components/MapboxMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gray-100">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
    </div>
  ),
});

export default function MapPage() {
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

  const [flyTarget, setFlyTarget] = useState({
    longitude: -52,
    latitude: -15,
    zoom: 4,
  });
  const [mapStyle, setMapStyle] = useState<MapStylePreference>('outdoors');
  const stationExplorer = useStationExplorer({
    onStationFocus: (station) => {
      setFlyTarget({
        longitude: station.attributes.longitude,
        latitude: station.attributes.latitude,
        zoom: 12,
      });
    },
  });

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
            onStationDoubleClick={stationExplorer.focusStation}
          >
            <StationExplorerOverlay controller={stationExplorer} />
          </MapboxMap>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-100 dark:bg-slate-950">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          </div>
        )}
      </div>
    </div>
  );
}
