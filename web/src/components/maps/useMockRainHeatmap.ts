'use client';

import { useMemo } from 'react';
import type { BasinFeature } from './LayersDrawer';

export const MOCK_RAIN_MIN_MM = 0;
export const MOCK_RAIN_MAX_MM = 300;

/** Color ramp stops (mm → color) shared by the map fill expression and the drawer legend. */
export const RAIN_COLOR_STOPS: [number, string][] = [
  [0, '#f0f9ff'],
  [60, '#a5d8ff'],
  [120, '#4dabf7'],
  [180, '#228be6'],
  [240, '#1864ab'],
  [300, '#0b3d6e'],
];

/** Deterministic 32-bit PRNG so the same seed always yields the same stream. */
function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Stands in for a future rainfall-by-basin data source: derives a stable
 * mm value per basin id (via a seeded PRNG, not Math.random) so the
 * choropleth fill stays put across re-renders instead of flickering.
 */
export function useMockRainHeatmap(basinFeatures: BasinFeature[]): BasinFeature[] {
  return useMemo(
    () =>
      basinFeatures.map((feature) => {
        const random = mulberry32(feature.properties.id * 2654435761);
        const rainMm = Math.round(
          MOCK_RAIN_MIN_MM + random() * (MOCK_RAIN_MAX_MM - MOCK_RAIN_MIN_MM),
        );

        return {
          ...feature,
          properties: { ...feature.properties, rainMm },
        };
      }),
    [basinFeatures],
  );
}
