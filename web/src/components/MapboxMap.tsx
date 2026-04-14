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
 */
export interface MapboxMapProps {
  initialViewState?: ViewState;
  mapStyle?: MapStylePreference;
  stations?: Station[];
  onStationDoubleClick?: (station: Station) => void;
  tileLayerUrl?: string;
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

  // Manage raster tile layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // Remove existing tile layer/source
    if (map.getLayer(TILE_LAYER_ID)) map.removeLayer(TILE_LAYER_ID);
    if (map.getSource(TILE_SOURCE_ID)) map.removeSource(TILE_SOURCE_ID);

    if (!tileLayerUrl) return;

    map.addSource(TILE_SOURCE_ID, {
      type: 'raster',
      tiles: [tileLayerUrl],
      tileSize: 256,
    });
    map.addLayer(
      {
        id: TILE_LAYER_ID,
        type: 'raster',
        source: TILE_SOURCE_ID,
        paint: { 'raster-opacity': 0.7 },
      },
      LAYER_ID, // insert below station circles
    );
  }, [tileLayerUrl]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    flyTo(initialViewState);
  }, [flyTo, initialViewState]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="map-container h-full w-full" />
      {children}
    </div>
  );
}
