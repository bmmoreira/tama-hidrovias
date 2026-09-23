'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { getAppSettings, getStations, getSwotGaugeCollection, getUserPreferences } from '@/lib/strapi';
import type { MapStylePreference } from '@/lib/strapi';
import { SHOW_STATION_MARKERS } from '@/components/maps/stationClusterLayer';
import StationExplorerOverlay from '@/components/maps/StationExplorerOverlay';
import ForecastDrawer from '@/components/maps/ForecastDrawer';
import ForecastLegend from '@/components/maps/ForecastLegend';
import type { ForecastOverlayConfig } from '@/components/maps/ForecastDrawer';
import HomeButton from '@/components/ui/HomeButton';
import DashboardButton from '@/components/ui/DashboardButton';
import { useStationExplorer } from '@/components/maps/useStationExplorer';
import WelcomeModal from '@/components/maps/WelcomeModal';
import SwotFilterDrawer, {
  DEFAULT_SWOT_FILTER,
  filterSwotFeatures,
  type SwotGaugeFilter,
} from '@/components/maps/SwotFilterDrawer';
import LayersDrawer, {
  DEFAULT_LAYERS_FILTER,
  buildDefaultLayersFilter,
  filterRiverFeatures,
  filterBasinFeatures,
  type LayersFilter,
  type RiverFeature,
  type RiverFeatureProperties,
  type BasinFeature,
  type BasinFeatureProperties,
} from '@/components/maps/LayersDrawer';
import { useMockRainHeatmap } from '@/components/maps/useMockRainHeatmap';
import type { CrossSectionFeature } from '@/components/maps/crossSectionClusterLayer';

const geojsonFetcher = (url: string) => fetch(url).then((res) => res.json());

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
  const { data: session, status } = useSession();

  // Station markers are off by default (mock data, see stationClusterLayer.ts)
  // -- skip the fetch entirely rather than fetching data that won't render.
  const { data: stationsData } = useSWR(
    SHOW_STATION_MARKERS ? 'map-stations' : null,
    () => getStations(),
    { revalidateOnFocus: false },
  );
  const { data: appSettingsData } = useSWR('app-settings', () => getAppSettings(), {
    revalidateOnFocus: false,
  });
  const { data: swotGaugeData } = useSWR('swot-gauge-collection', () => getSwotGaugeCollection(), {
    revalidateOnFocus: false,
  });
  const { data: riversGeojson } = useSWR<
    GeoJSON.FeatureCollection<GeoJSON.MultiLineString, RiverFeatureProperties>
  >('/geojson/rivers.geojson', geojsonFetcher, { revalidateOnFocus: false });
  const { data: basinsGeojson } = useSWR<
    GeoJSON.FeatureCollection<GeoJSON.Polygon, BasinFeatureProperties>
  >('/geojson/subbacias.geojson', geojsonFetcher, { revalidateOnFocus: false });
  const { data: crossSectionsGeojson } = useSWR<
    GeoJSON.FeatureCollection<GeoJSON.Point, CrossSectionFeature['properties']>
  >('/geojson/output_points_water_level.geojson', geojsonFetcher, { revalidateOnFocus: false });
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
  const swotGaugeFeatures = swotGaugeData?.data?.featureCollection?.features ?? [];

  const riverFeatures = (riversGeojson?.features ?? []) as RiverFeature[];
  const basinFeatures = (basinsGeojson?.features ?? []) as BasinFeature[];
  const crossSectionFeatures = (crossSectionsGeojson?.features ?? []) as CrossSectionFeature[];

  const [layersFilter, setLayersFilter] = useState<LayersFilter>(DEFAULT_LAYERS_FILTER);
  const [layersFilterInitialized, setLayersFilterInitialized] = useState(false);

  useEffect(() => {
    if (layersFilterInitialized) return;
    // Wait for both GeoJSON files to arrive — subbacias.geojson is much larger
    // than rivers.geojson and resolves later, so gating on "either loaded" would
    // lock in an empty selectedBasins before the basin data ever showed up.
    if (!riversGeojson || !basinsGeojson) return;

    setLayersFilter(buildDefaultLayersFilter(riverFeatures, basinFeatures));
    setLayersFilterInitialized(true);
  }, [riversGeojson, basinsGeojson, riverFeatures, basinFeatures, layersFilterInitialized]);

  const basinFeaturesWithRain = useMockRainHeatmap(basinFeatures);

  const filteredRiverFeatures = filterRiverFeatures(riverFeatures, layersFilter);
  const filteredBasinFeatures = filterBasinFeatures(basinFeaturesWithRain, layersFilter);

  const [swotFilter, setSwotFilter] = useState<SwotGaugeFilter>(DEFAULT_SWOT_FILTER);
  // Spatial filter modes ("near rivers" / "inside basins") match against
  // whichever rivers/basins are currently visible in the Camadas drawer.
  // Memoized since the spatial checks are heavier than the other filters.
  const filteredSwotGaugeFeatures = useMemo(
    () =>
      filterSwotFeatures(swotGaugeFeatures, swotFilter, {
        riverFeatures: filteredRiverFeatures,
        basinFeatures: filteredBasinFeatures,
      }),
    [swotGaugeFeatures, swotFilter, filteredRiverFeatures, filteredBasinFeatures],
  );

  const [flyTarget, setFlyTarget] = useState({
    longitude: -52,
    latitude: -15,
    zoom: 4,
  });
  const [forecastOverlay, setForecastOverlay] = useState<ForecastOverlayConfig>();
  const [forecastDrawerOpen, setForecastDrawerOpen] = useState(false);
  const [mapStyle, setMapStyle] = useState<MapStylePreference>('outdoors');
  const stationExplorer = useStationExplorer({
    onStationFocus: (station) => {
      setFlyTarget({
        longitude: station.attributes.longitude,
        latitude: station.attributes.latitude,
        zoom: 12,
      });
    },
    onFeatureFocus: (feature) => {
      setFlyTarget({
        longitude: feature.longitude,
        latitude: feature.latitude,
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
      <WelcomeModal />
      {/* Map */}
      <div className="flex-1">
        {!isPreferencesLoading || preferences ? (
          <MapboxMap
            key={mapStyle}
            initialViewState={flyTarget}
            mapStyle={mapStyle}
            stations={stations}
            onStationDoubleClick={stationExplorer.focusStation}
            tileLayerUrl={forecastOverlay?.tileLayerUrl}
            tileLayerOpacity={forecastOverlay?.tileLayerOpacity}
            tileLayerBounds={forecastOverlay?.tileLayerBounds}
            fitToTileLayerBounds={forecastOverlay?.fitToBounds}
            swotGaugeFeatures={filteredSwotGaugeFeatures}
            swotMetric={swotFilter.metric}
            riverFeatures={filteredRiverFeatures}
            basinFeatures={filteredBasinFeatures}
            crossSectionFeatures={crossSectionFeatures}
          >
            <StationExplorerOverlay controller={stationExplorer} />
            <ForecastLegend
              overlay={forecastOverlay}
              drawerOpen={forecastDrawerOpen}
              hasSwotGauges={swotGaugeFeatures.length > 0}
            />
            <ForecastDrawer
              onTileLayerChange={setForecastOverlay}
              onOpenChange={setForecastDrawerOpen}
              appSettings={appSettings}
            />
            {swotGaugeFeatures.length > 0 && (
              <SwotFilterDrawer
                features={swotGaugeFeatures}
                filter={swotFilter}
                onFilterChange={setSwotFilter}
                searchPanelOpen={stationExplorer.panelOpen}
                forecastDrawerOpen={forecastDrawerOpen}
                riverFeatures={filteredRiverFeatures}
                basinFeatures={filteredBasinFeatures}
              />
            )}
            {(riverFeatures.length > 0 || basinFeatures.length > 0) && (
              <LayersDrawer
                riverFeatures={riverFeatures}
                basinFeatures={basinFeatures}
                filter={layersFilter}
                onFilterChange={setLayersFilter}
                forecastDrawerOpen={forecastDrawerOpen}
              />
            )}
            {status === 'authenticated' ? <DashboardButton /> : <HomeButton />}
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
