import mapboxgl from 'mapbox-gl';

/**
 * Mapbox cluster radius in pixels for the river cross-section points layer.
 * Tunable via `NEXT_PUBLIC_CROSS_SECTION_CLUSTER_RADIUS` (defaults to 50) --
 * mirrors `STATION_CLUSTER_RADIUS` in `stationClusterLayer.ts`.
 */
export const CROSS_SECTION_CLUSTER_RADIUS =
  Number(process.env.NEXT_PUBLIC_CROSS_SECTION_CLUSTER_RADIUS) || 50;

/** Zoom level above which cross-section points always render individually, never clustered. */
export const CROSS_SECTION_CLUSTER_MAX_ZOOM = 12;

export const CROSS_SECTION_SOURCE_ID = 'cross-sections-source';
export const CROSS_SECTION_CLUSTERS_LAYER_ID = 'cross-sections-clusters';
export const CROSS_SECTION_CLUSTER_COUNT_LAYER_ID = 'cross-sections-cluster-count';
export const CROSS_SECTION_UNCLUSTERED_LAYER_ID = 'cross-sections-unclustered-point';

/**
 * GeoJSON feature properties carried by each cross-section point, as loaded
 * from `public/geojson/output_points_water_level.geojson`. `file` names the
 * matching transversal profile under `public/geojson/secoes_transversais/`
 * (two columns, tab-separated, no header: distance along the section in
 * meters, then the raster elevation value at that point).
 */
export interface CrossSectionFeatureProperties {
  sword_node_id: number;
  sword_reach_id: number;
  /** River width at this node, in meters (SWORD). */
  sword_width: number;
  /** Distance from the river outlet, in meters (SWORD). */
  sword_dist_out: number;
  file: string;
  /** Measured water-surface elevation at this station, in meters -- drawn
   *  as the reference line in CrossSectionModal's profile chart. */
  water_level: number;
}

export type CrossSectionFeature = GeoJSON.Feature<GeoJSON.Point, CrossSectionFeatureProperties>;

export interface CrossSectionClusterHandlers {
  /** Called with the clicked point's full feature on click (not a cluster). */
  onSectionClick: (feature: CrossSectionFeature) => void;
}

/**
 * Registers the clustered cross-section source and its three layers (cluster
 * circles, cluster count labels, individual points) on `map`. Same shape and
 * reasoning as `addStationLayers` in `stationClusterLayer.ts`; a diamond-ish
 * amber color scheme distinguishes these from station circles and SWOT
 * triangles.
 */
export function addCrossSectionLayers(map: mapboxgl.Map): void {
  map.addSource(CROSS_SECTION_SOURCE_ID, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    cluster: true,
    clusterRadius: CROSS_SECTION_CLUSTER_RADIUS,
    clusterMaxZoom: CROSS_SECTION_CLUSTER_MAX_ZOOM,
  });

  map.addLayer({
    id: CROSS_SECTION_CLUSTERS_LAYER_ID,
    type: 'circle',
    source: CROSS_SECTION_SOURCE_ID,
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': ['step', ['get', 'point_count'], '#fbbf24', 10, '#f59e0b', 30, '#b45309'],
      'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 30, 24],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
      'circle-opacity': 0.9,
    },
  });

  map.addLayer({
    id: CROSS_SECTION_CLUSTER_COUNT_LAYER_ID,
    type: 'symbol',
    source: CROSS_SECTION_SOURCE_ID,
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
      'text-size': 11,
    },
    paint: {
      'text-color': '#ffffff',
    },
  });

  map.addLayer({
    id: CROSS_SECTION_UNCLUSTERED_LAYER_ID,
    type: 'circle',
    source: CROSS_SECTION_SOURCE_ID,
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 4, 10, 8],
      'circle-color': '#f59e0b',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
      'circle-opacity': 0.9,
    },
  });
}

/**
 * Wires up cluster-expansion and click interactions for the layers
 * registered by {@link addCrossSectionLayers}.
 */
export function attachCrossSectionLayerInteractions(
  map: mapboxgl.Map,
  handlers: CrossSectionClusterHandlers,
): void {
  // Clicking a cluster zooms in just enough for it to break apart.
  map.on('click', CROSS_SECTION_CLUSTERS_LAYER_ID, (e) => {
    const [feature] = map.queryRenderedFeatures(e.point, { layers: [CROSS_SECTION_CLUSTERS_LAYER_ID] });
    const clusterId = feature?.properties?.cluster_id;
    if (clusterId === undefined) return;

    const source = map.getSource(CROSS_SECTION_SOURCE_ID) as mapboxgl.GeoJSONSource;
    source.getClusterExpansionZoom(clusterId, (error, zoom) => {
      if (error || zoom == null) return;
      map.easeTo({
        center: (feature.geometry as GeoJSON.Point).coordinates as [number, number],
        zoom,
      });
    });
  });

  map.on('click', CROSS_SECTION_UNCLUSTERED_LAYER_ID, (e) => {
    if (!e.features?.length) return;
    const feature = e.features[0];
    const coordinates = (feature.geometry as GeoJSON.Point).coordinates as [number, number];

    handlers.onSectionClick({
      type: 'Feature',
      properties: feature.properties as CrossSectionFeatureProperties,
      geometry: { type: 'Point', coordinates },
    });
  });

  for (const layerId of [CROSS_SECTION_CLUSTERS_LAYER_ID, CROSS_SECTION_UNCLUSTERED_LAYER_ID]) {
    map.on('mouseenter', layerId, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', layerId, () => {
      map.getCanvas().style.cursor = '';
    });
  }
}

/**
 * Pushes `features` (already GeoJSON, loaded straight from
 * `output_points_water_level.geojson`) into the source registered in
 * {@link addCrossSectionLayers}.
 */
export function updateCrossSectionLayerData(map: mapboxgl.Map, features: CrossSectionFeature[]): void {
  const source = map.getSource(CROSS_SECTION_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
  if (!source) return;

  source.setData({ type: 'FeatureCollection', features });
}
