'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import clsx from 'clsx';
import { CloudRain, Loader2, Pause, Play, RefreshCw, X, Ship } from 'lucide-react';
import { DEFAULT_FORECAST_LAYER_SETTINGS, getRasterLayers, type AppSettings, type RasterLayer } from '@/lib/strapi';
import { getRasterLayerFileBaseName } from '@/lib/raster-layer-filename';
import { useTranslation } from '@/lib/use-app-translation';

type ForecastFrame = {
  area: string;
  slug: string;
  fileName: string;
  date: string;
  time: string;
  timestamp: string;
  label: string;
  tileUrl: string;
  metadataUrl: string;
};

type ForecastGroup = {
  area: string;
  frames: ForecastFrame[];
};

type ForecastResponse = {
  data: ForecastGroup[];
};

type ForecastFrameMetadataResponse = {
  data: {
    bounds: [number, number, number, number] | null;
    min: number | null;
    max: number | null;
    recommendedMin: number | null;
    recommendedMax: number | null;
    cogInfo?: any;
  };
};

/**
 * Raster overlay state emitted by the forecast drawer and consumed by the
 * shared map component.
 */
export type ForecastOverlayConfig = {
  tileLayerUrl?: string;
  tileLayerBounds?: [number, number, number, number];
  tileLayerOpacity?: number;
  fitToBounds?: boolean;
  legendColorMap?: ForecastColorMap;
};

/** Props for the public map forecast drawer. */
export interface ForecastDrawerProps {
  onTileLayerChange: (overlay?: ForecastOverlayConfig) => void;
  onOpenChange?: (isOpen: boolean) => void;
  appSettings?: AppSettings;
}

const fetcher = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to load forecast tiles.');
  }

  return (await response.json()) as ForecastResponse;
};

const fetchForecastMetadata = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to load forecast frame metadata.');
  }

  return (await response.json()) as ForecastFrameMetadataResponse;
};

/** Colormap options currently supported by the public forecast overlay UI. */
export const COLOR_MAP_OPTIONS = [
  'viridis',
  'plasma',
  'inferno',
  'magma',
  'cividis',
  'turbo',
  'rainbow',
  'blues',
] as const;

/** Supported TiTiler colormap names exposed by the public forecast UI. */
export type ForecastColorMap = (typeof COLOR_MAP_OPTIONS)[number];

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function mapPercentToValue(percent: number, min: number, max: number) {
  return min + ((max - min) * percent) / 100;
}

function mapValueToPercent(value: number, min: number, max: number) {
  if (max <= min) {
    return 0;
  }

  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function buildForecastTileUrl(
  frame: ForecastFrame,
  options: {
    colorMap: string;
    min?: number;
    max?: number;
  },
) {
  const params = new URLSearchParams({
    colormap: options.colorMap,
  });

  if (
    typeof options.min === 'number' &&
    typeof options.max === 'number' &&
    options.max > options.min
  ) {
    params.set('min', String(options.min));
    params.set('max', String(options.max));
  }
  
  params.set('_t', Date.now().toString());

  return `${frame.tileUrl}?${params.toString()}`;
}

function formatAreaLabel(area: string) {
  return area
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(' ');
}

  /** Compare raster bounds so identical overlay configs are not re-emitted. */
function areBoundsEqual(
  left?: [number, number, number, number],
  right?: [number, number, number, number],
) {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

/** Skip parent updates when the effective overlay config did not change. */
function areOverlayConfigsEqual(
  left?: ForecastOverlayConfig,
  right?: ForecastOverlayConfig,
) {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return (
    left.tileLayerUrl === right.tileLayerUrl &&
    left.tileLayerOpacity === right.tileLayerOpacity &&
    left.fitToBounds === right.fitToBounds &&
    left.legendColorMap === right.legendColorMap &&
    areBoundsEqual(left.tileLayerBounds, right.tileLayerBounds)
  );
}

/**
 * Drawer UI used on the public ``/map`` page to browse and animate forecast
 * GeoTIFF overlays served through the internal Next.js forecast routes.
 */
export default function ForecastDrawer({
  onTileLayerChange,
  onOpenChange,
  appSettings,
}: ForecastDrawerProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState(0);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  // Prevent the parent map from rebuilding the raster source for no-op updates.
  const lastOverlayRef = useRef<ForecastOverlayConfig>();

  const forecastDefaults = appSettings?.forecastLayer;
  const animationIntervalMs = forecastDefaults?.animationIntervalMs ?? DEFAULT_FORECAST_LAYER_SETTINGS.animationIntervalMs;

  const envColorMap = (process.env.NEXT_PUBLIC_FORECAST_COLORMAP as ForecastColorMap) || forecastDefaults?.colorMap || 'rainbow';
  const envOpacity = process.env.NEXT_PUBLIC_FORECAST_OPACITY ? Number(process.env.NEXT_PUBLIC_FORECAST_OPACITY) : (forecastDefaults?.opacity ?? 0.82);
  const envMin = process.env.NEXT_PUBLIC_FORECAST_MIN ? Number(process.env.NEXT_PUBLIC_FORECAST_MIN) : undefined;
  const envMax = process.env.NEXT_PUBLIC_FORECAST_MAX ? Number(process.env.NEXT_PUBLIC_FORECAST_MAX) : undefined;

  const { data, error, isLoading, mutate: refreshTiles } = useSWR('/api/forecast-tiles', fetcher, {
    revalidateOnFocus: false,
  });

  const groups = data?.data ?? [];
  const selectedGroup = useMemo(
    () => groups.find((group) => group.area === selectedArea) ?? groups[0] ?? null,
    [groups, selectedArea],
  );
  const frames = selectedGroup?.frames ?? [];
  const activeFrame =
    isEnabled && frames.length > 0
      ? frames[Math.min(selectedFrameIndex, frames.length - 1)]
      : null;
  const { data: frameMetadata, isLoading: isMetadataLoading } = useSWR(
    activeFrame?.metadataUrl ?? null,
    fetchForecastMetadata,
    {
      revalidateOnFocus: false,
    },
  );

  const { data: rasterLayersData } = useSWR('raster-layers', () => getRasterLayers(), {
    revalidateOnFocus: false,
  });

  // Index RasterLayer entries by file basename so the active frame's GeoTIFF
  // can be matched regardless of any directory prefix in `file_url`.
  const rasterLayerByFile = useMemo(() => {
    const map = new Map<string, RasterLayer>();
    for (const layer of rasterLayersData?.data ?? []) {
      map.set(getRasterLayerFileBaseName(layer.attributes.file_url), layer);
    }
    return map;
  }, [rasterLayersData]);

  const activeRasterLayer = activeFrame
    ? rasterLayerByFile.get(getRasterLayerFileBaseName(activeFrame.fileName))
    : undefined;

  // Colormap stretch range, preferring the curated values stored on the
  // matching RasterLayer entry over the on-the-fly TiTiler statistics.
  const resolvedMinValue =
    envMin ??
    (isFiniteNumber(activeRasterLayer?.attributes.computed_min)
      ? activeRasterLayer?.attributes.computed_min
      : undefined) ??
    frameMetadata?.data?.recommendedMin ??
    frameMetadata?.data?.min ??
    undefined;
  const resolvedMaxValue =
    envMax ??
    (isFiniteNumber(activeRasterLayer?.attributes.computed_max)
      ? activeRasterLayer?.attributes.computed_max
      : undefined) ??
    frameMetadata?.data?.recommendedMax ??
    frameMetadata?.data?.max ??
    undefined;

  useEffect(() => {
    if (!activeFrame) return;

    const fileName = getRasterLayerFileBaseName(activeFrame.fileName);
    const hasRasterLayerMatch =
      isFiniteNumber(activeRasterLayer?.attributes.computed_min) &&
      isFiniteNumber(activeRasterLayer?.attributes.computed_max);

    if (envMin !== undefined || envMax !== undefined) {
      console.log(
        `[ForecastDrawer] "${fileName}": using NEXT_PUBLIC_FORECAST_MIN/MAX override (min=${resolvedMinValue}, max=${resolvedMaxValue}).`,
      );
    } else if (hasRasterLayerMatch) {
      console.log(
        `[ForecastDrawer] "${fileName}": matched RasterLayer "${activeRasterLayer?.attributes.layer_id}" -- using computed_min/max from cog info (min=${resolvedMinValue}, max=${resolvedMaxValue}).`,
      );
    } else {
      console.log(
        `[ForecastDrawer] "${fileName}": no RasterLayer match -- using default TiTiler statistics (min=${resolvedMinValue}, max=${resolvedMaxValue}).`,
      );
    }
  }, [activeFrame, activeRasterLayer, resolvedMinValue, resolvedMaxValue, envMin, envMax]);

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    if (isOpen) {
      const totalFiles = groups.reduce((acc, group) => acc + group.frames.length, 0);
      console.log(`Number of files in assets/tiff folder: ${totalFiles}`);
    }
  }, [isOpen, groups]);

  useEffect(() => {
    if (groups.length === 0) {
      setSelectedArea(null);
      setSelectedFrameIndex(0);
      setIsEnabled(false);
      setIsPlaying(false);
      return;
    }

    if (!selectedArea || !groups.some((group) => group.area === selectedArea)) {
      setSelectedArea(groups[0].area);
      setSelectedFrameIndex(0);
    }
  }, [groups, selectedArea]);

  useEffect(() => {
    if (frames.length === 0) {
      setSelectedFrameIndex(0);
      setIsPlaying(false);
      return;
    }

    if (selectedFrameIndex >= frames.length) {
      setSelectedFrameIndex(0);
    }

    if (frames.length < 2) {
      setIsPlaying(false);
    }
  }, [frames.length, selectedFrameIndex]);

  useEffect(() => {
    if (!activeFrame || !isEnabled) {
      if (lastOverlayRef.current) {
        lastOverlayRef.current = undefined;
        onTileLayerChange(undefined);
      }
      return;
    }

    // Do not emit a new overlay if we are still fetching the initial metadata
    // for this frame. Emitting without metadata causes TiTiler to render
    // a solid color (unscaled) and aborts in-flight requests.
    if (!frameMetadata && isMetadataLoading) {
      return;
    }

    const metadata = frameMetadata?.data;

    const tileLayerUrl = buildForecastTileUrl(activeFrame, {
      colorMap: envColorMap,
      min: Number.isFinite(resolvedMinValue) ? resolvedMinValue : undefined,
      max: Number.isFinite(resolvedMaxValue) ? resolvedMaxValue : undefined,
    });

    console.log('[ForecastDrawer] TiTiler COG Info:', metadata?.cogInfo);
    console.log('[ForecastDrawer] Emitting new tile layer URL:', tileLayerUrl);

    const nextOverlay: ForecastOverlayConfig = {
      tileLayerUrl,
      tileLayerBounds: metadata?.bounds ?? undefined,
      tileLayerOpacity: envOpacity,
      fitToBounds: !isPlaying,
      legendColorMap: envColorMap,
    };

    if (areOverlayConfigsEqual(lastOverlayRef.current, nextOverlay)) {
      return;
    }

    lastOverlayRef.current = nextOverlay;

    onTileLayerChange(nextOverlay);
  }, [
    activeFrame,
    frameMetadata,
    isEnabled,
    isPlaying,
    onTileLayerChange,
    envOpacity,
    resolvedMaxValue,
    resolvedMinValue,
    envColorMap,
  ]);

  useEffect(() => {
    if (!isPlaying || frames.length < 2) {
      return;
    }

    const timer = window.setInterval(() => {
      setSelectedFrameIndex((currentIndex) => (currentIndex + 1) % frames.length);
    }, animationIntervalMs);

    return () => window.clearInterval(timer);
  }, [animationIntervalMs, frames.length, isPlaying]);

  const toggleDrawer = () => setIsOpen((currentValue) => !currentValue);

  const selectArea = (area: string) => {
    setSelectedArea(area);
    setSelectedFrameIndex(0);
    setIsEnabled(true);
    setIsPlaying(false);
  };

  const selectFrame = (frameIndex: number) => {
    setSelectedFrameIndex(frameIndex);
    setIsEnabled(true);
    setIsPlaying(false);
  };

  const clearOverlay = () => {
    setIsEnabled(false);
    setIsPlaying(false);
    setSelectedFrameIndex(0);
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/20 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2">
        <button
          type="button"
          onClick={toggleDrawer}
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/95 px-4 py-2 text-sm font-medium text-sky-900 shadow-lg shadow-sky-950/10 backdrop-blur transition hover:border-sky-300 hover:bg-white"
          aria-expanded={isOpen}
          aria-controls="forecast-drawer"
        >
          <Ship className="h-4 w-4" />
          <span>{t('forecastDrawer.button')}</span>
          {activeFrame ? (
            <span className="hidden rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700 sm:inline-flex">
              {formatAreaLabel(activeFrame.area)}
            </span>
          ) : null}
        </button>
      </div>

      <aside
        id="forecast-drawer"
        className={clsx(
          'fixed z-30 flex flex-col bg-white shadow-2xl transition-transform duration-300',
          'bottom-0 left-0 right-0 h-[72vh] rounded-t-3xl md:bottom-auto md:left-auto md:right-0 md:top-0 md:h-full md:w-[26rem] md:rounded-none',
          isOpen
            ? 'translate-y-0 md:translate-x-0'
            : 'translate-y-full md:translate-y-0 md:translate-x-full',
        )}
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {t('forecastDrawer.title')}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {t('forecastDrawer.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => refreshTiles()}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label={t('forecastDrawer.refresh') ?? 'Refresh'}
              title={t('forecastDrawer.refresh') ?? 'Refresh'}
            >
              <RefreshCw className={clsx('h-5 w-5', isLoading && 'animate-spin')} />
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label={t('forecastDrawer.close')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <section className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {t('forecastDrawer.activeLayer')}
            </p>
            <p className="mt-2 text-sm font-medium text-slate-900">
              {activeFrame?.label ?? t('forecastDrawer.noActiveLayer')}
            </p>
            {selectedGroup ? (
              <p className="mt-1 text-xs text-slate-500">
                {t('forecastDrawer.frameCount', {
                  count: selectedGroup.frames.length,
                })}
              </p>
            ) : null}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setIsPlaying((currentValue) => !currentValue)}
                disabled={!isEnabled || frames.length < 2}
                className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                <span>
                  {isPlaying
                    ? t('forecastDrawer.pause')
                    : t('forecastDrawer.play')}
                </span>
              </button>
              <button
                type="button"
                onClick={clearOverlay}
                disabled={!isEnabled}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:text-slate-400"
              >
                {t('forecastDrawer.clear')}
              </button>
            </div>
          </section>



          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {t('forecastDrawer.areas')}
            </p>
            {isLoading ? (
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t('forecastDrawer.loading')}</span>
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {t('forecastDrawer.loadError')}
              </div>
            ) : groups.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-500">
                {t('forecastDrawer.empty')}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {groups.map((group) => {
                  const isSelected = selectedGroup?.area === group.area;

                  return (
                    <button
                      key={group.area}
                      type="button"
                      onClick={() => selectArea(group.area)}
                      className={clsx(
                        'rounded-full border px-3 py-1.5 text-sm font-medium transition',
                        isSelected
                          ? 'border-sky-600 bg-sky-600 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                      )}
                    >
                      {formatAreaLabel(group.area)}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {t('forecastDrawer.frames')}
            </p>
            {selectedGroup ? (
              <div className="space-y-2">
                {selectedGroup.frames.map((frame, frameIndex) => {
                  const isFrameActive =
                    isEnabled && frameIndex === selectedFrameIndex;

                  return (
                    <button
                      key={frame.slug}
                      type="button"
                      onClick={() => selectFrame(frameIndex)}
                      className={clsx(
                        'flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition',
                        isFrameActive
                          ? 'border-sky-600 bg-sky-50 text-sky-900'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
                      )}
                    >
                      <div>
                        <p className="text-sm font-medium">{frame.label}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {frame.fileName}
                        </p>
                      </div>
                      {isFrameActive ? (
                        <span className="rounded-full bg-sky-600 px-2 py-0.5 text-xs font-semibold text-white">
                          {t('forecastDrawer.active')}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-500">
                {t('forecastDrawer.selectArea')}
              </div>
            )}
          </section>
        </div>
      </aside>
    </>
  );
}