'use client';

import { useRef, useEffect, useCallback, useMemo, useState, type ReactNode } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { MapStylePreference, Station, SwotGaugeFeature } from '@/lib/strapi';
import StationDetailsModal from '@/components/maps/StationDetailsModal';
import type { StationPopupData } from '@/components/maps/StationPopup';
import type { RiverFeature, BasinFeature } from '@/components/maps/LayersDrawer';
import { RAIN_COLOR_STOPS } from '@/components/maps/useMockRainHeatmap';
import {
  addStationLayers,
  attachStationLayerInteractions,
  updateStationLayerData,
  STATION_CLUSTERS_LAYER_ID,
} from '@/components/maps/stationClusterLayer';
import { SwotGaugeClusterLayer } from '@/components/maps/swotGaugeClusterLayer';
import type { SwotMetric } from '@/components/maps/SwotFilterDrawer';
import {
  addCrossSectionLayers,
  attachCrossSectionLayerInteractions,
  updateCrossSectionLayerData,
} from '@/components/maps/crossSectionClusterLayer';
import type { CrossSectionFeature } from '@/components/maps/crossSectionClusterLayer';
import CrossSectionModal from '@/components/maps/CrossSectionModal';

export interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
}

/**
 * Minimal, Mapbox-gl based map used in dashboard climate layer previews
 * and other light-weight map contexts.
 *
 * The optional raster-related props are used by the public forecast drawer and
 * dashboard climate previews to place a TiTiler-backed overlay above the base
 * style without introducing a second map abstraction.
 */
export interface MapboxMapProps {
  initialViewState?: ViewState;
  mapStyle?: MapStylePreference;
  stations?: Station[];
  onStationDoubleClick?: (station: Station) => void;
  /** URL template for the raster tile source rendered above the basemap. */
  tileLayerUrl?: string;
  /** Opacity applied to the raster overlay layer. */
  tileLayerOpacity?: number;
  /** Optional geographic bounds used when registering the raster source. */
  tileLayerBounds?: [number, number, number, number];
  /** Whether the map should fit to the raster bounds when the overlay changes. */
  fitToTileLayerBounds?: boolean;
  /** Latest SWOT node/gauge readings rendered as colorized triangles. */
  swotGaugeFeatures?: SwotGaugeFeature[];
  /** Which property drives gauge/cluster color, shape, and label — see SwotFilterDrawer. */
  swotMetric?: SwotMetric;
  /** Rivers to render as line features, already filtered by the layers drawer. */
  riverFeatures?: RiverFeature[];
  /** Sub-basins to render as filled polygons, already filtered by the layers drawer. */
  basinFeatures?: BasinFeature[];
  /** River cross-section (transversal section) points, see crossSectionClusterLayer.ts. */
  crossSectionFeatures?: CrossSectionFeature[];
  children?: ReactNode;
}

const TILE_SOURCE_ID = 'raster-tile-source';
const TILE_LAYER_ID = 'raster-tile-layer';
const RIVERS_SOURCE_ID = 'rivers-source';
const RIVERS_LAYER_ID = 'rivers-layer';
const BASINS_SOURCE_ID = 'basins-source';
const BASINS_FILL_LAYER_ID = 'basins-fill-layer';
const BASINS_LINE_LAYER_ID = 'basins-line-layer';


const MAPBOX_STYLE_URLS: Record<MapStylePreference, string> = {
  outdoors: 'mapbox://styles/mapbox/outdoors-v12',
  streets: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
};

interface GaugePopupState {
  feature: SwotGaugeFeature;
}

interface CrossSectionPopupState {
  feature: CrossSectionFeature;
}

export default function MapboxMap({
  initialViewState = { longitude: -52, latitude: -15, zoom: 4 },
  mapStyle = 'outdoors',
  stations = [],
  onStationDoubleClick,
  tileLayerUrl,
  tileLayerOpacity = 0.7,
  tileLayerBounds,
  fitToTileLayerBounds = false,
  swotGaugeFeatures = [],
  swotMetric = 'Change',
  riverFeatures = [],
  basinFeatures = [],
  crossSectionFeatures = [],
  children,
}: MapboxMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const swotLayerRef = useRef<SwotGaugeClusterLayer | null>(null);
  const onDoubleClickRef = useRef(onStationDoubleClick);
  // Read from the double-click handler registered once on map load, so it
  // always sees the latest stations prop instead of closing over the array
  // from mount time.
  const stationsRef = useRef(stations);
  const [gaugePopup, setGaugePopup] = useState<GaugePopupState | null>(null);
  const [gaugeModal, setGaugeModal] = useState<StationPopupData | null>(null);
  const [crossSectionPopup, setCrossSectionPopup] = useState<CrossSectionPopupState | null>(null);
  const [crossSectionModalFeature, setCrossSectionModalFeature] = useState<CrossSectionFeature | null>(null);
  // Tracks the map's 'load' event as React state (rather than only checking
  // map.isStyleLoaded() imperatively) so effects that push river/basin data
  // into their sources re-run once the style finishes loading, even if the
  // props they depend on last changed before that point (e.g. rivers/basins
  // starting hidden and only becoming visible much later via a user toggle).
  const [mapLoaded, setMapLoaded] = useState(false);

  const validTileLayerBounds = useMemo(() => {
    if (!tileLayerBounds || tileLayerBounds.length < 4) return undefined;
    const [minLng, minLat, maxLng, maxLat] = tileLayerBounds;
    if (!Number.isFinite(minLng) || !Number.isFinite(minLat) || !Number.isFinite(maxLng) || !Number.isFinite(maxLat)) {
      return undefined;
    }
    return [
      minLng,
      Math.max(-89.999, Math.min(89.999, minLat)),
      maxLng,
      Math.max(-89.999, Math.min(89.999, maxLat)),
    ] as [number, number, number, number];
  }, [tileLayerBounds]);

  useEffect(() => {
    onDoubleClickRef.current = onStationDoubleClick;
  }, [onStationDoubleClick]);

  useEffect(() => {
    stationsRef.current = stations;
  }, [stations]);

  const flyTo = useCallback((vs: ViewState) => {
    mapRef.current?.flyTo({ center: [vs.longitude, vs.latitude], zoom: vs.zoom });
  }, []);

  // Initialise map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';
    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAPBOX_STYLE_URLS[mapStyle],
      center: [initialViewState.longitude, initialViewState.latitude],
      zoom: initialViewState.zoom,
      attributionControl: true,
    });

    // Add NavigationControl with extra padding to avoid overlaying custom buttons
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.addControl(
      new mapboxgl.ScaleControl({ unit: 'metric' }),
      'bottom-right',
    );

    map.on('load', () => {
      // Sub-basin polygons — drawn first so rivers and stations render above them.
      map.addSource(BASINS_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        promoteId: 'id',
      });
      map.addLayer({
        id: BASINS_FILL_LAYER_ID,
        type: 'fill',
        source: BASINS_SOURCE_ID,
        paint: {
          // Mock rain choropleth — mirrors RAIN_COLOR_STOPS in useMockRainHeatmap.ts.
          'fill-color': [
            'interpolate',
            ['linear'],
            ['coalesce', ['get', 'rainMm'], 0],
            ...RAIN_COLOR_STOPS.flat(),
          ] as unknown as mapboxgl.ExpressionSpecification,
          'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.85, 0.65],
        },
      });
      map.addLayer({
        id: BASINS_LINE_LAYER_ID,
        type: 'line',
        source: BASINS_SOURCE_ID,
        paint: {
          'line-color': '#0c4a6e',
          'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 2.5, 1.25],
        },
      });

      // Rivers GeoJSON source
      map.addSource(RIVERS_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: RIVERS_LAYER_ID,
        type: 'line',
        source: RIVERS_SOURCE_ID,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#2196F3',
          'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1.5, 10, 3.5],
        },
      });

      let hoveredBasinId: string | number | undefined;

      map.on('mousemove', BASINS_FILL_LAYER_ID, (e) => {
        if (!e.features?.length) return;
        map.getCanvas().style.cursor = 'pointer';

        const id = e.features[0].id;
        if (id === undefined) return;

        if (hoveredBasinId !== undefined && hoveredBasinId !== id) {
          map.setFeatureState({ source: BASINS_SOURCE_ID, id: hoveredBasinId }, { hover: false });
        }
        hoveredBasinId = id;
        map.setFeatureState({ source: BASINS_SOURCE_ID, id: hoveredBasinId }, { hover: true });
      });

      map.on('mouseleave', BASINS_FILL_LAYER_ID, () => {
        map.getCanvas().style.cursor = '';
        if (hoveredBasinId !== undefined) {
          map.setFeatureState({ source: BASINS_SOURCE_ID, id: hoveredBasinId }, { hover: false });
        }
        hoveredBasinId = undefined;
      });

      map.on('click', BASINS_FILL_LAYER_ID, (e) => {
        if (!e.features?.length) return;
        const props = e.features[0].properties as {
          DNS_NM: string;
          DNS_NU_SUB?: number;
          rainMm?: number;
        };

        popupRef.current?.remove();
        popupRef.current = new mapboxgl.Popup({ offset: 8 })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div class="p-2 text-sm">
              <strong class="block text-gray-900">${props.DNS_NM}</strong>
              ${props.DNS_NU_SUB !== undefined ? `<span class="block text-gray-500">Sub-bacia ANA ${props.DNS_NU_SUB}</span>` : ''}
              ${typeof props.rainMm === 'number' ? `<span class="mt-1 block font-medium text-sky-600">Chuva (mock): ${props.rainMm} mm</span>` : ''}
            </div>`,
          )
          .addTo(map);
      });

      map.on('mouseenter', RIVERS_LAYER_ID, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', RIVERS_LAYER_ID, () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('click', RIVERS_LAYER_ID, (e) => {
        if (!e.features?.length) return;
        const props = e.features[0].properties as { NAME: string; KILOMETERS?: number };

        popupRef.current?.remove();
        popupRef.current = new mapboxgl.Popup({ offset: 8 })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div class="p-2 text-sm">
              <strong class="block text-gray-900">${props.NAME}</strong>
              ${typeof props.KILOMETERS === 'number' ? `<span class="text-gray-500">${Math.round(props.KILOMETERS)} km</span>` : ''}
            </div>`,
          )
          .addTo(map);
      });

      // Stations: clustered source + cluster/point layers (see
      // stationClusterLayer.ts for why clustering exists and how it's tuned).
      addStationLayers(map);
      attachStationLayerInteractions(map, {
        popupRef,
        onStationDoubleClick: (stationId) => {
          const station = stationsRef.current.find((s) => s.id === stationId);
          if (station) onDoubleClickRef.current?.(station);
        },
      });

      // SWOT gauges: same spatial clustering approach as stations, but
      // driven manually via `supercluster` directly (see
      // swotGaugeClusterLayer.ts) so cluster values can be an exact
      // median instead of a Mapbox-native incremental sum/mean.
      swotLayerRef.current = new SwotGaugeClusterLayer(map, {
        onGaugeClick: (feature) => {
          setGaugePopup({ feature });
        },
      });

      // River cross-section points (transversal sections): same native
      // Mapbox clustering as stations (see crossSectionClusterLayer.ts) --
      // no aggregate value is displayed per cluster, just a count, so the
      // simpler cluster: true approach fits, unlike the SWOT gauge layer.
      addCrossSectionLayers(map);
      attachCrossSectionLayerInteractions(map, {
        onSectionClick: (feature) => {
          setCrossSectionPopup({ feature });
        },
      });

      setMapLoaded(true);
    });

    mapRef.current = map;

    return () => {
      popupRef.current?.remove();
      swotLayerRef.current?.destroy();
      swotLayerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // initialViewState and mapStyle intentionally omitted – only used on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update GeoJSON when stations change. Depends on `mapLoaded` (React
  // state set once on the map's 'load' event) rather than checking
  // `map.isStyleLoaded()` imperatively -- that check has no retry, so if
  // `stations` resolved before the style finished loading, the source
  // would silently stay empty forever. See the equivalent river/basin/
  // raster fixes elsewhere in this file for the same bug class.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    updateStationLayerData(map, stations);
  }, [stations, mapLoaded]);

  // Update cross-section points when the source data changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    updateCrossSectionLayerData(map, crossSectionFeatures);
  }, [crossSectionFeatures, mapLoaded]);

  // Update rivers GeoJSON when the layers drawer selection changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const source = map.getSource(RIVERS_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;

    source.setData({ type: 'FeatureCollection', features: riverFeatures });
  }, [riverFeatures, mapLoaded]);

  // Update sub-basin GeoJSON when the layers drawer selection changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const source = map.getSource(BASINS_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;

    source.setData({ type: 'FeatureCollection', features: basinFeatures });
  }, [basinFeatures, mapLoaded]);

  // Update SWOT gauge data when features change (see the mapLoaded comment
  // above the equivalent station effect for why this depends on mapLoaded
  // rather than checking map.isStyleLoaded() imperatively).
  useEffect(() => {
    if (!mapLoaded) return;
    swotLayerRef.current?.setFeatures(swotGaugeFeatures);
  }, [swotGaugeFeatures, mapLoaded]);

  // Switching the visualized metric doesn't need to reload the spatial
  // index, just recompute displayed values -- see setMetric's own comment.
  useEffect(() => {
    if (!mapLoaded) return;
    swotLayerRef.current?.setMetric(swotMetric);
  }, [swotMetric, mapLoaded]);

  // Rebuild the raster source only when the URL template or bounds change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (!tileLayerUrl) {
      if (map.getLayer(TILE_LAYER_ID)) {
        map.removeLayer(TILE_LAYER_ID);
      }

      if (map.getSource(TILE_SOURCE_ID)) {
        map.removeSource(TILE_SOURCE_ID);
      }

      return;
    }

    if (map.getLayer(TILE_LAYER_ID)) {
      map.removeLayer(TILE_LAYER_ID);
    }

    if (map.getSource(TILE_SOURCE_ID)) {
      map.removeSource(TILE_SOURCE_ID);
    }

    map.addSource(TILE_SOURCE_ID, {
      type: 'raster',
      tiles: [tileLayerUrl],
      tileSize: 256,
      ...(validTileLayerBounds ? { bounds: validTileLayerBounds } : {}),
    });
    map.addLayer(
      {
        id: TILE_LAYER_ID,
        type: 'raster',
        source: TILE_SOURCE_ID,
        paint: { 'raster-opacity': tileLayerOpacity },
      },
      // Insert below the station layers (cluster circles are the first of
      // the three) so stations always render above the raster overlay.
      STATION_CLUSTERS_LAYER_ID,
    );
  }, [validTileLayerBounds, tileLayerUrl, mapLoaded]);

  // Opacity-only changes can be applied in place without re-requesting tiles.
  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapLoaded || !map.getLayer(TILE_LAYER_ID)) {
      return;
    }

    map.setPaintProperty(
      TILE_LAYER_ID,
      'raster-opacity',
      tileLayerOpacity,
    );
  }, [tileLayerOpacity, mapLoaded]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !validTileLayerBounds || !fitToTileLayerBounds) {
      return;
    }

    map.fitBounds(
      [
        [validTileLayerBounds[0], validTileLayerBounds[1]],
        [validTileLayerBounds[2], validTileLayerBounds[3]],
      ],
      {
        padding: 64,
        duration: 700,
        maxZoom: 10,
      },
    );
  }, [fitToTileLayerBounds, validTileLayerBounds, tileLayerUrl]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    flyTo(initialViewState);
  }, [flyTo, initialViewState]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="map-container h-full w-full" />
      {/* Push the zoom/compass control down clear of the stacked Home/Dashboard
          and Camadas buttons, with a small gap on top of that so they don't
          sit flush against each other. A bit more breathing room on desktop. */}
      <style>{`
        .mapboxgl-ctrl-top-right {
          top: 8.5rem !important;
          right: 1rem !important;
        }
        @media (min-width: 768px) {
          .mapboxgl-ctrl-top-right {
            top: 9rem !important;
            right: 1.25rem !important;
          }
        }
      `}</style>
      {children}

      {gaugePopup !== null && (() => {
        const p = gaugePopup.feature.properties;
        const hasChange = typeof p.Change === 'number';
        const changePositive = hasChange && (p.Change as number) >= 0;

        return (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setGaugePopup(null)}
          >
            <div
              className="pointer-events-auto w-72 max-w-full overflow-hidden rounded-2xl border border-white/20 bg-white/95 shadow-2xl ring-1 ring-black/5 backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-900/95"
              onClick={(e) => e.stopPropagation()}
            >

              {/* Header */}
              <div className="relative bg-gradient-to-br from-sky-500 to-cyan-600 px-4 pb-3 pt-4">
                <button
                  onClick={() => setGaugePopup(null)}
                  className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-white/80 transition hover:bg-white/35 hover:text-white"
                  aria-label="Fechar"
                >
                  <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M2 2l6 6M8 2l-6 6" />
                  </svg>
                </button>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">SWOT Gauge</p>
                <h3 className="mt-0.5 pr-6 text-sm font-bold leading-tight text-white">{p.Nome}</h3>
                <p className="mt-1 text-[11px] text-white/60">ID: {p.station_id}</p>
              </div>

              {/* Change highlight */}
              <div className={`flex items-center gap-3 px-4 py-3 ${changePositive ? 'bg-emerald-50 dark:bg-emerald-950/30' : hasChange ? 'bg-red-50 dark:bg-red-950/20' : 'bg-gray-50 dark:bg-slate-800/40'}`}>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm ${changePositive ? 'bg-emerald-500' : hasChange ? 'bg-red-500' : 'bg-gray-400'}`}>
                  {hasChange ? (changePositive ? '▲' : '▼') : '—'}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-slate-400">Variação</p>
                  <p className={`text-lg font-bold leading-none ${changePositive ? 'text-emerald-600 dark:text-emerald-400' : hasChange ? 'text-red-500 dark:text-red-400' : 'text-gray-400'}`}>
                    {hasChange ? `${(p.Change as number) >= 0 ? '+' : ''}${(p.Change as number).toFixed(2)} m` : '—'}
                  </p>
                </div>
              </div>

              {/* Data rows */}
              <div className="divide-y divide-gray-100 dark:divide-slate-800">
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-xs text-gray-500 dark:text-slate-400">Mediana</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {typeof p.median === 'number' ? `${p.median.toFixed(3)} m` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-xs text-gray-500 dark:text-slate-400">Desvio padrão</span>
                  <span className="text-xs text-slate-600 dark:text-slate-300">
                    {typeof p.std === 'number' ? `± ${p.std.toFixed(4)} m` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-xs text-gray-500 dark:text-slate-400">Variação/dia</span>
                  <span className={`text-xs font-medium ${typeof p.Change_day === 'number' && p.Change_day >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                    {typeof p.Change_day === 'number' ? `${p.Change_day >= 0 ? '+' : ''}${p.Change_day.toFixed(3)} m/dia` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-xs text-gray-500 dark:text-slate-400">Data</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">{p.date ?? '—'}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="flex flex-col gap-1 bg-gray-50 px-4 py-3 dark:bg-slate-800/50">
                {typeof p.delta_days === 'number' && (
                  <p className="text-[10px] text-gray-400 dark:text-slate-500">
                    Intervalo entre medições: {p.delta_days.toFixed(1)} dias
                  </p>
                )}
                <button
                  onClick={() => {
                    setGaugeModal({
                      name: p.Nome,
                      code: p.station_id,
                      latitude: p.latitude,
                      longitude: p.longitude,
                      value: typeof p.median === 'number' ? p.median : undefined,
                      change: typeof p.Change === 'number' ? p.Change : undefined,
                    });
                    setGaugePopup(null);
                  }}
                  className="mt-1 w-full rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700 active:scale-[0.98] dark:bg-sky-500 dark:hover:bg-sky-400"
                >
                  Ver detalhes da estação →
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {crossSectionPopup !== null && (() => {
        const p = crossSectionPopup.feature.properties;

        return (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setCrossSectionPopup(null)}
          >
            <div
              className="pointer-events-auto w-72 max-w-full overflow-hidden rounded-2xl border border-white/20 bg-white/95 shadow-2xl ring-1 ring-black/5 backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-900/95"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="relative bg-gradient-to-br from-amber-500 to-orange-600 px-4 pb-3 pt-4">
                <button
                  onClick={() => setCrossSectionPopup(null)}
                  className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-white/80 transition hover:bg-white/35 hover:text-white"
                  aria-label="Fechar"
                >
                  <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M2 2l6 6M8 2l-6 6" />
                  </svg>
                </button>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">Seção transversal</p>
                <h3 className="mt-0.5 pr-6 text-sm font-bold leading-tight text-white">Nó SWORD {p.sword_node_id}</h3>
                <p className="mt-1 text-[11px] text-white/60">FID: {p.fid}</p>
              </div>

              {/* Data rows */}
              <div className="divide-y divide-gray-100 dark:divide-slate-800">
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-xs text-gray-500 dark:text-slate-400">Largura (SWORD)</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {p.sword_width.toFixed(0)} m
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-xs text-gray-500 dark:text-slate-400">Distância da foz</span>
                  <span className="text-xs text-slate-600 dark:text-slate-300">
                    {(p.sword_dist_out / 1000).toFixed(1)} km
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-xs text-gray-500 dark:text-slate-400">Reach SWORD</span>
                  <span className="text-xs text-slate-600 dark:text-slate-300">{p.sword_reach_id}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-4 py-3 dark:bg-slate-800/50">
                <button
                  onClick={() => {
                    setCrossSectionModalFeature(crossSectionPopup.feature);
                    setCrossSectionPopup(null);
                  }}
                  className="w-full rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-700 active:scale-[0.98] dark:bg-amber-500 dark:hover:bg-amber-400"
                >
                  Ver perfil da seção →
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <StationDetailsModal
        open={gaugeModal !== null}
        onOpenChange={(open) => { if (!open) setGaugeModal(null); }}
        data={gaugeModal}
      />

      <CrossSectionModal
        open={crossSectionModalFeature !== null}
        onOpenChange={(open) => { if (!open) setCrossSectionModalFeature(null); }}
        feature={crossSectionModalFeature}
      />
    </div>
  );
}
