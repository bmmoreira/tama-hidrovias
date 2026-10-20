'use client';

import { Waves } from 'lucide-react';
import { useTranslation } from '@/lib/use-app-translation';
import type { ForecastOverlayConfig } from './ForecastDrawer';
import {
  CROSS_SECTION_COLOR_LOW,
  CROSS_SECTION_COLOR_HIGH,
  CROSS_SECTION_METRIC_OPTIONS,
  type CrossSectionFeature,
  type CrossSectionMetric,
} from './crossSectionClusterLayer';

export interface ForecastLegendProps {
  overlay?: ForecastOverlayConfig;
  drawerOpen?: boolean;
  hasSwotGauges?: boolean;
  /** Currently loaded cross-section points -- used only to compute the
   *  legend's min/max labels for whichever metric is selected; pass [] or
   *  omit to hide this legend section entirely. */
  crossSectionFeatures?: CrossSectionFeature[];
  crossSectionMetric?: CrossSectionMetric;
}

const LEGEND_VALUES = Array.from({ length: 15 }, (_, i) => 15 - i) as number[];

const COLOR_MAP_GRADIENTS: Record<string, string> = {
  viridis: 'linear-gradient(to top, #440154 0%, #3b528b 22%, #21918c 48%, #5ec962 74%, #fde725 100%)',
  plasma: 'linear-gradient(to top, #0d0887 0%, #7e03a8 26%, #cc4778 52%, #f89441 78%, #f0f921 100%)',
  inferno: 'linear-gradient(to top, #000004 0%, #420a68 25%, #932667 50%, #dd513a 75%, #fcffa4 100%)',
  magma: 'linear-gradient(to top, #000004 0%, #3b0f70 24%, #8c2981 48%, #de4968 74%, #fcfdbf 100%)',
  cividis: 'linear-gradient(to top, #00204c 0%, #424d73 24%, #6c7b6f 48%, #9bac63 72%, #fee838 100%)',
  turbo: 'linear-gradient(to top, #30123b 0%, #4666ff 20%, #1bcfd4 40%, #8fff65 60%, #ffb000 80%, #7a0403 100%)',
  rainbow: 'linear-gradient(to top, #c9302c 0%, #f28c28 20%, #f5d332 40%, #1fa64a 60%, #1d6fd6 80%, #0b3c8c 100%)',
  blues: 'linear-gradient(to top, #08306b 0%, #2171b5 25%, #4292c6 50%, #6baed6 75%, #c6dbef 100%)',
};

function getGradient(colorMap?: string) {
  return COLOR_MAP_GRADIENTS[colorMap ?? ''] ?? COLOR_MAP_GRADIENTS.viridis;
}

function TriangleUp({ color, size = 14 }: { color: string; size?: number }) {
  const h = Math.round(size * 0.86);
  return (
    <svg width={size} height={h} viewBox={`0 0 ${size} ${h}`} xmlns="http://www.w3.org/2000/svg">
      <polygon points={`${size / 2},0 0,${h} ${size},${h}`} fill={color} />
    </svg>
  );
}

function TriangleDown({ color, size = 14 }: { color: string; size?: number }) {
  const h = Math.round(size * 0.86);
  return (
    <svg width={size} height={h} viewBox={`0 0 ${size} ${h}`} xmlns="http://www.w3.org/2000/svg">
      <polygon points={`0,0 ${size},0 ${size / 2},${h}`} fill={color} />
    </svg>
  );
}

export default function ForecastLegend({
  overlay,
  drawerOpen = false,
  hasSwotGauges = false,
  crossSectionFeatures = [],
  crossSectionMetric = 'cota_leito_maxima',
}: ForecastLegendProps) {
  const { t } = useTranslation();

  const showForecast = !!(overlay?.tileLayerUrl && overlay.legendColorMap);
  const showCrossSection = crossSectionFeatures.length > 0;

  if (!showForecast && !hasSwotGauges && !showCrossSection) {
    return null;
  }

  const crossSectionValues = crossSectionFeatures
    .map((f) => f.properties[crossSectionMetric])
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const crossSectionMin = crossSectionValues.length ? Math.min(...crossSectionValues) : 0;
  const crossSectionMax = crossSectionValues.length ? Math.max(...crossSectionValues) : 0;
  const crossSectionMetricLabel =
    CROSS_SECTION_METRIC_OPTIONS.find((o) => o.value === crossSectionMetric)?.label ?? '';

  return (
    <div
      className={[
        'absolute z-20 flex flex-col gap-3 rounded-2xl bg-white/92 px-3 py-3 shadow-xl shadow-slate-950/10 backdrop-blur transition-all dark:bg-slate-900/92',
        drawerOpen
          ? 'right-3 top-24 sm:right-4 sm:top-28 md:bottom-4 md:right-[27.5rem] md:top-auto'
          : 'bottom-4 right-3 sm:bottom-4 sm:right-4',
      ].join(' ')}
    >
      {/* ── SWOT Gauge legend ── */}
      {hasSwotGauges && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            SWOT Gauges
          </p>

          {/* Positive change row */}
          <div className="flex items-center gap-2">
            <div className="flex w-5 shrink-0 justify-center">
              <TriangleUp color="#15803d" size={13} />
            </div>
            <div className="flex flex-col gap-0.5">
              <div
                className="h-2 w-28 rounded-full"
                style={{ background: 'linear-gradient(to right, #bbf7d0, #15803d)' }}
              />
              <div className="flex justify-between px-0.5">
                <span className="text-[9px] leading-none text-slate-400">0</span>
                <span className="text-[9px] leading-none text-slate-400">≥ +5 m</span>
              </div>
            </div>
          </div>

          {/* Negative change row (inverted triangle) */}
          <div className="flex items-center gap-2">
            <div className="flex w-5 shrink-0 justify-center">
              <TriangleDown color="#b91c1c" size={13} />
            </div>
            <div className="flex flex-col gap-0.5">
              <div
                className="h-2 w-28 rounded-full"
                style={{ background: 'linear-gradient(to right, #fed7aa, #b91c1c)' }}
              />
              <div className="flex justify-between px-0.5">
                <span className="text-[9px] leading-none text-slate-400">0</span>
                <span className="text-[9px] leading-none text-slate-400">≤ −5 m</span>
              </div>
            </div>
          </div>

          {/* No data row */}
          <div className="flex items-center gap-2">
            <div className="flex w-5 shrink-0 justify-center">
              <TriangleUp color="#94a3b8" size={13} />
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              Sem dados
            </span>
          </div>
        </div>
      )}

      {/* Divider between sections */}
      {hasSwotGauges && (showCrossSection || showForecast) && (
        <div className="h-px bg-slate-200 dark:bg-slate-700" />
      )}

      {/* ── Cross-section legend ── */}
      {showCrossSection && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            Seção Transversal
          </p>
          <div className="flex flex-col gap-0.5">
            <div
              className="h-2 w-28 rounded-full"
              style={{ background: `linear-gradient(to right, ${CROSS_SECTION_COLOR_LOW}, ${CROSS_SECTION_COLOR_HIGH})` }}
            />
            <div className="flex justify-between px-0.5">
              <span className="text-[9px] leading-none text-slate-400">
                {crossSectionMin.toFixed(0)} m
              </span>
              <span className="text-[9px] leading-none text-slate-400">
                {crossSectionMax.toFixed(0)} m
              </span>
            </div>
          </div>
          <p className="text-[9px] leading-tight text-slate-400 dark:text-slate-500">
            {crossSectionMetricLabel}
          </p>
        </div>
      )}

      {showCrossSection && showForecast && (
        <div className="h-px bg-slate-200 dark:bg-slate-700" />
      )}

      {/* ── Forecast colormap legend ── */}
      {showForecast && (
        <div className="flex items-stretch gap-2 sm:gap-3">
          <div className="flex min-w-0 items-center">
            <div
              className="hidden text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600 sm:flex sm:text-[11px] dark:text-slate-400"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
              {t('forecastDrawer.legendLabel')}
            </div>
          </div>

          <div className="flex items-start gap-2">
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1 text-[10px] font-semibold text-sky-900 dark:text-sky-400 sm:text-xs">
                <Waves className="h-3.5 w-3.5" />
                <span>{t('forecastDrawer.legendTitle')}</span>
              </div>

              <div
                className="relative h-28 w-2 rounded-full border border-white/70 shadow-inner sm:h-44 sm:w-4"
                style={{ background: getGradient(overlay.legendColorMap) }}
              >
                {(() => {
                  const max = Math.max(...LEGEND_VALUES);
                  const min = Math.min(...LEGEND_VALUES);

                  return LEGEND_VALUES.map((value) => {
                    const position = ((max - value) / (max - min)) * 100;
                    const isMajor = value === 1 || value % 5 === 0 || value === max;
                    const showOnXs = value === 1 || value === max;

                    return (
                      <div
                        key={value}
                        className="absolute left-full ml-1.5 flex -translate-y-1/2 items-center gap-1"
                        style={{ top: `${position}%` }}
                      >
                        <span className="h-px w-2 bg-slate-400" />
                        <span
                          className={`text-[9px] font-medium text-slate-700 dark:text-slate-300 sm:text-[11px] ${
                            isMajor ? (showOnXs ? 'inline' : 'hidden sm:inline') : 'hidden'
                          }`}
                        >
                          {String(value)}
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
