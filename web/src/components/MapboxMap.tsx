'use client';

import { useRef, useEffect, useCallback, type ReactNode } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { MapStylePreference, Station } from '@/lib/strapi';

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
  children?: ReactNode;
}

const SOURCE_ID = 'stations-source';
const LAYER_ID = 'stations-layer';
const TILE_SOURCE_ID = 'raster-tile-source';
const TILE_LAYER_ID = 'raster-tile-layer';

const MAPBOX_STYLE_URLS: Record<MapStylePreference, string> = {
  outdoors: 'mapbox://styles/mapbox/outdoors-v12',
  streets: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
};

export default function MapboxMap({
  initialViewState = { longitude: -52, latitude: -15, zoom: 4 },
  mapStyle = 'outdoors',
  stations = [],
  onStationDoubleClick,
  tileLayerUrl,
  tileLayerOpacity = 0.7,
  tileLayerBounds,
  fitToTileLayerBounds = false,
  children,
}: MapboxMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const onDoubleClickRef = useRef(onStationDoubleClick);

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
      ...(tileLayerBounds ? { bounds: tileLayerBounds } : {}),
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
  }, [tileLayerBounds, tileLayerUrl]);

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

    if (!map || !tileLayerBounds || !fitToTileLayerBounds) {
      return;
    }

    map.fitBounds(
      [
        [tileLayerBounds[0], tileLayerBounds[1]],
        [tileLayerBounds[2], tileLayerBounds[3]],
      ],
      {
        padding: 64,
        duration: 700,
        maxZoom: 10,
      },
    );
  }, [fitToTileLayerBounds, tileLayerBounds, tileLayerUrl]);

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
    </div>
  );
}
