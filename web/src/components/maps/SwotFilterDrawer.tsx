'use client';

import { useState } from 'react';
import { SlidersHorizontal, X, Search, Eye, EyeOff } from 'lucide-react';
import clsx from 'clsx';
import type { SwotGaugeFeature } from '@/lib/strapi';
import type { RiverFeature, BasinFeature } from './LayersDrawer';
import { isNearAnyRiver, isInsideAnyBasin } from './spatialFilter';

/** Water-level trend bucket derived from a gauge's `Change` reading. */
export type SwotDirection = 'all' | 'rising' | 'falling' | 'nodata';

/** 'none' shows all stations; the others match against whatever rivers/basins
 *  are currently visible in the Camadas drawer (LayersDrawer). */
export type SwotSpatialMode = 'none' | 'nearRivers' | 'insideBasins';

/**
 * Which `SwotGaugeFeatureProperties` field drives gauge/cluster color, shape,
 * and label on the map. Clusters aggregate whichever one is selected by
 * **median** (not mean) across their points, since a mean is skewed by
 * outliers in a way a median isn't — see `swotGaugeClusterLayer.ts`.
 */
export type SwotMetric = 'Change' | 'std' | 'median';

export const SWOT_METRIC_OPTIONS: { value: SwotMetric; label: string }[] = [
  { value: 'Change', label: 'Variação' },
  { value: 'std', label: 'Desvio padrão' },
  { value: 'median', label: 'Mediana' },
];

export interface SwotGaugeFilter {
  /** Master switch — when false, no SWOT gauges are shown regardless of the other filters. */
  visible: boolean;
  direction: SwotDirection;
  changeMin: number | null;
  changeMax: number | null;
  nameSearch: string;
  dateFrom: string | null;
  dateTo: string | null;
  spatialMode: SwotSpatialMode;
  /** Max distance (km) to a visible river when spatialMode is 'nearRivers'. */
  riverProximityKm: number;
  /** Property visualized on the map (individual gauges and cluster aggregates alike). */
  metric: SwotMetric;
}

/** All stations visible, no direction/range/spatial restrictions applied. */
export const DEFAULT_SWOT_FILTER: SwotGaugeFilter = {
  visible: true,
  direction: 'all',
  changeMin: null,
  changeMax: null,
  nameSearch: '',
  dateFrom: null,
  dateTo: null,
  spatialMode: 'none',
  riverProximityKm: 20,
  metric: 'Change',
};

/** Rivers/basins currently visible in the Camadas drawer, used to match
 *  nearby/contained stations for the spatial filter modes. */
export interface SwotSpatialContext {
  riverFeatures?: RiverFeature[];
  basinFeatures?: BasinFeature[];
}

/**
 * Applies every {@link SwotGaugeFilter} rule to `features`: the visibility
 * switch, trend/range/name/date filters, and — when `spatial` is supplied —
 * the "near visible rivers" / "inside visible basins" spatial modes.
 */
export function filterSwotFeatures(
  features: SwotGaugeFeature[],
  filter: SwotGaugeFilter,
  spatial?: SwotSpatialContext,
): SwotGaugeFeature[] {
  if (!filter.visible) return [];

  return features.filter((f) => {
    const { Change, Nome, date, longitude, latitude } = f.properties;
    const hasChange = typeof Change === 'number';

    if (
      filter.direction === 'rising' &&
      !(hasChange && (Change as number) >= 0)
    )
      return false;
    if (
      filter.direction === 'falling' &&
      !(hasChange && (Change as number) < 0)
    )
      return false;
    if (filter.direction === 'nodata' && hasChange) return false;

    if (
      filter.changeMin !== null &&
      (!hasChange || (Change as number) < filter.changeMin)
    )
      return false;
    if (
      filter.changeMax !== null &&
      (!hasChange || (Change as number) > filter.changeMax)
    )
      return false;

    if (
      filter.nameSearch &&
      !Nome?.toLowerCase().includes(filter.nameSearch.toLowerCase())
    )
      return false;

    const featureDay = date ? date.split(' ')[0] : null;
    if (filter.dateFrom && (!featureDay || featureDay < filter.dateFrom))
      return false;
    if (filter.dateTo && (!featureDay || featureDay > filter.dateTo))
      return false;

    if (filter.spatialMode === 'nearRivers') {
      const rivers = spatial?.riverFeatures ?? [];
      if (rivers.length === 0) return false;
      if (!isNearAnyRiver([longitude, latitude], rivers, filter.riverProximityKm)) return false;
    }

    if (filter.spatialMode === 'insideBasins') {
      const basins = spatial?.basinFeatures ?? [];
      if (basins.length === 0) return false;
      if (!isInsideAnyBasin([longitude, latitude], basins)) return false;
    }

    return true;
  });
}

interface SwotFilterDrawerProps {
  features: SwotGaugeFeature[];
  filter: SwotGaugeFilter;
  onFilterChange: (f: SwotGaugeFilter) => void;
  /** When the station search panel is open on desktop it occupies left-0 w-80,
   *  so the filter button shifts right to avoid overlapping the panel. */
  searchPanelOpen?: boolean;
  forecastDrawerOpen?: boolean;
  /** Rivers currently visible/selected in the Camadas drawer — powers the
   *  "near rivers" spatial filter. */
  riverFeatures?: RiverFeature[];
  /** Basins currently visible/selected in the Camadas drawer — powers the
   *  "inside basins" spatial filter. */
  basinFeatures?: BasinFeature[];
}

const SPATIAL_MODE_OPTIONS: { value: SwotSpatialMode; label: string }[] = [
  { value: 'none', label: 'Todas as estações' },
  { value: 'nearRivers', label: 'Perto dos rios visíveis' },
  { value: 'insideBasins', label: 'Dentro das bacias visíveis' },
];

const DIRECTION_OPTIONS: {
  value: SwotDirection;
  label: string;
  icon: string;
  iconClass: string;
}[] = [
  { value: 'all', label: 'Todas', icon: '◆', iconClass: 'text-slate-400' },
  {
    value: 'rising',
    label: 'Subindo',
    icon: '▲',
    iconClass: 'text-emerald-500',
  },
  { value: 'falling', label: 'Descendo', icon: '▼', iconClass: 'text-red-500' },
  {
    value: 'nodata',
    label: 'Sem dados',
    icon: '—',
    iconClass: 'text-gray-400',
  },
];

const INPUT_CLASS =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 placeholder-slate-300 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';

/**
 * Mobile-first drawer for filtering the SWOT gauge triangles on the public
 * map: visibility, trend, change range, date range, name search, and a
 * spatial filter that reuses whatever rivers/basins are currently visible
 * in the Camadas drawer (see `LayersDrawer.tsx`).
 */
export default function SwotFilterDrawer({
  features,
  filter,
  onFilterChange,
  searchPanelOpen = false,
  riverFeatures = [],
  basinFeatures = [],
}: SwotFilterDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const spatialContext: SwotSpatialContext = { riverFeatures, basinFeatures };
  const filteredCount = filterSwotFeatures(features, filter, spatialContext).length;
  const totalCount = features.length;

  const isFilterActive =
    !filter.visible ||
    filter.direction !== 'all' ||
    filter.changeMin !== null ||
    filter.changeMax !== null ||
    filter.nameSearch !== '' ||
    filter.dateFrom !== null ||
    filter.dateTo !== null ||
    filter.spatialMode !== 'none';

  const activeFilterCount = [
    !filter.visible,
    filter.direction !== 'all',
    filter.changeMin !== null || filter.changeMax !== null,
    filter.nameSearch !== '',
    filter.dateFrom !== null || filter.dateTo !== null,
    filter.spatialMode !== 'none',
  ].filter(Boolean).length;

  function reset() {
    onFilterChange(DEFAULT_SWOT_FILTER);
  }

  function update(patch: Partial<SwotGaugeFilter>) {
    onFilterChange({ ...filter, ...patch });
  }

  if (totalCount === 0) return null;

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/20 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/*
        On mobile: below the search button (top-[3.75rem]).
        On desktop with search panel closed: same (left-4, below search button).
        On desktop with search panel open: shift right of the w-80 (320px = 20rem)
        panel → left-[21rem] gives a 1rem gap, and return to top-4 since we're
        in a clear column with no button above to avoid.
      */}
      <div
        className={clsx(
          'pointer-events-none absolute left-4 top-[4.0rem] z-30',
          searchPanelOpen && 'md:left-[21rem] md:top-4',
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
          <SlidersHorizontal className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Filtros</span>
          {isFilterActive && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-white/25 px-1 text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Drawer panel */}
      <aside
        className={clsx(
          'fixed z-30 flex flex-col bg-white shadow-2xl transition-transform duration-300 dark:bg-slate-900',
          // Mobile: bottom sheet
          'bottom-0 left-0 right-0 max-h-[70vh] rounded-t-3xl',
          // Desktop: left side panel — w-80 matches StationSearchPanel width and
          // gives date inputs enough horizontal room
          'md:bottom-auto md:left-0 md:right-auto md:top-0 md:h-full md:w-80 md:rounded-none',
          // Animation
          isOpen
            ? 'translate-y-0 md:translate-x-0 md:translate-y-0'
            : 'translate-y-full md:-translate-x-full md:translate-y-0',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Options Filter
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {!filter.visible ? (
                <>Estações ocultas</>
              ) : filteredCount === totalCount ? (
                <>{totalCount} estações visíveis</>
              ) : (
                <>
                  <span className="font-semibold text-sky-600 dark:text-sky-400">
                    {filteredCount}
                  </span>{' '}
                  de {totalCount} estações
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
            aria-label="Fechar filtros"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
          {/* Master visibility switch */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="flex items-center gap-2">
              {filter.visible ? (
                <Eye className="h-4 w-4 text-sky-500" />
              ) : (
                <EyeOff className="h-4 w-4 text-slate-400" />
              )}
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                Exibir estações no mapa
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={filter.visible}
              onClick={() => update({ visible: !filter.visible })}
              className={clsx(
                'relative h-5 w-9 shrink-0 rounded-full transition',
                filter.visible
                  ? 'bg-sky-500'
                  : 'bg-slate-300 dark:bg-slate-600',
              )}
            >
              <span
                className={clsx(
                  'absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                  filter.visible ? 'translate-x-4' : 'translate-x-0',
                )}
              />
            </button>
          </div>

          <div
            className={clsx(
              'flex flex-col gap-5',
              !filter.visible && 'pointer-events-none opacity-40',
            )}
          >
            {/* Metric visualized (gauges + cluster aggregates, by median) */}
            <div>
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">
                Métrica visualizada
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {SWOT_METRIC_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => update({ metric: value })}
                    className={clsx(
                      'rounded-xl border px-2 py-2 text-xs font-medium transition',
                      filter.metric === value
                        ? 'border-sky-400 bg-sky-50 text-sky-700 dark:border-sky-500 dark:bg-sky-950/40 dark:text-sky-300'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-500">
                Clusters agregam pela mediana dos pontos, não pela média.
              </p>
            </div>

            {/* Direction */}
            <div>
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">
                Tendência
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {DIRECTION_OPTIONS.map(({ value, label, icon, iconClass }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => update({ direction: value })}
                    className={clsx(
                      'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition',
                      filter.direction === value
                        ? 'border-sky-400 bg-sky-50 text-sky-700 dark:border-sky-500 dark:bg-sky-950/40 dark:text-sky-300'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600',
                    )}
                  >
                    <span
                      className={clsx('text-[13px] leading-none', iconClass)}
                    >
                      {icon}
                    </span>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Change range */}
            <div>
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">
                Variação — Change (m)
              </p>
              <div className="flex items-end gap-2">
                <div className="flex flex-1 flex-col gap-1">
                  <span className="text-[10px] text-slate-400">Mín</span>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="—"
                    value={filter.changeMin ?? ''}
                    onChange={(e) =>
                      update({
                        changeMin:
                          e.target.value === ''
                            ? null
                            : parseFloat(e.target.value),
                      })
                    }
                    className={INPUT_CLASS}
                  />
                </div>
                <span className="mb-2 text-slate-300 dark:text-slate-600">
                  –
                </span>
                <div className="flex flex-1 flex-col gap-1">
                  <span className="text-[10px] text-slate-400">Máx</span>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="—"
                    value={filter.changeMax ?? ''}
                    onChange={(e) =>
                      update({
                        changeMax:
                          e.target.value === ''
                            ? null
                            : parseFloat(e.target.value),
                      })
                    }
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
            </div>

            {/* Date range */}
            <div>
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">
                Data da medição
              </p>
              <div className="flex items-end gap-2">
                <div className="flex flex-1 flex-col gap-1">
                  <span className="text-[10px] text-slate-400">De</span>
                  <input
                    type="date"
                    value={filter.dateFrom ?? ''}
                    max={filter.dateTo ?? undefined}
                    onChange={(e) =>
                      update({ dateFrom: e.target.value || null })
                    }
                    className={INPUT_CLASS}
                  />
                </div>
                <span className="mb-2 text-slate-300 dark:text-slate-600">
                  –
                </span>
                <div className="flex flex-1 flex-col gap-1">
                  <span className="text-[10px] text-slate-400">Até</span>
                  <input
                    type="date"
                    value={filter.dateTo ?? ''}
                    min={filter.dateFrom ?? undefined}
                    onChange={(e) => update({ dateTo: e.target.value || null })}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
            </div>

            {/* Station name search */}
            <div>
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">
                Buscar estação
              </p>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Nome da estação..."
                  value={filter.nameSearch}
                  onChange={(e) => update({ nameSearch: e.target.value })}
                  className={clsx(INPUT_CLASS, 'pl-8')}
                />
              </div>
            </div>

            {/* Spatial filter — matches against whatever rivers/basins are
                currently visible in the Camadas drawer. */}
            <div>
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">
                Filtro espacial
              </p>
              <div className="flex flex-col gap-1.5">
                {SPATIAL_MODE_OPTIONS.map(({ value, label }) => {
                  const disabled =
                    (value === 'nearRivers' && riverFeatures.length === 0) ||
                    (value === 'insideBasins' && basinFeatures.length === 0);

                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={disabled}
                      onClick={() => update({ spatialMode: value })}
                      className={clsx(
                        'flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-medium transition',
                        disabled
                          ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-600'
                          : filter.spatialMode === value
                            ? 'border-sky-400 bg-sky-50 text-sky-700 dark:border-sky-500 dark:bg-sky-950/40 dark:text-sky-300'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600',
                      )}
                    >
                      <span>{label}</span>
                      {value === 'nearRivers' && (
                        <span className="text-[10px] text-slate-400">
                          {riverFeatures.length} visíveis
                        </span>
                      )}
                      {value === 'insideBasins' && (
                        <span className="text-[10px] text-slate-400">
                          {basinFeatures.length} visíveis
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {filter.spatialMode === 'nearRivers' &&
                (riverFeatures.length > 0 ? (
                  <div className="mt-2.5 flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Distância máxima</span>
                      <span className="font-semibold text-sky-600 dark:text-sky-400">
                        {filter.riverProximityKm} km
                      </span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={100}
                      step={5}
                      value={filter.riverProximityKm}
                      onChange={(e) => update({ riverProximityKm: Number(e.target.value) })}
                      className="w-full accent-sky-500"
                    />
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
                    Ative a camada de Rios no menu Camadas para usar este filtro.
                  </p>
                ))}

              {filter.spatialMode === 'insideBasins' && basinFeatures.length === 0 && (
                <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
                  Ative a camada de Bacias no menu Camadas para usar este filtro.
                </p>
              )}
            </div>
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
              Limpar filtros
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
