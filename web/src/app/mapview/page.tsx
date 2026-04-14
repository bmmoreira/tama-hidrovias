/**
 * Map view route for ``/mapview``.
 *
 * This client component wires together Strapi-backed data
 * (stations, app settings, feature collection) with the
 * {@link MainMap} component and the station explorer overlay.
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
import { MAPVIEW_DEFAULT_STATE, resolveMapViewState } from './mapview-state';

// Dynamic import to avoid SSR issues with mapbox-gl
const MapboxMap = dynamic(() => import('@/components/maps/MapBase'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gray-100">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
    </div>
  ),
});

/**
 * Main map view entrypoint which selects the initial camera state
 * from user preferences or global app settings and renders the
 * interactive public map for analysis of the feature collection.
 */
export default function MapPage() {
  const { status } = useSession();

  const { data: stationsData } = useSWR('map-stations', () => getStations(), {
    revalidateOnFocus: false,
  });
  const { data: appSettingsData } = useSWR('app-settings', () => getAppSettings(), {
    revalidateOnFocus: false,
  });
  const { data: featureCollectionData } = useSWR(
    'map-feature-collection',
    () => getMapFeatureCollection(),
    {
      revalidateOnFocus: false,
    },
  );
  const { data: preferencesData, isLoading: isPreferencesLoading } = useSWR(
    status === 'authenticated' ? 'user-preferences' : null,
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
    <div className="relative flex h-screen w-full overflow-hidden">
      {/* Map */}
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
