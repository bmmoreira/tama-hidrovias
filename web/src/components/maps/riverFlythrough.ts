import mapboxgl from 'mapbox-gl';
import type { CrossSectionFeature } from './crossSectionClusterLayer';

/**
 * Simulated river-navigation camera flythrough: flies the map camera along
 * a river's cross-section nodes in order, tilted and zoomed in like a boat
 * (or low drone) following the water, instead of the default straight-down
 * exploratory view. Currently wired to a single "Simular navegação" button
 * in ForecastDrawer, gated to the Tapajós bathymetry ("profundidade") area
 * -- see that component for the trigger and architecture/river_flythrough.rst
 * for the full design writeup.
 */

/** Camera tilt, in degrees (0 = straight down, close to 85 = near-horizon).
 *  Tapajós's own knob -- see `MADEIRA_FLYTHROUGH_PITCH` below for Madeira's
 *  separate one; the two flights are tuned independently, same reasoning
 *  as their separate durations. */
export const FLYTHROUGH_PITCH = Number(process.env.NEXT_PUBLIC_FLYTHROUGH_PITCH) || 65;

/** "Height" above the river -- a Mapbox zoom level, not a real altitude
 *  (Mapbox has no true 3D camera height for a 2D vector/raster style);
 *  higher is lower/closer to the water. Tapajós's own knob, see
 *  `MADEIRA_FLYTHROUGH_ZOOM` below. */
export const FLYTHROUGH_ZOOM = Number(process.env.NEXT_PUBLIC_FLYTHROUGH_ZOOM) || 13.5;

/** Total time, in ms, to fly the entire path from end to end -- NOT per
 *  node, since nodes aren't evenly spaced: speed is distance-weighted
 *  along the whole route (see `pointAlongPath` below) so the camera
 *  doesn't visibly speed up/slow down crossing uneven node gaps. This is
 *  the Tapajós flight's duration specifically -- see
 *  `MADEIRA_FLYTHROUGH_DURATION_MS` below for why Madeira needs its own,
 *  much larger default rather than sharing this one. */
export const FLYTHROUGH_DURATION_MS = Number(process.env.NEXT_PUBLIC_FLYTHROUGH_DURATION_MS) || 45000;

/** Madeira's path (~1014km) is ~3.5x longer than Tapajós's (~292km) -- using
 *  the same total duration for both meant Madeira's camera moved ~3.5x
 *  faster, which is what "going too fast" actually was. Separately tunable
 *  rather than deriving one from the other's speed, since a literally
 *  speed-matched duration would make Madeira's flight ~3.5x longer in wall
 *  time too (several minutes), which may not be what a quick demo wants
 *  either -- this is a independent pacing knob, not a physics simulation. */
export const MADEIRA_FLYTHROUGH_DURATION_MS =
  Number(process.env.NEXT_PUBLIC_MADEIRA_FLYTHROUGH_DURATION_MS) || 150000;

/** Madeira's own pitch/zoom, independent of Tapajós's -- same "each flight
 *  is a separately tuned experience, not one feature with shared defaults"
 *  reasoning as the duration split above. Defaults match Tapajós's for now
 *  (nothing about Madeira's geometry demands a different starting point),
 *  but are free to diverge via their own env vars without touching
 *  Tapajós's. */
export const MADEIRA_FLYTHROUGH_PITCH = Number(process.env.NEXT_PUBLIC_MADEIRA_FLYTHROUGH_PITCH) || 65;
export const MADEIRA_FLYTHROUGH_ZOOM = Number(process.env.NEXT_PUBLIC_MADEIRA_FLYTHROUGH_ZOOM) || 13.5;

type LngLat = [number, number];

const EARTH_RADIUS_M = 6371000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineDistanceM(a: LngLat, b: LngLat): number {
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Initial bearing (degrees, 0 = north, clockwise) to look from `a` toward
 *  `b` -- used to point the camera the direction of travel, not just down. */
function bearingBetween(a: LngLat, b: LngLat): number {
  const [lon1, lat1] = [toRad(a[0]), toRad(a[1])];
  const [lon2, lat2] = [toRad(b[0]), toRad(b[1])];
  const dLon = lon2 - lon1;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Prefix of `sword_node_id` identifying a Tapajós point -- see
 *  scripts/load_bathymetry_parquet.py and the cross_section_flow docs for
 *  the same convention used elsewhere; there's no dedicated `river` field
 *  on CrossSectionFeatureProperties yet, so this is the only way to pick
 *  "just Tapajós" out of the merged, multi-river feature collection. */
const TAPAJOS_NODE_ID_PREFIXES = ['622411', '622412', '622413', '622414', '622415'];

/**
 * Builds an ordered Tapajós path (river mouth → farthest upstream node,
 * ascending `sword_dist_out`) from the already-loaded cross-section
 * features -- no separate fetch, this reuses the same data the map's
 * cross-section circles already have.
 */
export function buildTapajosPath(features: CrossSectionFeature[]): LngLat[] {
  return features
    .filter((f) => TAPAJOS_NODE_ID_PREFIXES.some((p) => String(f.properties.sword_node_id).startsWith(p)))
    .sort((a, b) => a.properties.sword_dist_out - b.properties.sword_dist_out)
    .map((f) => f.geometry.coordinates as LngLat);
}

/** Same convention as `TAPAJOS_NODE_ID_PREFIXES` above, for Madeira -- every
 *  Madeira node's `sword_node_id` starts with "6226". */
const MADEIRA_NODE_ID_PREFIX = '6226';

/**
 * Builds an ordered Madeira path (river mouth → farthest upstream node),
 * same reasoning as `buildTapajosPath` above. Madeira is the river
 * `bathymetry_points` actually has real loaded depth data for (Tapajós only
 * has the two bathymetry GeoTIFFs) -- see the Madeira flythrough demo in
 * ForecastDrawer and `fetchDepthChunkFromPoints` in riverFlythroughTerrain.ts.
 */
export function buildMadeiraPath(features: CrossSectionFeature[]): LngLat[] {
  return features
    .filter((f) => String(f.properties.sword_node_id).startsWith(MADEIRA_NODE_ID_PREFIX))
    .sort((a, b) => a.properties.sword_dist_out - b.properties.sword_dist_out)
    .map((f) => f.geometry.coordinates as LngLat);
}

interface PathTable {
  points: LngLat[];
  /** Cumulative distance (m) from points[0] to points[i], same length as points. */
  cumulative: number[];
  totalDistanceM: number;
}

function buildPathTable(points: LngLat[]): PathTable {
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(cumulative[i - 1] + haversineDistanceM(points[i - 1], points[i]));
  }
  return { points, cumulative, totalDistanceM: cumulative[cumulative.length - 1] ?? 0 };
}

/** Linear lng/lat interpolation within one short segment -- not a true
 *  great-circle slerp, but segments here are at most a few km (adjacent
 *  cross-section nodes), where the difference is visually meaningless. */
function lerpLngLat(a: LngLat, b: LngLat, t: number): LngLat {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Position + look-ahead bearing at `distanceM` along the path. Bearing
 *  looks toward a point slightly further down the path (not just the next
 *  vertex) so it doesn't visibly snap at every node, only drift smoothly. */
function pointAlongPath(table: PathTable, distanceM: number): { position: LngLat; bearing: number } {
  const { points, cumulative, totalDistanceM } = table;
  const d = Math.min(Math.max(distanceM, 0), totalDistanceM);

  let segmentIndex = cumulative.findIndex((c) => c >= d);
  if (segmentIndex <= 0) segmentIndex = 1;

  const segStart = cumulative[segmentIndex - 1];
  const segEnd = cumulative[segmentIndex];
  const segT = segEnd > segStart ? (d - segStart) / (segEnd - segStart) : 0;
  const position = lerpLngLat(points[segmentIndex - 1], points[segmentIndex], segT);

  const lookaheadD = Math.min(d + totalDistanceM * 0.015, totalDistanceM);
  let lookaheadIndex = cumulative.findIndex((c) => c >= lookaheadD);
  if (lookaheadIndex <= 0) lookaheadIndex = points.length - 1;
  const laSegStart = cumulative[lookaheadIndex - 1] ?? cumulative[0];
  const laSegEnd = cumulative[lookaheadIndex];
  const laT = laSegEnd > laSegStart ? (lookaheadD - laSegStart) / (laSegEnd - laSegStart) : 0;
  const lookaheadPoint = lerpLngLat(points[lookaheadIndex - 1] ?? points[0], points[lookaheadIndex], laT);

  const bearing = bearingBetween(position, lookaheadPoint);
  return { position, bearing };
}

/** Ease-in-out so the flight starts/stops gently instead of snapping to
 *  speed -- cosine easing, cheap and smooth enough for a camera move. */
function easeInOutCosine(t: number): number {
  return (1 - Math.cos(t * Math.PI)) / 2;
}

export interface FlythroughProgress {
  position: LngLat;
  /** Distance traveled so far along the path, in meters. */
  distanceM: number;
  totalDistanceM: number;
}

export interface FlythroughOptions {
  pitch?: number;
  zoom?: number;
  durationMs?: number;
  onComplete?: () => void;
  /** Called every animation frame with the camera's current position along
   *  the path -- lets a caller (e.g. the Madeira riverbed wireframe) stream
   *  in new chunks as the flight progresses, instead of only ever showing
   *  one static chunk at the start. Fired at full frame rate deliberately,
   *  not throttled here -- a caller that only wants to act every N meters
   *  should do that throttling itself (see `createDepthWireframeStreamer`
   *  in riverFlythroughTerrain.ts), since different consumers may want
   *  different thresholds. */
  onProgress?: (progress: FlythroughProgress) => void;
}

/**
 * Starts flying the camera along `path` and returns a function that cancels
 * it early (also called internally when the flight finishes normally).
 * Drives the camera with `map.jumpTo` inside a `requestAnimationFrame` loop
 * -- not `flyTo`/`easeTo`, which each own their own internal animation and
 * would fight a per-frame external driver -- and temporarily disables the
 * map's normal interaction handlers (drag/scroll/etc.) so the user's input
 * can't fight the forced camera moves mid-flight; they're restored when the
 * flight ends or is cancelled.
 */
export function startRiverFlythrough(
  map: mapboxgl.Map,
  path: LngLat[],
  options: FlythroughOptions = {},
): () => void {
  if (path.length < 2) {
    return () => {};
  }

  const pitch = options.pitch ?? FLYTHROUGH_PITCH;
  const zoom = options.zoom ?? FLYTHROUGH_ZOOM;
  const durationMs = options.durationMs ?? FLYTHROUGH_DURATION_MS;

  const table = buildPathTable(path);

  const interactionHandlers = [
    map.dragPan,
    map.scrollZoom,
    map.boxZoom,
    map.dragRotate,
    map.keyboard,
    map.doubleClickZoom,
    map.touchZoomRotate,
  ];
  const wasEnabled = interactionHandlers.map((h) => h.isEnabled());
  interactionHandlers.forEach((h) => h.disable());

  let rafId: number | null = null;
  let cancelled = false;
  const startTime = performance.now();

  const restoreInteractions = () => {
    interactionHandlers.forEach((h, i) => {
      if (wasEnabled[i]) h.enable();
    });
  };

  const stop = () => {
    if (cancelled) return;
    cancelled = true;
    if (rafId !== null) cancelAnimationFrame(rafId);
    restoreInteractions();
  };

  const tick = (now: number) => {
    if (cancelled) return;

    // Clamped on both ends: a requestAnimationFrame callback's own `now`
    // timestamp can occasionally predate the `performance.now()` read when
    // the animation was scheduled (same tick, different clock read), which
    // would otherwise make the very first frame or two compute a tiny
    // negative elapsed/rawT.
    const elapsed = now - startTime;
    const rawT = Math.min(Math.max(elapsed / durationMs, 0), 1);
    const t = easeInOutCosine(rawT);

    const distanceM = t * table.totalDistanceM;
    const { position, bearing } = pointAlongPath(table, distanceM);
    map.jumpTo({ center: position, zoom, pitch, bearing });
    options.onProgress?.({ position, distanceM, totalDistanceM: table.totalDistanceM });

    if (rawT >= 1) {
      stop();
      options.onComplete?.();
      return;
    }

    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);

  return stop;
}
