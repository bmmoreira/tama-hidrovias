// Utilities for tile / coordinate conversions

/**
 * Convert Web Mercator (EPSG:3857) coordinates to lon/lat in degrees.
 */
export function mercatorToLonLat(x: number, y: number): [number, number] {
  const R = 6378137;
  const lon = (x / R) * (180 / Math.PI);
  const lat = (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI);
  return [lon, lat];
}

/**
 * Convert lon/lat to XYZ tile at zoom z using WebMercator/Slippy tile scheme.
 */
export function lonLatToTile(lon: number, lat: number, z: number) {
  const tileCount = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * tileCount);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * tileCount,
  );
  return { x, y, z };
}
