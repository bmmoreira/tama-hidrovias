'use client';

import { useRef, useEffect, useCallback, useMemo, useState, type ReactNode } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { MapStylePreference, Station, SwotGaugeFeature } from '@/lib/strapi';
import StationDetailsModal from '@/components/maps/StationDetailsModal';
import type { StationPopupData } from '@/components/maps/StationPopup';

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
  children?: ReactNode;
}

const SOURCE_ID = 'stations-source';
const LAYER_ID = 'stations-layer';
const TILE_SOURCE_ID = 'raster-tile-source';
const TILE_LAYER_ID = 'raster-tile-layer';

// Magnitude (in the same unit as `Change`) at which the color spectrum
// reaches its most saturated value.
const SWOT_GAUGE_CHANGE_SCALE_MAX = 5;

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  return [
    parseInt(normalized.substring(0, 2), 16),
    parseInt(normalized.substring(2, 4), 16),
    parseInt(normalized.substring(4, 6), 16),
  ];
}

function interpolateColor(from: string, to: string, t: number): string {
  const clamped = Math.min(1, Math.max(0, t));
  const [r1, g1, b1] = hexToRgb(from);
  const [r2, g2, b2] = hexToRgb(to);

  const r = Math.round(r1 + (r2 - r1) * clamped);
  const g = Math.round(g1 + (g2 - g1) * clamped);
  const b = Math.round(b1 + (b2 - b1) * clamped);

  return `rgb(${r}, ${g}, ${b})`;
}

// No data → neutral gray. Otherwise, positive change ramps through a green
// spectrum and negative change (rendered as an inverted triangle) ramps
// through an orange/red spectrum, both scaled by magnitude.
function getSwotGaugeColor(change: number | null): string {
  if (typeof change !== 'number' || !Number.isFinite(change)) {
    return '#94a3b8';
  }

  const t = Math.abs(change) / SWOT_GAUGE_CHANGE_SCALE_MAX;

  return change < 0
    ? interpolateColor('#fed7aa', '#b91c1c', t)
    : interpolateColor('#bbf7d0', '#15803d', t);
}

// Builds an SVG triangle marker so the Change value can be rendered inside.
// A negative change uses a downward-pointing triangle (inverted) on an
// orange/red spectrum; positive uses upward on a green spectrum.
function createSwotGaugeElement(change: number | null): HTMLDivElement {
  const color = getSwotGaugeColor(change);
  const inverted = typeof change === 'number' && change < 0;

  const size = 58;
  const pad = 3;
  const mid = size / 2;
  const bottom = size - pad;

  // Upward triangle: apex top-centre, base at bottom.
  // Downward triangle: base at top, apex bottom-centre.
  const points = inverted
    ? `${pad},${pad} ${bottom},${pad} ${mid},${bottom}`
    : `${mid},${pad} ${pad},${bottom} ${bottom},${bottom}`;

  // Place the label in the widest part of the triangle (near the base).
  const textY = inverted ? Math.round(size * 0.28) : Math.round(size * 0.80);

  const label =
    typeof change === 'number'
      ? `${change >= 0 ? '+' : ''}${change.toFixed(1)}`
      : '–';

  const el = document.createElement('div');
  el.style.cursor = 'pointer';
  el.style.filter = 'drop-shadow(0 1px 2px rgba(0,0,0,0.45))';
  el.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <polygon points="${points}" fill="${color}" />
    <text
      x="${mid}"
      y="${textY}"
      text-anchor="middle"
      dominant-baseline="middle"
      font-size="12"
      font-weight="700"
      font-family="system-ui,-apple-system,sans-serif"
      fill="white"
      stroke="rgba(0,0,0,0.25)"
      stroke-width="2"
      paint-order="stroke"
      stroke-linejoin="round"
    >${label}</text>
  </svg>`;

  return el;
}

const MAPBOX_STYLE_URLS: Record<MapStylePreference, string> = {
  outdoors: 'mapbox://styles/mapbox/outdoors-v12',
  streets: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
};

interface GaugePopupState {
  feature: SwotGaugeFeature;
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
  children,
}: MapboxMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const onDoubleClickRef = useRef(onStationDoubleClick);
  const [gaugePopup, setGaugePopup] = useState<GaugePopupState | null>(null);
  const [gaugeModal, setGaugeModal] = useState<StationPopupData | null>(null);

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
      // Stations GeoJSON source
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4, 5,
            10, 10,
          ],
          'circle-color': [
            'match',
            ['get', 'source'],
            'ANA', '#2563eb',
            'HydroWeb', '#16a34a',
            'SNIRH', '#d97706',
            'Virtual', '#9333ea',
            '#6b7280',
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.9,
        },
      });

      // Click → show popup
      map.on('click', LAYER_ID, (e) => {
        if (!e.features?.length) return;
        const feature = e.features[0];
        const coords = (feature.geometry as GeoJSON.Point).coordinates as [
          number,
          number,
        ];
        const props = feature.properties as {
          name: string;
          code: string;
          source: string;
          basin: string;
        };

        popupRef.current?.remove();
        popupRef.current = new mapboxgl.Popup({ offset: 12 })
          .setLngLat(coords)
          .setHTML(
            `<div class="p-2 text-sm">
              <strong class="block text-gray-900">${props.name}</strong>
              <span class="text-gray-500">${props.code} · ${props.source}</span>
              <br/><span class="text-gray-500">Bacia: ${props.basin}</span>
              <p class="mt-1 text-xs text-blue-600">Duplo-clique para ver medições</p>
            </div>`,
          )
          .addTo(map);
      });

      // Double-click → callback
      map.on('dblclick', LAYER_ID, (e) => {
        e.preventDefault();
        if (!e.features?.length) return;
        const feature = e.features[0];
        const stationId = Number(feature.properties?.id);
        const station = stations.find((s) => s.id === stationId);
        if (station) onDoubleClickRef.current?.(station);
      });

      // Cursor changes
      map.on('mouseenter', LAYER_ID, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', LAYER_ID, () => {
        map.getCanvas().style.cursor = '';
      });

    });

    mapRef.current = map;

    return () => {
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
    // initialViewState and mapStyle intentionally omitted – only used on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update GeoJSON when stations change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;

    source.setData({
      type: 'FeatureCollection',
      features: stations.map((s) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [s.attributes.longitude, s.attributes.latitude],
        },
        properties: {
          id: s.id,
          name: s.attributes.name,
          code: s.attributes.code,
          source: s.attributes.source,
          basin: s.attributes.basin,
        },
      })),
    });
  }, [stations]);

  // Manage SWOT gauge DOM markers. Markers are independent of style-load
  // timing, so this effect runs as soon as the map is constructed and
  // feature data is available — no isStyleLoaded() gate needed.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const markers = swotGaugeFeatures.map((feature) => {
      const { Change } = feature.properties;
      const el = createSwotGaugeElement(Change);

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat(feature.geometry.coordinates)
        .addTo(map);

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setGaugePopup({ feature });
      });

      return marker;
    });

    return () => {
      markers.forEach((marker) => marker.remove());
    };
  }, [swotGaugeFeatures]);

  // Rebuild the raster source only when the URL template or bounds change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

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
      LAYER_ID,
    );
  }, [validTileLayerBounds, tileLayerUrl]);

  // Opacity-only changes can be applied in place without re-requesting tiles.
  useEffect(() => {
    const map = mapRef.current;

    if (!map || !map.isStyleLoaded() || !map.getLayer(TILE_LAYER_ID)) {
      return;
    }

    map.setPaintProperty(
      TILE_LAYER_ID,
      'raster-opacity',
      tileLayerOpacity,
    );
  }, [tileLayerOpacity]);

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
      {/* Add a style block to pad the mapboxgl-ctrl-top-right container */}
      <style>{`
        .mapboxgl-ctrl-top-right {
          top: 88px !important;
          right: 8px !important;
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

      <StationDetailsModal
        open={gaugeModal !== null}
        onOpenChange={(open) => { if (!open) setGaugeModal(null); }}
        data={gaugeModal}
      />
    </div>
  );
}
