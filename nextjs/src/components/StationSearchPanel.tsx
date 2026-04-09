'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { Search, X, ChevronRight } from 'lucide-react';
import { getStations } from '@/lib/strapi';
import type { Station } from '@/lib/strapi';
import clsx from 'clsx';

const SOURCES = ['Todas', 'ANA', 'HydroWeb', 'SNIRH', 'Virtual'] as const;
const VARIABLES = [
  { value: 'Todas', label: 'Todas as variáveis' },
  { value: 'level_m', label: 'Nível' },
  { value: 'flow_m3s', label: 'Vazão' },
  { value: 'precipitation_mm', label: 'Chuva' },
  { value: 'water_surface_elevation_m', label: 'Altimetria' },
] as const;

interface StationSearchPanelProps {
  onStationSelect: (station: Station) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function StationSearchPanel({
  onStationSelect,
  isOpen,
  onClose,
}: StationSearchPanelProps) {
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<(typeof SOURCES)[number]>('Todas');
  const [variable, setVariable] = useState('Todas');

  const { data, isLoading } = useSWR('stations-search', () => getStations(), {
    revalidateOnFocus: false,
  });

  const filtered = useMemo(() => {
    const stations = data?.data ?? [];
    return stations.filter((s) => {
      const matchQuery =
        !query ||
        s.attributes.name.toLowerCase().includes(query.toLowerCase()) ||
        s.attributes.code.toLowerCase().includes(query.toLowerCase());
      const matchSource =
        source === 'Todas' || s.attributes.source === source;
      // variable filtering is metadata-level; we filter by source only for now
      void variable;
      return matchQuery && matchSource;
    });
  }, [data, query, source, variable]);

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
            Buscar Estações
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            aria-label="Fechar painel"
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
              placeholder="Nome ou código da estação"
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-4 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Source select */}
          <select
            value={source}
            onChange={(e) =>
              setSource(e.target.value as (typeof SOURCES)[number])
            }
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s === 'Todas' ? 'Todas as fontes' : s}
              </option>
            ))}
          </select>

          {/* Variable select */}
          <select
            value={variable}
            onChange={(e) => setVariable(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            {VARIABLES.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
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
              Nenhuma estação encontrada.
            </p>
          )}

          {filtered.map((station) => (
            <button
              key={station.id}
              onClick={() => {
                onStationSelect(station);
                onClose();
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition hover:bg-blue-50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-800">
                  {station.attributes.name}
                </p>
                <p className="text-xs text-gray-400">
                  {station.attributes.code} · {station.attributes.source} ·{' '}
                  {station.attributes.basin}
                </p>
              </div>
              <ChevronRight className="ml-2 h-4 w-4 shrink-0 text-gray-300" />
            </button>
          ))}
        </div>

        {/* Station count */}
        {!isLoading && (
          <p className="border-t border-gray-100 px-4 py-2 text-center text-xs text-gray-400">
            {filtered.length} estação{filtered.length !== 1 ? 'ões' : ''}{' '}
            encontrada{filtered.length !== 1 ? 's' : ''}
          </p>
        )}
      </aside>
    </>
  );
}
