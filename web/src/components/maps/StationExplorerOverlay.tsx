'use client';

import { Search, X } from 'lucide-react';
import StationChart from '@/components/StationChart';
import StationSearchPanel from '@/components/StationSearchPanel';
import type { StationVariable } from '@/lib/strapi';
import { useTranslation } from '@/lib/use-app-translation';
import type { StationExplorerController } from './useStationExplorer';

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

/** Props for the overlay that ties together station search and charts. */
export interface StationExplorerOverlayProps {
  controller: StationExplorerController;
  showLegend?: boolean;
}

export default function StationExplorerOverlay({
  controller,
  showLegend = true,
}: StationExplorerOverlayProps) {
  const { t } = useTranslation();
  const { from, to } = getPast30Days();
  const variableLabels: Record<StationVariable, string> = {
    level_m: t('stationSearch.level'),
    flow_m3s: t('stationSearch.flow'),
    precipitation_mm: t('stationSearch.precipitation'),
    water_surface_elevation_m: t('stationSearch.elevation'),
  };

  return (
    <>
      <button
        onClick={controller.openPanel}
        className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-lg transition hover:bg-gray-50 md:left-4"
        aria-label={t('map.openStationSearch')}
      >
        <Search className="h-4 w-4 text-gray-500" />
        <span className="hidden sm:inline">{t('map.searchStations')}</span>
      </button>

      <StationSearchPanel
        isOpen={controller.panelOpen}
        onClose={controller.closePanel}
        onStationSelect={controller.selectStation}
      />

      {controller.selectedStation ? (
        <div
          className={`fixed bottom-0 left-0 right-0 z-30 rounded-t-2xl bg-white shadow-2xl transition-transform duration-300 md:bottom-4 md:left-auto md:right-4 md:w-96 md:rounded-2xl ${
            controller.detailOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          <div className="flex items-start justify-between border-b border-gray-100 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                {controller.selectedStation.attributes.name}
              </h3>
              <p className="text-xs text-gray-400">
                {controller.selectedStation.attributes.code} ·{' '}
                {controller.selectedStation.attributes.source} ·{' '}
                {controller.selectedStation.attributes.basin}
              </p>
            </div>
            <button
              onClick={controller.closeDetails}
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label={t('map.closePanel')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex gap-1 overflow-x-auto px-4 py-2">
            {VARIABLES.map((variable) => (
              <button
                key={variable}
                onClick={() => controller.setActiveVariable(variable)}
                className={`shrink-0 rounded-lg px-3 py-1 text-xs font-medium transition ${
                  controller.activeVariable === variable
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {variableLabels[variable]}
              </button>
            ))}
          </div>

          <div className="px-4 pb-4">
            <StationChart
              stationId={controller.selectedStation.id}
              variable={controller.activeVariable}
              from={from}
              to={to}
            />
            <p className="mt-1 text-right text-xs text-gray-400">
              {t('map.last30Days')}
            </p>
          </div>
        </div>
      ) : null}

      {showLegend ? (
        <div className="absolute bottom-4 left-4 z-10 hidden rounded-xl bg-white/90 px-3 py-2 text-xs shadow-lg backdrop-blur md:block">
          <p className="mb-1 font-semibold text-gray-700">{t('map.source')}</p>
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
      ) : null}
    </>
  );
}