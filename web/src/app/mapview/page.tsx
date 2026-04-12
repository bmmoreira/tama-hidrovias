'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import {
  getAppSettings,
  getMapFeatureCollection,
  getStations,
  getUserPreferences,
} from '@/lib/strapi';
import type { MapStylePreference, Station, StationVariable } from '@/lib/strapi';
import { useTranslation } from '@/lib/use-app-translation';
import StationSearchPanel from '@/components/StationSearchPanel';
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

  const [flyTarget, setFlyTarget] = useState(MAPVIEW_DEFAULT_STATE.flyTarget);
  const [mapStyle, setMapStyle] = useState<MapStylePreference>(
    MAPVIEW_DEFAULT_STATE.mapStyle,
  );

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
