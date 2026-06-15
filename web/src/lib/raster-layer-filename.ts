/**
 * Parses metadata embedded in hydrological GeoTIFF filenames so it can be
 * used to pre-fill a `RasterLayer` entry in Strapi.
 *
 * Supports two acquisition timestamp conventions:
 *  - `..._YYYYMMDD_HHMMSS[_PROJECTION]`
 *  - `..._YYYY-MM-DDThhHmm[_PROJECTION]`
 */
export type ParsedRasterLayerFilename = {
  layer_id: string;
  display_name: string;
  area_name: string;
  hydrology_variable: string;
  acquisition_date: string | null;
  acquisition_time: string | null;
  file_projection: string | null;
};

function titleCase(value: string): string {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Extracts the file name from a relative path or full URL.
 *
 * Used to match a `RasterLayer.file_url` (which may be a full S3 URL or a
 * relative path) against a forecast GeoTIFF file listed on disk, regardless
 * of any directory prefix.
 */
export function getRasterLayerFileBaseName(value: string): string {
  return value.split('/').pop() ?? value;
}

export function parseRasterLayerFilename(fileName: string): ParsedRasterLayerFilename {
  const base = fileName.replace(/\.(tif|tiff)$/i, '');

  let prefix = base;
  let acquisitionDate: string | null = null;
  let acquisitionTime: string | null = null;
  let fileProjection: string | null = null;

  const compactMatch = base.match(/^(.+?)_(\d{8})_(\d{6})(?:_(.+))?$/);
  const isoMatch = base.match(/^(.+?)_(\d{4}-\d{2}-\d{2})T(\d{2})h(\d{2})(?:_(.+))?$/i);

  if (compactMatch) {
    const [, p, dateStr, timeStr, suffix] = compactMatch;
    prefix = p;
    acquisitionDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
    acquisitionTime = `${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}:${timeStr.slice(4, 6)}`;
    fileProjection = suffix ?? null;
  } else if (isoMatch) {
    const [, p, date, hour, minute, suffix] = isoMatch;
    prefix = p;
    acquisitionDate = date;
    acquisitionTime = `${hour}:${minute}:00`;
    fileProjection = suffix ?? null;
  }

  const parts = prefix.split('_').filter(Boolean);
  const areaName = parts[0] ?? prefix;
  const hydrologyVariable = parts.slice(1).join('_').toLowerCase() || 'unknown';

  const displayParts = [titleCase(areaName), titleCase(hydrologyVariable)];
  if (acquisitionDate) displayParts.push(acquisitionDate);

  return {
    layer_id: slugify(base),
    display_name: displayParts.join(' · '),
    area_name: areaName,
    hydrology_variable: hydrologyVariable,
    acquisition_date: acquisitionDate,
    acquisition_time: acquisitionTime,
    file_projection: fileProjection,
  };
}
