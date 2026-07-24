import mapboxgl from 'mapbox-gl';
import type { Station } from '@/lib/strapi';

/**
 * Whether the station points layer (clusters + individual circles) renders
 * at all. Off by default: the underlying `Station` records currently come
 * from mock/placeholder data, not a real data source, unlike the SWOT gauge
 * features (a separate, similarly-clustered feature backed by real data --
 * see `swotGaugeClusterLayer.ts`). Flip
 * `NEXT_PUBLIC_SHOW_STATION_MARKERS=true` once real station data is wired
 * up; the clustering code itself needs no changes.
 */
export const SHOW_STATION_MARKERS = process.env.NEXT_PUBLIC_SHOW_STATION_MARKERS === 'true';

/**
 * Mapbox cluster radius in pixels for the station points layer. Tunable via
 * `NEXT_PUBLIC_STATION_CLUSTER_RADIUS` (defaults to 65) so the first paint
 * with hundreds of stations collapses nearby points into a single circle
 * instead of rendering one shape per station.
 */
export const STATION_CLUSTER_RADIUS = Number(process.env.NEXT_PUBLIC_STATION_CLUSTER_RADIUS) || 65;

/** Zoom level above which stations always render individually, never clustered. */
export const STATION_CLUSTER_MAX_ZOOM = 14;

export const STATION_SOURCE_ID = 'stations-source';
export const STATION_CLUSTERS_LAYER_ID = 'stations-clusters';
export const STATION_CLUSTER_COUNT_LAYER_ID = 'stations-cluster-count';
export const STATION_UNCLUSTERED_LAYER_ID = 'stations-unclustered-point';

/** GeoJSON feature properties carried by each unclustered station point. */
export interface StationFeatureProperties {
  id: number;
  name: string;
  code: string;
  source?: string;
  basin?: string;
}

export interface StationClusterHandlers {
  /** Called with the clicked station's Strapi id on double-click. */
  onStationDoubleClick: (stationId: number) => void;
  /** Popup shown on single-click; the layer owns its lifecycle through this ref. */
  popupRef: React.MutableRefObject<mapboxgl.Popup | null>;
}

/**
 * Registers the clustered station source and its three layers (cluster
 * circles, cluster count labels, individual station points) on `map`.
 *
 * Clustering keeps the first paint light: with hundreds of stations, one
 * circle per point is the single biggest render cost on initial load, so
 * nearby stations collapse into a single "N stations" circle until the
 * user zooms in past {@link STATION_CLUSTER_MAX_ZOOM}.
 */
export function addStationLayers(map: mapboxgl.Map): void {
  map.addSource(STATION_SOURCE_ID, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    cluster: true,
    clusterRadius: STATION_CLUSTER_RADIUS,
    clusterMaxZoom: STATION_CLUSTER_MAX_ZOOM,
  });

  map.addLayer({
    id: STATION_CLUSTERS_LAYER_ID,
    type: 'circle',
    source: STATION_SOURCE_ID,
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': ['step', ['get', 'point_count'], '#60a5fa', 10, '#3b82f6', 30, '#1d4ed8'],
      'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 30, 26],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
      'circle-opacity': 0.9,
    },
  });

  map.addLayer({
    id: STATION_CLUSTER_COUNT_LAYER_ID,
    type: 'symbol',
    source: STATION_SOURCE_ID,
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
      'text-size': 12,
    },
    paint: {
      'text-color': '#ffffff',
    },
  });

  map.addLayer({
    id: STATION_UNCLUSTERED_LAYER_ID,
    type: 'circle',
    source: STATION_SOURCE_ID,
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 5, 10, 10],
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
}

/**
 * Wires up cluster-expansion, popup, and double-click interactions for the
 * layers registered by {@link addStationLayers}.
 */
export function attachStationLayerInteractions(
  map: mapboxgl.Map,
  handlers: StationClusterHandlers,
): void {
  // Clicking a cluster zooms in just enough for it to break apart.
  map.on('click', STATION_CLUSTERS_LAYER_ID, (e) => {
    const [feature] = map.queryRenderedFeatures(e.point, { layers: [STATION_CLUSTERS_LAYER_ID] });
    const clusterId = feature?.properties?.cluster_id;
    if (clusterId === undefined) return;

    const source = map.getSource(STATION_SOURCE_ID) as mapboxgl.GeoJSONSource;
    source.getClusterExpansionZoom(clusterId, (error, zoom) => {
      if (error || zoom == null) return;
      map.easeTo({
        center: (feature.geometry as GeoJSON.Point).coordinates as [number, number],
        zoom,
      });
    });
  });

  map.on('click', STATION_UNCLUSTERED_LAYER_ID, (e) => {
    if (!e.features?.length) return;
    const feature = e.features[0];
    const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
    const props = feature.properties as StationFeatureProperties;

    handlers.popupRef.current?.remove();
    handlers.popupRef.current = new mapboxgl.Popup({ offset: 12 })
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

  map.on('dblclick', STATION_UNCLUSTERED_LAYER_ID, (e) => {
    e.preventDefault();
    if (!e.features?.length) return;
    const stationId = Number(e.features[0].properties?.id);
    if (Number.isFinite(stationId)) {
      handlers.onStationDoubleClick(stationId);
    }
  });

  for (const layerId of [STATION_CLUSTERS_LAYER_ID, STATION_UNCLUSTERED_LAYER_ID]) {
    map.on('mouseenter', layerId, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', layerId, () => {
      map.getCanvas().style.cursor = '';
    });
  }
}

/**
 * Converts Strapi stations into the GeoJSON `FeatureCollection` consumed by
 * the source registered in {@link addStationLayers}, and pushes it in.
 */
export function updateStationLayerData(map: mapboxgl.Map, stations: Station[]): void {
  const source = map.getSource(STATION_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
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
      } satisfies StationFeatureProperties,
    })),
  });
}
