'use client';

import { Waves } from 'lucide-react';
import { useTranslation } from '@/lib/use-app-translation';
import type { ForecastOverlayConfig } from './ForecastDrawer';

export interface ForecastLegendProps {
  overlay?: ForecastOverlayConfig;
  drawerOpen?: boolean;
}

// Generate values 1..15 and display from max -> min (top -> bottom)
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
  if (!colorMap) {
    return COLOR_MAP_GRADIENTS.viridis;
  }

  return COLOR_MAP_GRADIENTS[colorMap] ?? COLOR_MAP_GRADIENTS.viridis;
}

export default function ForecastLegend({
  overlay,
  drawerOpen = false,
}: ForecastLegendProps) {
  const { t } = useTranslation();

  if (!overlay?.tileLayerUrl || !overlay.legendColorMap) {
    return null;
  }

  return (
    <div
      className={[
        'absolute z-20 flex items-stretch gap-2 rounded-2xl bg-white/92 px-2.5 py-3 shadow-xl shadow-slate-950/10 backdrop-blur transition-all sm:gap-3 sm:px-3',
        drawerOpen
          ? 'right-3 top-24 sm:right-4 sm:top-28 md:right-[27.5rem] md:bottom-4 md:top-auto'
          : 'bottom-4 right-3 sm:bottom-4 sm:right-4',
      ].join(' ')}
    >
      <div className="flex min-w-0 items-center">
        {/* hide the vertical label on very small screens to save space */}
        <div
          className="hidden text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600 sm:flex sm:text-[11px]"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          {t('forecastDrawer.legendLabel')}
        </div>
      </div>

      <div className="flex items-start gap-2">
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1 text-[10px] font-semibold text-sky-900 sm:text-xs">
            <Waves className="h-3.5 w-3.5" />
            <span>{t('forecastDrawer.legendTitle')}</span>
          </div>

          {/* compact on mobile: smaller height and width, expand on sm+ */}
          <div className="relative h-28 w-2 rounded-full border border-white/70 shadow-inner sm:h-44 sm:w-4" style={{ background: getGradient(overlay.legendColorMap) }}>
            {(() => {
              const max = Math.max(...LEGEND_VALUES);
              const min = Math.min(...LEGEND_VALUES);

              return LEGEND_VALUES.map((value) => {
                const position = ((max - value) / (max - min)) * 100;

                // Label strategy:
                // - show tick marks for all values
                // - label only the major ticks (1, 5, 10, 15)
                // - on extra-small screens show only 1 and 15 to reduce clutter
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
                      className={`text-[9px] font-medium text-slate-700 sm:text-[11px] ${
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
  );
}