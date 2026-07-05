/**
 * Dependency-free geometry helpers backing the SWOT gauge drawer's spatial
 * filter ("near visible rivers" / "inside visible basins"). Distances use an
 * equirectangular approximation, which is accurate enough at the tens-of-km
 * scale this filter operates at but is not meant for long-range geodesy.
 */
import type { RiverFeature, BasinFeature } from './LayersDrawer';

type LngLat = [number, number];

const KM_PER_DEG_LAT = 110.574;

function kmPerDegLon(latDeg: number): number {
  return 111.32 * Math.cos((latDeg * Math.PI) / 180);
}

/**
 * Projects lng/lat degrees to local, approximately-Cartesian kilometers using
 * an equirectangular approximation centered on `refLatDeg`. Accurate enough
 * for "is this station within N km of a river" at the segment scale we deal
 * with here — not meant for long-range geodesic distance.
 */
function toLocalKm([lng, lat]: LngLat, refLatDeg: number): [number, number] {
  return [lng * kmPerDegLon(refLatDeg), lat * KM_PER_DEG_LAT];
}

function distancePointToSegmentKm(point: LngLat, a: LngLat, b: LngLat): number {
  const refLat = (point[1] + a[1] + b[1]) / 3;
  const [px, py] = toLocalKm(point, refLat);
  const [ax, ay] = toLocalKm(a, refLat);
  const [bx, by] = toLocalKm(b, refLat);

  const dx = bx - ax;
  const dy = by - ay;

  if (dx === 0 && dy === 0) {
    return Math.hypot(px - ax, py - ay);
  }

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  const closestX = ax + t * dx;
  const closestY = ay + t * dy;

  return Math.hypot(px - closestX, py - closestY);
}

function distanceToLineKm(point: LngLat, line: LngLat[]): number {
  let min = Infinity;
  for (let i = 1; i < line.length; i++) {
    const d = distancePointToSegmentKm(point, line[i - 1], line[i]);
    if (d < min) min = d;
  }
  return min;
}

/** Minimum distance (km) from `point` to any river in `riverFeatures`. */
export function distanceToNearestRiverKm(point: LngLat, riverFeatures: RiverFeature[]): number {
  let min = Infinity;
  for (const feature of riverFeatures) {
    const lines =
      feature.geometry.type === 'LineString'
        ? [feature.geometry.coordinates as LngLat[]]
        : (feature.geometry.coordinates as LngLat[][]);

    for (const line of lines) {
      const d = distanceToLineKm(point, line);
      if (d < min) min = d;
    }
  }
  return min;
}

/** Whether `point` is within `maxDistanceKm` of at least one river in `riverFeatures`. */
export function isNearAnyRiver(
  point: LngLat,
  riverFeatures: RiverFeature[],
  maxDistanceKm: number,
): boolean {
  return distanceToNearestRiverKm(point, riverFeatures) <= maxDistanceKm;
}

/** Even-odd ray-casting test — ring is a closed [lng, lat][] loop. */
function isPointInRing(point: LngLat, ring: LngLat[]): boolean {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }

  return inside;
}

/** Outer ring must contain the point; any hole ring containing it excludes it. */
function isPointInPolygonRings(point: LngLat, rings: LngLat[][]): boolean {
  if (rings.length === 0 || !isPointInRing(point, rings[0])) return false;

  for (let i = 1; i < rings.length; i++) {
    if (isPointInRing(point, rings[i])) return false;
  }

  return true;
}

function isPointInBasinFeature(point: LngLat, feature: BasinFeature): boolean {
  if (feature.geometry.type === 'Polygon') {
    return isPointInPolygonRings(point, feature.geometry.coordinates as LngLat[][]);
  }

  return (feature.geometry.coordinates as LngLat[][][]).some((rings) =>
    isPointInPolygonRings(point, rings),
  );
}

/** Whether `point` falls inside at least one basin polygon in `basinFeatures`. */
export function isInsideAnyBasin(point: LngLat, basinFeatures: BasinFeature[]): boolean {
  return basinFeatures.some((feature) => isPointInBasinFeature(point, feature));
}
