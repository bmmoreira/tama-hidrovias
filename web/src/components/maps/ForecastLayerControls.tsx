'use client';

import { Droplets, Palette, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from '@/lib/use-app-translation';

/** Analyst-only rendering controls for the public forecast overlay. */
export interface ForecastLayerControlsProps {
  colorMapOptions: readonly string[];
  selectedColorMap: string;
  opacity: number;
  resolvedMinValue?: number;
  resolvedMaxValue?: number;
  rangeMinPercent: number;
  rangeMaxPercent: number;
  onColorMapChange: (colorMap: string) => void;
  onOpacityChange: (opacity: number) => void;
  onRangeMinChange: (value: number) => void;
  onRangeMaxChange: (value: number) => void;
}

function formatSliderValue(value: number | undefined) {
  return typeof value === 'number' ? value.toFixed(2) : 'Auto';
}

/**
 * Isolated control surface for forecast styling so the drawer can hide the
 * entire block for non-analyst users.
 */
export default function ForecastLayerControls({
  colorMapOptions,
  selectedColorMap,
  opacity,
  resolvedMinValue,
  resolvedMaxValue,
  rangeMinPercent,
  rangeMaxPercent,
  onColorMapChange,
  onOpacityChange,
  onRangeMinChange,
  onRangeMaxChange,
}: ForecastLayerControlsProps) {
  const { t } = useTranslation();

  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Palette className="h-4 w-4" />
            {t('forecastDrawer.palette')}
          </label>
          <select
            value={selectedColorMap}
            onChange={(event) => onColorMapChange(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          >
            {colorMapOptions.map((colorMap) => (
              <option key={colorMap} value={colorMap}>
                {colorMap}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Droplets className="h-4 w-4" />
            {t('forecastDrawer.opacity')}: {Math.round(opacity * 100)}%
          </label>
          <input
            type="range"
            min="0.15"
            max="1"
            step="0.05"
            value={opacity}
            onChange={(event) => onOpacityChange(Number(event.target.value))}
            className="w-full accent-sky-600"
          />
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <SlidersHorizontal className="h-4 w-4" />
            {t('forecastDrawer.minValue')}: {formatSliderValue(resolvedMinValue)}
          </label>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={rangeMinPercent}
            onChange={(event) => onRangeMinChange(Number(event.target.value))}
            className="w-full accent-sky-600"
          />
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <SlidersHorizontal className="h-4 w-4" />
            {t('forecastDrawer.maxValue')}: {formatSliderValue(resolvedMaxValue)}
          </label>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={rangeMaxPercent}
            onChange={(event) => onRangeMaxChange(Number(event.target.value))}
            className="w-full accent-sky-600"
          />
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        {t('forecastDrawer.renderHint')}
      </p>
    </section>
  );
}