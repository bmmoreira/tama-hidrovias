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

/**
 * Radius (px, at the most zoomed-in end of the existing zoom interpolation)
 * of an individual, unclustered cross-section circle. Tunable via
 * `NEXT_PUBLIC_CROSS_SECTION_CIRCLE_RADIUS` -- the old flat 4-8px dot had no
 * room for a value label, so this defaults notably larger (14) now that one
 * is drawn on top of it (see `CROSS_SECTION_VALUE_LAYER_ID`).
 */
export const CROSS_SECTION_CIRCLE_RADIUS =
  Number(process.env.NEXT_PUBLIC_CROSS_SECTION_CIRCLE_RADIUS) || 14;

/**
 * Which precomputed property drives an unclustered circle's color and
 * label. Both are written onto every feature ahead of time by
 * `scripts/compute_cross_section_stats.py` (see that script's own comment
 * for why this can't just be computed at map-load time: it needs every
 * point's full profile file, which `CrossSectionModal` otherwise fetches
 * lazily, one at a time, only when a station's own modal opens).
 */
export type CrossSectionMetric = 'cota_leito_maxima' | 'cota_leito_media';

export const CROSS_SECTION_METRIC_OPTIONS: { value: CrossSectionMetric; label: string }[] = [
  { value: 'cota_leito_maxima', label: 'Cota do leito máxima' },
  { value: 'cota_leito_media', label: 'Cota do leito média' },
];

/**
 * Default metric a freshly-loaded map colors/labels circles by. Tunable via
 * `NEXT_PUBLIC_CROSS_SECTION_DEFAULT_METRIC` ("cota_leito_maxima" or
 * "cota_leito_media"); falls back to "cota_leito_maxima" for any other
 * value, including unset.
 */
export const CROSS_SECTION_DEFAULT_METRIC: CrossSectionMetric =
  process.env.NEXT_PUBLIC_CROSS_SECTION_DEFAULT_METRIC === 'cota_leito_media'
    ? 'cota_leito_media'
    : 'cota_leito_maxima';

/**
 * Two-stop color ramp (low value → high value) for unclustered circles,
 * tunable via `NEXT_PUBLIC_CROSS_SECTION_COLOR_LOW`/`_HIGH`. Defaults to the
 * exact same green the SWOT gauge legend uses for its positive-value ramp
 * (`ForecastLegend.tsx`) -- reused as-is rather than invented fresh, since
 * "cota do leito" is a plain, non-diverging elevation value with no natural
 * negative pole to ramp toward SWOT's red.
 */
export const CROSS_SECTION_COLOR_LOW = process.env.NEXT_PUBLIC_CROSS_SECTION_COLOR_LOW || '#bbf7d0';
export const CROSS_SECTION_COLOR_HIGH = process.env.NEXT_PUBLIC_CROSS_SECTION_COLOR_HIGH || '#15803d';

export const CROSS_SECTION_SOURCE_ID = 'cross-sections-source';
export const CROSS_SECTION_CLUSTERS_LAYER_ID = 'cross-sections-clusters';
export const CROSS_SECTION_CLUSTER_COUNT_LAYER_ID = 'cross-sections-cluster-count';
export const CROSS_SECTION_UNCLUSTERED_LAYER_ID = 'cross-sections-unclustered-point';
export const CROSS_SECTION_VALUE_LAYER_ID = 'cross-sections-unclustered-value';

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
  /** Max bed elevation across the full profile, in meters -- precomputed,
   *  see `scripts/compute_cross_section_stats.py`. */
  cota_leito_maxima: number;
  /** Mean bed elevation across the full profile, in meters -- precomputed,
   *  see `scripts/compute_cross_section_stats.py`. */
  cota_leito_media: number;
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
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        4,
        CROSS_SECTION_CIRCLE_RADIUS * 0.55,
        10,
        CROSS_SECTION_CIRCLE_RADIUS,
      ],
      // Placeholder flat color -- replaced by a data-driven expression as
      // soon as real features load, see `updateCrossSectionLayerData`. Kept
      // here only so the layer has *some* valid paint property before that
      // first call.
      'circle-color': CROSS_SECTION_COLOR_LOW,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
      'circle-opacity': 0.9,
    },
  });

  // Value label (the selected metric, e.g. "47") drawn on top of each
  // unclustered circle -- a separate symbol layer rather than baking text
  // into the circle layer itself, same split `stationClusterLayer.ts`/
  // `CROSS_SECTION_CLUSTER_COUNT_LAYER_ID` already use for cluster counts.
  map.addLayer({
    id: CROSS_SECTION_VALUE_LAYER_ID,
    type: 'symbol',
    source: CROSS_SECTION_SOURCE_ID,
    filter: ['!', ['has', 'point_count']],
    layout: {
      // Metric field name is filled in per-call by `updateCrossSectionLayerData`
      // (via setLayoutProperty) once the selected metric is known.
      'text-field': '',
      'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
      'text-size': 10,
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': 'rgba(0,0,0,0.35)',
      'text-halo-width': 1,
    },
  });
}

/**
 * Builds the `circle-color` data expression for the unclustered layer: a
 * plain Mapbox `interpolate` over the selected metric's own min/max across
 * `features` (not a fixed domain -- Madeira and Tapajós have very different
 * elevation ranges, so a shared hardcoded scale would wash one of them out).
 * Guards against `min === max` (e.g. a single point, or a metric with no
 * variance in the current data), which would otherwise make Mapbox reject
 * the expression for having non-increasing stops.
 */
function buildColorExpression(features: CrossSectionFeature[], metric: CrossSectionMetric): mapboxgl.Expression {
  const values = features
    .map((f) => f.properties[metric])
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;

  return [
    'interpolate',
    ['linear'],
    ['get', metric],
    min,
    CROSS_SECTION_COLOR_LOW,
    max > min ? max : min + 1,
    CROSS_SECTION_COLOR_HIGH,
  ];
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
 * {@link addCrossSectionLayers}, and re-derives the unclustered circles'
 * color/label from `metric` and this feature set's own min/max for it.
 * Re-run on every data change AND every metric change (both affect the
 * color domain), not just once at load -- see the `CrossSectionMetric`
 * selector in `SwotFilterDrawer.tsx`.
 */
export function updateCrossSectionLayerData(
  map: mapboxgl.Map,
  features: CrossSectionFeature[],
  metric: CrossSectionMetric = CROSS_SECTION_DEFAULT_METRIC,
): void {
  const source = map.getSource(CROSS_SECTION_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
  if (!source) return;

  source.setData({ type: 'FeatureCollection', features });

  map.setPaintProperty(CROSS_SECTION_UNCLUSTERED_LAYER_ID, 'circle-color', buildColorExpression(features, metric));
  map.setLayoutProperty(CROSS_SECTION_VALUE_LAYER_ID, 'text-field', [
    'to-string',
    ['round', ['get', metric]],
  ]);
}
