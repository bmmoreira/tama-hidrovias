import fs from 'node:fs/promises';
import path from 'node:path';

/** Parsed forecast raster frame derived from a GeoTIFF filename. */
export type ForecastTileFrame = {
  area: string;
  slug: string;
  fileName: string;
  date: string;
  time: string;
  timestamp: string;
  label: string;
};

/** Ordered collection of forecast frames belonging to one forecast area. */
export type ForecastTileGroup = {
  area: string;
  frames: ForecastTileFrame[];
};

/** Resolved GeoTIFF source file used for forecast metadata or tile rendering. */
export type ForecastTileSource = {
  fileName: string;
  absolutePath: string;
};

const FORECAST_TILE_PATTERN = /^(?<area>[A-Za-z_]+?)_?(?<date>\d{8})_(?<time>\d{6})(?:_WGS84)?\.tiff?$/i;

function formatAreaLabel(area: string) {
  return area
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(' ');
}

function formatTimestamp(date: string, time: string) {
  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}Z`;
}

function buildFrame(fileName: string): ForecastTileFrame | null {
  const match = FORECAST_TILE_PATTERN.exec(fileName);

  if (!match?.groups) {
    return null;
  }

  const area = match.groups.area.toUpperCase();
  const date = match.groups.date;
  const time = match.groups.time;

  return {
    area,
    slug: fileName.replace(/\.tiff?$/i, ''),
    fileName,
    date,
    time,
    timestamp: formatTimestamp(date, time),
    label: `${formatAreaLabel(area)} · ${date.slice(6, 8)}/${date.slice(4, 6)}/${date.slice(0, 4)} ${time.slice(0, 2)}:${time.slice(2, 4)}`,
  };
}

async function resolveForecastTilesDirectory() {
  const mountedDir = '/forecast-tiles';

  try {
    const stats = await fs.stat(mountedDir);
    if (stats.isDirectory()) {
      return mountedDir;
    }
  } catch {
    // Fall through to the workspace-relative path for non-container workflows.
  }

  return path.resolve(process.cwd(), '..', 'assets', 'tiles');
}

/**
 * Resolve a forecast tile slug to an existing ``.tif`` or ``.tiff`` file.
 *
 * The web service prefers the Docker-mounted ``/forecast-tiles`` directory and
 * falls back to the workspace path for non-container development.
 */
export async function resolveForecastTileSource(
  slug: string,
): Promise<ForecastTileSource | null> {
  const directory = await resolveForecastTilesDirectory();
  const candidates = [`${slug}.tif`, `${slug}.tiff`];

  for (const fileName of candidates) {
    const absolutePath = path.join(directory, fileName);

    try {
      const stats = await fs.stat(absolutePath);
      if (stats.isFile()) {
        return { fileName, absolutePath };
      }
    } catch {
      // Try the next extension candidate.
    }
  }

  return null;
}

/**
 * Read and group forecast GeoTIFF files by area from the shared assets/tiles
 * folder mounted into the web container.
 *
 * Frames are grouped by the leading area token in the file name and ordered by
 * their derived timestamp so the forecast drawer can animate them in sequence.
 */
export async function listForecastTileGroups(): Promise<ForecastTileGroup[]> {
  const directory = await resolveForecastTilesDirectory();
  const entries = await fs.readdir(directory, { withFileTypes: true });

  const grouped = new Map<string, ForecastTileFrame[]>();

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const frame = buildFrame(entry.name);

    if (!frame) {
      continue;
    }

    const group = grouped.get(frame.area) ?? [];
    group.push(frame);
    grouped.set(frame.area, group);
  }

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([area, frames]) => ({
      area,
      frames: frames.sort((left, right) => left.timestamp.localeCompare(right.timestamp)),
    }));
}