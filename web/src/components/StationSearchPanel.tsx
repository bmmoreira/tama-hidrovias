'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { Search, X, ChevronRight } from 'lucide-react';
import { getMapFeatureCollection } from '@/lib/strapi';
import type { MapFeatureCollectionFeature } from '@/lib/strapi';
import clsx from 'clsx';
import { useTranslation } from '@/lib/use-app-translation';
import type { StationExplorerFeatureTarget } from '@/components/maps/useStationExplorer';

function parseSearchString(value: unknown) {
  return value == null ? undefined : String(value).trim() || undefined;
}

function parseSearchNumber(value: unknown) {
  const number = typeof value === 'number' ? value : Number(value);

  return Number.isFinite(number) ? number : undefined;
}

function getFeatureProperty(
  feature: MapFeatureCollectionFeature,
  keys: string[],
) {
  for (const key of keys) {
    const value = parseSearchString(feature.properties[key]);

    if (value) {
      return value;
    }
  }

  return undefined;
}

function toFeatureSearchTarget(
  feature: MapFeatureCollectionFeature,
  index: number,
): StationExplorerFeatureTarget | null {
  const [longitude, latitude] = feature.geometry.coordinates;

  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return null;
  }

  const fid =
    getFeatureProperty(feature, ['fid', 'FID']) ??
    getFeatureProperty(feature, ['id', 'ID']) ??
    parseSearchString(feature.id);
  const code = getFeatureProperty(feature, ['codigo', 'Codigo', 'code', 'Code']);
  const name =
    getFeatureProperty(feature, ['name', 'Name', 'nome', 'Nome']) ??
    code ??
    fid ??
    `Feature ${index + 1}`;

  return {
    id: fid ?? code ?? String(index),
    name,
    code,
    fid,
    longitude,
    latitude,
    source: getFeatureProperty(feature, ['source', 'Source', 'fonte', 'Fonte']),
    satellite: getFeatureProperty(feature, ['sat', 'satellite', 'Satellite']),
    river: getFeatureProperty(feature, ['river', 'River', 'rio', 'Rio']),
    basin: getFeatureProperty(feature, ['basin', 'Basin', 'bacia', 'Bacia']),
    startDate: getFeatureProperty(feature, ['s_date', 'startDate', 'start_date']),
    endDate: getFeatureProperty(feature, ['e_date', 'endDate', 'end_date']),
    value: parseSearchNumber(feature.properties.value),
    change: parseSearchNumber(feature.properties.change),
    anomaly: parseSearchNumber(feature.properties.anomalia),
  };
}

/** Props for the slide-in search panel used to find stations on the map. */
export interface StationSearchPanelProps {
  onFeatureSelect: (feature: StationExplorerFeatureTarget) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function StationSearchPanel({
  onFeatureSelect,
  isOpen,
  onClose,
}: StationSearchPanelProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const { data, isLoading } = useSWR(
    'map-feature-collection-search',
    () => getMapFeatureCollection(),
    { revalidateOnFocus: false },
  );

  const filtered = useMemo(() => {
    const features =
      data?.data?.featureCollection.features
        .map(toFeatureSearchTarget)
        .filter((feature): feature is StationExplorerFeatureTarget => feature !== null) ??
      [];

    return features.filter((feature) => {
      const normalizedQuery = query.toLowerCase();
      const matchQuery =
        !query ||
        feature.name.toLowerCase().includes(normalizedQuery) ||
        feature.code?.toLowerCase().includes(normalizedQuery) ||
        feature.fid?.toLowerCase().includes(normalizedQuery);
      return matchQuery;
    });
  }, [data, query]);

  return (
    <>
      {/* Overlay (mobile) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/30 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <aside
        className={clsx(
          'fixed z-30 flex flex-col bg-white shadow-xl transition-transform duration-300',
          // Mobile: bottom sheet sliding up
          'bottom-0 left-0 right-0 h-[70vh] rounded-t-2xl md:rounded-none',
          // Desktop: left sidebar
          'md:bottom-auto md:left-0 md:top-0 md:h-full md:w-80',
          isOpen
            ? 'translate-y-0 md:translate-x-0'
            : 'translate-y-full md:translate-y-0 md:-translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-base font-semibold text-gray-800">
            {t('stationSearch.title')}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            aria-label={t('map.closePanel')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="space-y-3 border-b border-gray-100 px-4 py-3">
          {/* Text search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('stationSearch.queryPlaceholder')}
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-4 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-2 py-2">
          {isLoading && (
            <div className="space-y-2 p-2">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse rounded-lg bg-gray-100"
                />
              ))}
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-gray-400">
              {t('stationSearch.noResults')}
            </p>
          )}

          {filtered.map((feature) => (
            <button
              key={`${feature.id}:${feature.longitude}:${feature.latitude}`}
              onClick={() => {
                onFeatureSelect(feature);
                onClose();
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition hover:bg-blue-50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-800">
                  {feature.name}
                </p>
                <p className="text-xs text-gray-400">
                  FID: {feature.fid ?? '-'} · Codigo: {feature.code ?? '-'}
                  {feature.basin ? ` · ${feature.basin}` : ''}
                </p>
              </div>
              <ChevronRight className="ml-2 h-4 w-4 shrink-0 text-gray-300" />
            </button>
          ))}
        </div>

        {/* Station count */}
        {!isLoading && (
          <p className="border-t border-gray-100 px-4 py-2 text-center text-xs text-gray-400">
            {t('stationSearch.count', { count: filtered.length })}
          </p>
        )}
      </aside>
    </>
  );
}
