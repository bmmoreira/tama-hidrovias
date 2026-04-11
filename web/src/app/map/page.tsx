'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useEffect } from 'react';
import useSWR from 'swr';
import { Search, X } from 'lucide-react';
import { getStations, getUserPreferences } from '@/lib/strapi';
import type { MapStylePreference, Station, StationVariable } from '@/lib/strapi';
import StationChart from '@/components/StationChart';
import StationSearchPanel from '@/components/StationSearchPanel';

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
const VARIABLE_LABELS: Record<StationVariable, string> = {
  level_m: 'Nível',
  flow_m3s: 'Vazão',
  precipitation_mm: 'Chuva',
  water_surface_elevation_m: 'Altimetria',
};

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
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [activeVariable, setActiveVariable] = useState<StationVariable>('level_m');
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);

  const { data: stationsData } = useSWR('map-stations', () => getStations(), {
    revalidateOnFocus: false,
  });
  const { data: preferencesData, isLoading: isPreferencesLoading } = useSWR(
    'user-preferences',
    () => getUserPreferences(),
    {
      revalidateOnFocus: false,
    },
  );

  const stations = stationsData?.data ?? [];
  const preferences = preferencesData?.data;
  const { from, to } = getPast30Days();

  const handleStationDoubleClick = useCallback((station: Station) => {
    setSelectedStation(station);
    setActiveVariable('level_m');
    setBottomSheetOpen(true);
  }, []);

  const handleStationSelect = useCallback((station: Station) => {
    setSelectedStation(station);
    setBottomSheetOpen(true);
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
    if (!preferences) {
      return;
    }

    setFlyTarget({
      longitude: preferences.map.centerLongitude,
      latitude: preferences.map.centerLatitude,
      zoom: preferences.map.defaultZoom,
    });
    setMapStyle(preferences.map.mapStyle);
  }, [preferences]);

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

      {/* Search button */}
      <button
        onClick={() => setPanelOpen(true)}
        className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-lg transition hover:bg-gray-50 md:left-4"
        aria-label="Abrir busca de estações"
      >
        <Search className="h-4 w-4 text-gray-500" />
        <span className="hidden sm:inline">Buscar estações</span>
      </button>

      {/* Station search panel */}
      <StationSearchPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        onStationSelect={handleStationSelect}
      />

      {/* Station detail bottom sheet */}
      {selectedStation && (
        <div
          className={`fixed bottom-0 left-0 right-0 z-30 rounded-t-2xl bg-white shadow-2xl transition-transform duration-300 md:bottom-4 md:left-auto md:right-4 md:w-96 md:rounded-2xl ${
            bottomSheetOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          {/* Handle / header */}
          <div className="flex items-start justify-between border-b border-gray-100 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                {selectedStation.attributes.name}
              </h3>
              <p className="text-xs text-gray-400">
                {selectedStation.attributes.code} ·{' '}
                {selectedStation.attributes.source} ·{' '}
                {selectedStation.attributes.basin}
              </p>
            </div>
            <button
              onClick={() => setBottomSheetOpen(false)}
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Fechar painel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Variable tabs */}
          <div className="flex gap-1 overflow-x-auto px-4 py-2">
            {VARIABLES.map((v) => (
              <button
                key={v}
                onClick={() => setActiveVariable(v)}
                className={`shrink-0 rounded-lg px-3 py-1 text-xs font-medium transition ${
                  activeVariable === v
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {VARIABLE_LABELS[v]}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div className="px-4 pb-4">
            <StationChart
              stationId={selectedStation.id}
              variable={activeVariable}
              from={from}
              to={to}
            />
            <p className="mt-1 text-right text-xs text-gray-400">
              Últimos 30 dias
            </p>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 hidden rounded-xl bg-white/90 px-3 py-2 text-xs shadow-lg backdrop-blur md:block">
        <p className="mb-1 font-semibold text-gray-700">Fonte</p>
        {[
          { label: 'ANA', color: '#2563eb' },
          { label: 'HydroWeb', color: '#16a34a' },
          { label: 'SNIRH', color: '#d97706' },
          { label: 'Virtual', color: '#9333ea' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full border border-white"
              style={{ backgroundColor: color }}
            />
            <span className="text-gray-600">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
