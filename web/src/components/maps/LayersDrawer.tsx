'use client';

import { useMemo, useState } from 'react';
import { Layers, X, Search, Waves, Map as MapIcon } from 'lucide-react';
import clsx from 'clsx';
import { MOCK_RAIN_MIN_MM, MOCK_RAIN_MAX_MM, RAIN_COLOR_STOPS } from './useMockRainHeatmap';

/** Properties of a river feature loaded from `public/geojson/rivers.geojson`. */
export interface RiverFeatureProperties {
  NAME: string;
  SYSTEM: string | null;
  MILES: number;
  KILOMETERS: number;
}

/** A single river line (or multi-segment river) rendered on the map. */
export type RiverFeature = GeoJSON.Feature<
  GeoJSON.LineString | GeoJSON.MultiLineString,
  RiverFeatureProperties
>;

/** Properties of a sub-basin polygon loaded from `public/geojson/subbacias.geojson`. */
export interface BasinFeatureProperties {
  id: number;
  DNS_DNB_CD: number;
  DNS_NU_SUB: number;
  DNS_NM: string;
  /** Mock rainfall value (mm) injected by useMockRainHeatmap for the choropleth fill. */
  rainMm?: number;
}

/** A single sub-basin polygon rendered on the map. */
export type BasinFeature = GeoJSON.Feature<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  BasinFeatureProperties
>;

/** Which rivers/basins are currently toggled on and selected in the Camadas drawer. */
export interface LayersFilter {
  riversVisible: boolean;
  /** River NAME values currently selected. */
  selectedRivers: string[];
  basinsVisible: boolean;
  /** Basin `id` values currently selected. */
  selectedBasins: number[];
}

/** Initial state before river/basin GeoJSON has loaded — rivers on, basins off. */
export const DEFAULT_LAYERS_FILTER: LayersFilter = {
  riversVisible: true,
  selectedRivers: [],
  basinsVisible: false,
  selectedBasins: [],
};

/** Builds the default filter with every river/basin selected once the source data is known. */
export function buildDefaultLayersFilter(
  riverFeatures: RiverFeature[],
  basinFeatures: BasinFeature[],
): LayersFilter {
  return {
    riversVisible: true,
    selectedRivers: riverFeatures.map((f) => f.properties.NAME),
    basinsVisible: false,
    selectedBasins: basinFeatures.map((f) => f.properties.id),
  };
}

/** Applies `filter`'s rivers on/off + selection to the full river feature list. */
export function filterRiverFeatures(
  features: RiverFeature[],
  filter: LayersFilter,
): RiverFeature[] {
  if (!filter.riversVisible) return [];
  const selected = new Set(filter.selectedRivers);
  return features.filter((f) => selected.has(f.properties.NAME));
}

/** Applies `filter`'s basins on/off + selection to the full basin feature list. */
export function filterBasinFeatures(
  features: BasinFeature[],
  filter: LayersFilter,
): BasinFeature[] {
  if (!filter.basinsVisible) return [];
  const selected = new Set(filter.selectedBasins);
  return features.filter((f) => selected.has(f.properties.id));
}

interface LayersDrawerProps {
  riverFeatures: RiverFeature[];
  basinFeatures: BasinFeature[];
  filter: LayersFilter;
  onFilterChange: (f: LayersFilter) => void;
  /** Forecast drawer opens a full-height panel on the right; shift over so we don't overlap it. */
  forecastDrawerOpen?: boolean;
}

const INPUT_CLASS =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 placeholder-slate-300 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';

/**
 * Mobile-first "Camadas" drawer for the public map. Lets visitors toggle the
 * rivers and sub-basins GeoJSON layers on/off and pick individual features,
 * and shows a mock rainfall choropleth legend for the basins layer.
 */
export default function LayersDrawer({
  riverFeatures,
  basinFeatures,
  filter,
  onFilterChange,
  forecastDrawerOpen = false,
}: LayersDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [riverSearch, setRiverSearch] = useState('');
  const [basinSearch, setBasinSearch] = useState('');

  const sortedRivers = useMemo(
    () => [...riverFeatures].sort((a, b) => a.properties.NAME.localeCompare(b.properties.NAME)),
    [riverFeatures],
  );
  const sortedBasins = useMemo(
    () => [...basinFeatures].sort((a, b) => a.properties.DNS_NM.localeCompare(b.properties.DNS_NM)),
    [basinFeatures],
  );

  const visibleRivers = useMemo(
    () =>
      sortedRivers.filter((f) =>
        f.properties.NAME.toLowerCase().includes(riverSearch.toLowerCase()),
      ),
    [sortedRivers, riverSearch],
  );
  const visibleBasins = useMemo(
    () =>
      sortedBasins.filter((f) =>
        f.properties.DNS_NM.toLowerCase().includes(basinSearch.toLowerCase()),
      ),
    [sortedBasins, basinSearch],
  );

  const selectedRiverSet = new Set(filter.selectedRivers);
  const selectedBasinSet = new Set(filter.selectedBasins);

  const riversActiveCount = filter.selectedRivers.length;
  const basinsActiveCount = filter.selectedBasins.length;

  const isFilterActive =
    !filter.riversVisible ||
    filter.selectedRivers.length !== riverFeatures.length ||
    filter.basinsVisible;

  const activeBadgeCount =
    (filter.riversVisible && filter.selectedRivers.length < riverFeatures.length ? 1 : 0) +
    (!filter.riversVisible ? 1 : 0) +
    (filter.basinsVisible ? 1 : 0);

  function update(patch: Partial<LayersFilter>) {
    onFilterChange({ ...filter, ...patch });
  }

  function toggleRiver(name: string) {
    const next = new Set(selectedRiverSet);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    update({ selectedRivers: Array.from(next) });
  }

  function toggleBasin(id: number) {
    const next = new Set(selectedBasinSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    update({ selectedBasins: Array.from(next) });
  }

  function reset() {
    onFilterChange({
      riversVisible: true,
      selectedRivers: riverFeatures.map((f) => f.properties.NAME),
      basinsVisible: false,
      selectedBasins: [],
    });
  }

  if (riverFeatures.length === 0 && basinFeatures.length === 0) return null;

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/20 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Toggle button — stacked below the Home/Dashboard button on the right,
          shifted left when the forecast drawer's full-height panel is open. */}
      <div
        className={clsx(
          'pointer-events-none absolute right-4 top-[3.75rem] z-30',
          forecastDrawerOpen && 'md:right-[27.5rem]',
        )}
      >
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          aria-expanded={isOpen}
          className={clsx(
            'pointer-events-auto inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium shadow-lg transition',
            isFilterActive
              ? 'bg-sky-500 text-white shadow-sky-400/30 hover:bg-sky-600'
              : 'bg-white text-gray-700 hover:bg-gray-50',
          )}
        >
          <Layers className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Camadas</span>
          {activeBadgeCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-white/25 px-1 text-[10px] font-bold text-white">
              {activeBadgeCount}
            </span>
          )}
        </button>
      </div>

      {/* Drawer panel */}
      <aside
        className={clsx(
          'fixed z-30 flex flex-col bg-white shadow-2xl transition-transform duration-300 dark:bg-slate-900',
          // Mobile: bottom sheet
          'bottom-0 left-0 right-0 max-h-[75vh] rounded-t-3xl',
          // Desktop: right side panel. The resting anchor is always right-0 —
          // shifting left of the forecast drawer is done via translate-x below,
          // not by moving the anchor, so the closed state's translate-x-full
          // always clears the viewport instead of only clearing the (variable)
          // anchor and landing on top of the forecast panel.
          'md:bottom-auto md:left-auto md:right-0 md:top-0 md:h-full md:w-80 md:rounded-none',
          // Animation
          isOpen
            ? clsx(
                'translate-y-0 md:translate-y-0',
                forecastDrawerOpen ? 'md:-translate-x-[26rem]' : 'md:translate-x-0',
              )
            : 'translate-y-full md:translate-x-full md:translate-y-0',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Camadas do mapa
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Rios e bacias hidrográficas
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
            aria-label="Fechar camadas"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
          {/* Rivers section */}
          <div>
            <div className="mb-2.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Waves className="h-3.5 w-3.5 text-sky-500" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">
                  Rios
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={filter.riversVisible}
                onClick={() => update({ riversVisible: !filter.riversVisible })}
                className={clsx(
                  'relative h-5 w-9 shrink-0 rounded-full transition',
                  filter.riversVisible ? 'bg-sky-500' : 'bg-slate-200 dark:bg-slate-700',
                )}
              >
                <span
                  className={clsx(
                    'absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                    filter.riversVisible ? 'translate-x-4' : 'translate-x-0',
                  )}
                />
              </button>
            </div>

            {filter.riversVisible && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>
                    <span className="font-semibold text-sky-600 dark:text-sky-400">
                      {riversActiveCount}
                    </span>{' '}
                    de {riverFeatures.length} selecionados
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        update({ selectedRivers: riverFeatures.map((f) => f.properties.NAME) })
                      }
                      className="font-medium text-sky-600 hover:underline dark:text-sky-400"
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => update({ selectedRivers: [] })}
                      className="font-medium text-slate-400 hover:underline dark:text-slate-500"
                    >
                      Nenhum
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar rio..."
                    value={riverSearch}
                    onChange={(e) => setRiverSearch(e.target.value)}
                    className={clsx(INPUT_CLASS, 'pl-8')}
                  />
                </div>

                <div className="flex max-h-48 flex-col gap-0.5 overflow-y-auto rounded-lg border border-slate-100 p-1 dark:border-slate-800">
                  {visibleRivers.length === 0 ? (
                    <p className="px-2 py-2 text-xs text-slate-400">Nenhum rio encontrado</p>
                  ) : (
                    visibleRivers.map((f) => {
                      const name = f.properties.NAME;
                      const checked = selectedRiverSet.has(name);
                      return (
                        <label
                          key={name}
                          className={clsx(
                            'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition',
                            checked
                              ? 'bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200'
                              : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleRiver(name)}
                            className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-sky-500 focus:ring-sky-400"
                          />
                          <span className="truncate">{name}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Basins section */}
          <div>
            <div className="mb-2.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <MapIcon className="h-3.5 w-3.5 text-emerald-500" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">
                  Bacias hidrográficas
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={filter.basinsVisible}
                onClick={() => update({ basinsVisible: !filter.basinsVisible })}
                className={clsx(
                  'relative h-5 w-9 shrink-0 rounded-full transition',
                  filter.basinsVisible ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700',
                )}
              >
                <span
                  className={clsx(
                    'absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                    filter.basinsVisible ? 'translate-x-4' : 'translate-x-0',
                  )}
                />
              </button>
            </div>

            {filter.basinsVisible && (
              <div className="flex flex-col gap-2">
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-800/40">
                  <p className="mb-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    Chuva acumulada (mock) por bacia
                  </p>
                  <div
                    className="h-2 w-full rounded-full"
                    style={{
                      background: `linear-gradient(to right, ${RAIN_COLOR_STOPS.map(([, color]) => color).join(', ')})`,
                    }}
                  />
                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                    <span>{MOCK_RAIN_MIN_MM} mm</span>
                    <span>{MOCK_RAIN_MAX_MM}+ mm</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {basinsActiveCount}
                    </span>{' '}
                    de {basinFeatures.length} selecionadas
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        update({ selectedBasins: basinFeatures.map((f) => f.properties.id) })
                      }
                      className="font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                    >
                      Todas
                    </button>
                    <button
                      type="button"
                      onClick={() => update({ selectedBasins: [] })}
                      className="font-medium text-slate-400 hover:underline dark:text-slate-500"
                    >
                      Nenhuma
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar bacia..."
                    value={basinSearch}
                    onChange={(e) => setBasinSearch(e.target.value)}
                    className={clsx(INPUT_CLASS, 'pl-8')}
                  />
                </div>

                <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto rounded-lg border border-slate-100 p-1 dark:border-slate-800">
                  {visibleBasins.length === 0 ? (
                    <p className="px-2 py-2 text-xs text-slate-400">Nenhuma bacia encontrada</p>
                  ) : (
                    visibleBasins.map((f) => {
                      const id = f.properties.id;
                      const checked = selectedBasinSet.has(id);
                      return (
                        <label
                          key={id}
                          className={clsx(
                            'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition',
                            checked
                              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                              : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleBasin(id)}
                            className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-emerald-500 focus:ring-emerald-400"
                          />
                          <span className="truncate">{f.properties.DNS_NM}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer — shown only when filters are active */}
        {isFilterActive && (
          <div className="border-t border-slate-100 px-5 py-3 dark:border-slate-800">
            <button
              type="button"
              onClick={reset}
              className="w-full rounded-lg py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Restaurar padrão
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
