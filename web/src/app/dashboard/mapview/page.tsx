/**
 * Dashboard map view route for ``/dashboard/mapview``.
 *
 * This client component mirrors the public ``/mapview`` flow but
 * renders inside the authenticated dashboard shell so users can
 * analyse the same Strapi-backed feature collection alongside
 * other panel tools.
 */
'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import {
  getAppSettings,
  getMapFeatureCollection,
  getStations,
  getUserPreferences,
} from '@/lib/strapi';
import type { MapStylePreference } from '@/lib/strapi';
import StationExplorerOverlay from '@/components/maps/StationExplorerOverlay';
import { useStationExplorer } from '@/components/maps/useStationExplorer';
import { MAPVIEW_DEFAULT_STATE, resolveMapViewState } from '@/app/mapview/mapview-state';

// Dynamic import to avoid SSR issues with mapbox-gl
const MapboxMap = dynamic(() => import('@/components/maps/MapBase'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gray-100 dark:bg-slate-950">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
    </div>
  ),
});

export default function DashboardMapViewPage() {
  const { status } = useSession();

  const { data: stationsData } = useSWR('dashboard-map-stations', () => getStations(), {
    revalidateOnFocus: false,
  });
  const { data: appSettingsData } = useSWR('dashboard-app-settings', () => getAppSettings(), {
    revalidateOnFocus: false,
  });
  const { data: featureCollectionData } = useSWR(
    'dashboard-map-feature-collection',
    () => getMapFeatureCollection(),
    {
      revalidateOnFocus: false,
    },
  );
  const { data: preferencesData, isLoading: isPreferencesLoading } = useSWR(
    status === 'authenticated' ? 'dashboard-user-preferences' : null,
    () => getUserPreferences(),
    {
      revalidateOnFocus: false,
    },
  );

  const stations = stationsData?.data ?? [];
  const appSettings = appSettingsData?.data;
  const featureCollection = featureCollectionData?.data?.featureCollection;
  const featureCollectionLayer = appSettings?.featureCollectionLayer;
  const preferences = preferencesData?.data;

  const [flyTarget, setFlyTarget] = useState(MAPVIEW_DEFAULT_STATE.flyTarget);
  const [mapStyle, setMapStyle] = useState<MapStylePreference>(
    MAPVIEW_DEFAULT_STATE.mapStyle,
  );
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
    const nextState = resolveMapViewState(preferences?.map, appSettings?.map);

    setFlyTarget(nextState.flyTarget);
    setMapStyle(nextState.mapStyle);
  }, [appSettings, preferences]);

  return (
    <div className="relative flex h-[calc(100vh-4rem)] w-full overflow-hidden md:h-[calc(100vh-4rem)]">
      <div className="flex-1">
        {!isPreferencesLoading || preferences ? (
          <MapboxMap
            key={mapStyle}
            initialViewState={flyTarget}
            mapStyle={mapStyle}
            stations={stations}
            featureCollection={featureCollection}
            featureCollectionLayerStyle={featureCollectionLayer}
          >
            <StationExplorerOverlay controller={stationExplorer} showLegend={false} />
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
