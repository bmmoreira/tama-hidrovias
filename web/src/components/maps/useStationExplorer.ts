'use client';

import { useCallback, useState } from 'react';
import type { Station, StationVariable } from '@/lib/strapi';

export interface StationExplorerFeatureTarget {
  id: string;
  name: string;
  code?: string;
  fid?: string;
  longitude: number;
  latitude: number;
  source?: string;
  satellite?: string;
  river?: string;
  basin?: string;
  startDate?: string;
  endDate?: string;
  value?: number;
  change?: number;
  anomaly?: number;
}

/** Options for configuring the station explorer controller hook. */
export interface UseStationExplorerOptions {
  onStationFocus?: (station: Station) => void;
  onFeatureFocus?: (feature: StationExplorerFeatureTarget) => void;
  defaultVariable?: StationVariable;
}

export interface StationExplorerController {
  panelOpen: boolean;
  selectedStation: Station | null;
  selectedFeature: StationExplorerFeatureTarget | null;
  activeVariable: StationVariable;
  detailOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  closeDetails: () => void;
  setActiveVariable: (variable: StationVariable) => void;
  focusStation: (station: Station) => void;
  selectStation: (station: Station) => void;
  focusFeature: (feature: StationExplorerFeatureTarget) => void;
  selectFeature: (feature: StationExplorerFeatureTarget) => void;
}

export function useStationExplorer({
  onStationFocus,
  onFeatureFocus,
  defaultVariable = 'level_m',
}: UseStationExplorerOptions = {}): StationExplorerController {
  // The overlay does not keep its own UI state; this hook centralizes the
  // search panel, selected station, active chart variable, and detail drawer.
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [selectedFeature, setSelectedFeature] =
    useState<StationExplorerFeatureTarget | null>(null);
  const [activeVariable, setActiveVariable] = useState<StationVariable>(defaultVariable);
  const [detailOpen, setDetailOpen] = useState(false);

  const focusStation = useCallback(
    (station: Station) => {
      // Focus can be triggered from either the search panel or the map itself.
      // It opens the station details, resets the chart to the default variable,
      // and lets the page move the map camera through onStationFocus.
      setSelectedStation(station);
      setSelectedFeature(null);
      setActiveVariable(defaultVariable);
      setDetailOpen(true);
      onStationFocus?.(station);
    },
    [defaultVariable, onStationFocus],
  );

  const focusFeature = useCallback(
    (feature: StationExplorerFeatureTarget) => {
      // Feature collection results match SWOT Measurement rows by Codigo:
      // feature.code -> swot-measurement.station_id.
      setSelectedStation(null);
      setSelectedFeature(feature);
      setDetailOpen(true);
      onFeatureFocus?.(feature);
    },
    [onFeatureFocus],
  );

  const selectStation = useCallback(
    (station: Station) => {
      // A search result selection reuses the same focus behavior, then hides
      // the search panel so the selected station details are visible.
      focusStation(station);
      setPanelOpen(false);
    },
    [focusStation],
  );

  const selectFeature = useCallback(
    (feature: StationExplorerFeatureTarget) => {
      focusFeature(feature);
      setPanelOpen(false);
    },
    [focusFeature],
  );

  return {
    panelOpen,
    selectedStation,
    selectedFeature,
    activeVariable,
    detailOpen,
    // Fired by the "search stations" button in StationExplorerOverlay.
    openPanel: () => setPanelOpen(true),
    closePanel: () => setPanelOpen(false),
    closeDetails: () => setDetailOpen(false),
    setActiveVariable,
    focusStation,
    selectStation,
    focusFeature,
    selectFeature,
  };
}
