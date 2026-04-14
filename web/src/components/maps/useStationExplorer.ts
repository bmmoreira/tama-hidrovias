'use client';

import { useCallback, useState } from 'react';
import type { Station, StationVariable } from '@/lib/strapi';

/** Options for configuring the station explorer controller hook. */
export interface UseStationExplorerOptions {
  onStationFocus?: (station: Station) => void;
  defaultVariable?: StationVariable;
}

export interface StationExplorerController {
  panelOpen: boolean;
  selectedStation: Station | null;
  activeVariable: StationVariable;
  detailOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  closeDetails: () => void;
  setActiveVariable: (variable: StationVariable) => void;
  focusStation: (station: Station) => void;
  selectStation: (station: Station) => void;
}

export function useStationExplorer({
  onStationFocus,
  defaultVariable = 'level_m',
}: UseStationExplorerOptions = {}): StationExplorerController {
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [activeVariable, setActiveVariable] = useState<StationVariable>(defaultVariable);
  const [detailOpen, setDetailOpen] = useState(false);

  const focusStation = useCallback(
    (station: Station) => {
      setSelectedStation(station);
      setActiveVariable(defaultVariable);
      setDetailOpen(true);
      onStationFocus?.(station);
    },
    [defaultVariable, onStationFocus],
  );

  const selectStation = useCallback(
    (station: Station) => {
      focusStation(station);
      setPanelOpen(false);
    },
    [focusStation],
  );

  return {
    panelOpen,
    selectedStation,
    activeVariable,
    detailOpen,
    openPanel: () => setPanelOpen(true),
    closePanel: () => setPanelOpen(false),
    closeDetails: () => setDetailOpen(false),
    setActiveVariable,
    focusStation,
    selectStation,
  };
}