import mapboxgl from 'mapbox-gl';
import Supercluster from 'supercluster';
import type { SwotGaugeFeature, SwotGaugeFeatureProperties } from '@/lib/strapi';
import type { SwotMetric } from '@/components/maps/SwotFilterDrawer';

/**
 * Mapbox cluster radius in pixels for the SWOT gauge layer. Tunable via
 * `NEXT_PUBLIC_SWOT_CLUSTER_RADIUS` (defaults to 65) so the first paint
 * with hundreds of gauges collapses nearby points into a single triangle
 * instead of rendering one per gauge -- mirrors `stationClusterLayer.ts`'s
 * `STATION_CLUSTER_RADIUS`.
 */
export const SWOT_CLUSTER_RADIUS = Number(process.env.NEXT_PUBLIC_SWOT_CLUSTER_RADIUS) || 65;

/** Zoom level above which SWOT gauges always render individually, never clustered. */
export const SWOT_CLUSTER_MAX_ZOOM = 14;

export const SWOT_SOURCE_ID = 'swot-gauges-source';
export const SWOT_GAUGES_LAYER_ID = 'swot-gauges';

const TRIANGLE_UP_ICON = 'swot-triangle-up';
const TRIANGLE_DOWN_ICON = 'swot-triangle-down';
const TRIANGLE_ICON_SIZE = 58;

// Magnitude (in the same unit as the selected metric) at which the color
// spectrum reaches its most saturated value.
const VALUE_SCALE_MAX = 5;

export interface SwotGaugeClusterHandlers {
  /** Called with the clicked gauge's full feature on click (not a cluster). */
  onGaugeClick: (feature: SwotGaugeFeature) => void;
}

// --- color/shape helpers (plain JS -- see below for why these aren't
// Mapbox style expressions anymore) ------------------------------------

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

  return `rgb(${Math.round(r1 + (r2 - r1) * clamped)}, ${Math.round(g1 + (g2 - g1) * clamped)}, ${Math.round(b1 + (b2 - b1) * clamped)})`;
}

// No data → neutral gray; negative ramps orange→red, positive ramps light→dark
// green -- matches the original single-gauge SVG marker's color scale exactly.
function colorForValue(value: number | null): string {
  if (typeof value !== 'number') return '#94a3b8';
  const t = Math.abs(value) / VALUE_SCALE_MAX;
  return value < 0
    ? interpolateColor('#fed7aa', '#b91c1c', t)
    : interpolateColor('#bbf7d0', '#15803d', t);
}

function iconSizeForCount(pointCount: number | undefined): number {
  if (!pointCount) return 1;
  if (pointCount >= 30) return 2.2;
  if (pointCount >= 10) return 1.6;
  return 1.2;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Draws a plain white-on-transparent triangle and returns it as ImageData,
// for registration as an SDF icon (map.addImage(..., { sdf: true })) so its
// color can be set per-feature via the `icon-color` paint property -- the
// same up/down, apex-at-top/apex-at-bottom shape the old DOM-based SVG
// triangle used.
function createTriangleImage(inverted: boolean): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = TRIANGLE_ICON_SIZE;
  canvas.height = TRIANGLE_ICON_SIZE;
  const ctx = canvas.getContext('2d')!;

  const pad = TRIANGLE_ICON_SIZE * 0.05;
  const mid = TRIANGLE_ICON_SIZE / 2;
  const bottom = TRIANGLE_ICON_SIZE - pad;

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  if (inverted) {
    ctx.moveTo(pad, pad);
    ctx.lineTo(bottom, pad);
    ctx.lineTo(mid, bottom);
  } else {
    ctx.moveTo(mid, pad);
    ctx.lineTo(pad, bottom);
    ctx.lineTo(bottom, bottom);
  }
  ctx.closePath();
  ctx.fill();

  return ctx.getImageData(0, 0, TRIANGLE_ICON_SIZE, TRIANGLE_ICON_SIZE);
}

interface RenderProperties {
  iconImage: string;
  iconColor: string;
  iconSize: number;
  textLabel: string;
  textOffset: [number, number];
}

function buildRenderProperties(value: number | null, pointCount: number | undefined): RenderProperties {
  const isNegative = typeof value === 'number' && value < 0;

  return {
    iconImage: isNegative ? TRIANGLE_DOWN_ICON : TRIANGLE_UP_ICON,
    iconColor: colorForValue(value),
    iconSize: iconSizeForCount(pointCount),
    textLabel: typeof value === 'number' ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}` : '–',
    textOffset: isNegative ? [0, -0.9] : [0, 0.9],
  };
}

/**
 * Manages a `supercluster` index and pushes its output into a plain
 * (non-clustering) Mapbox GeoJSON source, recomputed on every `moveend`.
 *
 * Mapbox's own `cluster: true` source option (used by
 * `stationClusterLayer.ts`) only supports *incrementally combinable*
 * aggregates -- sum, max, min -- applied pairwise as points merge into
 * clusters. A median can't be computed that way: it needs the full set of
 * values, not a running combinable total. `supercluster` (the same library
 * Mapbox uses internally for `cluster: true`) exposes `getLeaves()`, which
 * returns the actual raw points inside a cluster -- this class uses that to
 * compute an exact median of whichever property is selected, per cluster,
 * every time the view or the selected metric changes.
 */
export class SwotGaugeClusterLayer {
  private readonly map: mapboxgl.Map;
  private readonly handlers: SwotGaugeClusterHandlers;
  private index = new Supercluster<SwotGaugeFeatureProperties>({
    radius: SWOT_CLUSTER_RADIUS,
    maxZoom: SWOT_CLUSTER_MAX_ZOOM,
  });
  private metric: SwotMetric = 'Change';
  private readonly onMoveEnd = () => this.render();

  constructor(map: mapboxgl.Map, handlers: SwotGaugeClusterHandlers) {
    this.map = map;
    this.handlers = handlers;
    this.addLayers();
    this.attachInteractions();
    this.map.on('moveend', this.onMoveEnd);
  }

  /** Rebuilds the spatial index from scratch and re-renders. */
  setFeatures(features: SwotGaugeFeature[]): void {
    this.index = new Supercluster<SwotGaugeFeatureProperties>({
      radius: SWOT_CLUSTER_RADIUS,
      maxZoom: SWOT_CLUSTER_MAX_ZOOM,
    });
    this.index.load(features as unknown as GeoJSON.Feature<GeoJSON.Point, SwotGaugeFeatureProperties>[]);
    this.render();
  }

  /**
   * Switches which property drives color/shape/label. Cheap: spatial
   * grouping doesn't depend on the metric, only the displayed value does,
   * so this just re-renders with the existing index -- no reload needed.
   */
  setMetric(metric: SwotMetric): void {
    if (this.metric === metric) return;
    this.metric = metric;
    this.render();
  }

  /** Removes the moveend listener. Layers/source/images are left on the
   *  map, matching how the rest of MapboxMap.tsx doesn't tear down its
   *  other layers on prop changes either -- only on full unmount. */
  destroy(): void {
    this.map.off('moveend', this.onMoveEnd);
  }

  private addLayers(): void {
    const map = this.map;

    if (!map.hasImage(TRIANGLE_UP_ICON)) {
      map.addImage(TRIANGLE_UP_ICON, createTriangleImage(false), { sdf: true });
    }
    if (!map.hasImage(TRIANGLE_DOWN_ICON)) {
      map.addImage(TRIANGLE_DOWN_ICON, createTriangleImage(true), { sdf: true });
    }

    map.addSource(SWOT_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    map.addLayer({
      id: SWOT_GAUGES_LAYER_ID,
      type: 'symbol',
      source: SWOT_SOURCE_ID,
      layout: {
        'icon-image': ['get', 'iconImage'],
        'icon-size': ['get', 'iconSize'],
        'icon-allow-overlap': true,
        'text-field': ['get', 'textLabel'],
        'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 12,
        'text-allow-overlap': true,
        'text-offset': ['get', 'textOffset'],
      },
      paint: {
        'icon-color': ['get', 'iconColor'],
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(0,0,0,0.25)',
        'text-halo-width': 1,
      },
    });
  }

  private attachInteractions(): void {
    const map = this.map;

    map.on('click', SWOT_GAUGES_LAYER_ID, (e) => {
      if (!e.features?.length) return;
      const feature = e.features[0];

      if (feature.properties?.cluster) {
        const clusterId = feature.properties.cluster_id;
        const zoom = this.index.getClusterExpansionZoom(clusterId);
        map.easeTo({
          center: (feature.geometry as GeoJSON.Point).coordinates as [number, number],
          zoom,
        });
        return;
      }

      const coordinates = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
      this.handlers.onGaugeClick({
        type: 'Feature',
        properties: feature.properties as SwotGaugeFeatureProperties,
        geometry: { type: 'Point', coordinates },
      });
    });

    map.on('mouseenter', SWOT_GAUGES_LAYER_ID, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', SWOT_GAUGES_LAYER_ID, () => {
      map.getCanvas().style.cursor = '';
    });
  }

  private render(): void {
    const source = this.map.getSource(SWOT_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;

    const bounds = this.map.getBounds();
    if (!bounds) return;

    const bbox: [number, number, number, number] = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ];
    const zoom = Math.floor(this.map.getZoom());
    const metric = this.metric;

    const features = this.index.getClusters(bbox, zoom).map((feature) => {
      if (isClusterFeature(feature)) {
        const leaves = this.index.getLeaves(feature.properties.cluster_id, Infinity);
        const values = leaves
          .map((leaf) => leaf.properties[metric])
          .filter((v): v is number => typeof v === 'number');

        return {
          ...feature,
          properties: {
            ...feature.properties,
            ...buildRenderProperties(median(values), feature.properties.point_count),
          },
        };
      }

      const value = feature.properties[metric];
      return {
        ...feature,
        properties: {
          ...feature.properties,
          ...buildRenderProperties(typeof value === 'number' ? value : null, undefined),
        },
      };
    });

    source.setData({ type: 'FeatureCollection', features });
  }
}

function isClusterFeature(
  feature: Supercluster.ClusterFeature<Supercluster.AnyProps> | Supercluster.PointFeature<SwotGaugeFeatureProperties>,
): feature is Supercluster.ClusterFeature<Supercluster.AnyProps> {
  return (feature.properties as Partial<Supercluster.ClusterProperties>).cluster === true;
}
