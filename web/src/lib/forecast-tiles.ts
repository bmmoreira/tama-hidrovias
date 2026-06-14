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

function buildFrame(relativePath: string, subfolder: string): ForecastTileFrame | null {
  const baseName = path.basename(relativePath);
  
  let area = '';
  let date = '';
  let time = '';

  const originalMatch = /^(?<area>[A-Za-z_]+?)_?(?<date>\d{8})_(?<time>\d{6})(?:_WGS84)?\.tiff?$/i.exec(baseName);
  const flexibleMatch = /^(?<area>[A-Za-z_]+?)_?(?<year>\d{4})-?(?<month>\d{2})-?(?<day>\d{2})[T_]?(?<hour>\d{2})[h:]?(?<minute>\d{2})[m:]?(?<second>\d{2})?.*\.tiff?$/i.exec(baseName);

  if (originalMatch?.groups) {
    area = originalMatch.groups.area.toUpperCase();
    date = originalMatch.groups.date;
    time = originalMatch.groups.time;
  } else if (flexibleMatch?.groups) {
    area = flexibleMatch.groups.area.toUpperCase();
    date = `${flexibleMatch.groups.year}${flexibleMatch.groups.month}${flexibleMatch.groups.day}`;
    time = `${flexibleMatch.groups.hour}${flexibleMatch.groups.minute}${flexibleMatch.groups.second || '00'}`;
  } else {
    // Fallback if no known date pattern is matched
    area = baseName.split('_')[0].toUpperCase();
    const nums = baseName.replace(/\D/g, '');
    if (nums.length >= 14) {
      date = nums.slice(0, 8);
      time = nums.slice(8, 14);
    } else if (nums.length >= 8) {
      date = nums.slice(0, 8);
      time = nums.slice(8).padEnd(6, '0');
    } else {
      date = '19700101';
      time = '000000';
    }
  }

  // If a subfolder exists, it overrides the filename area prefix to aggregate images
  if (subfolder) {
    area = subfolder.toUpperCase().replace(/[\/\\]/g, '_');
  }

  return {
    area,
    slug: relativePath.replace(/\.tiff?$/i, ''),
    fileName: relativePath,
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

async function getFilesRecursively(
  dir: string,
  currentSubdir: string = ''
): Promise<{ name: string; relativePath: string; subfolder: string }[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: { name: string; relativePath: string; subfolder: string }[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const newSubdir = currentSubdir ? `${currentSubdir}/${entry.name}` : entry.name;
      const subFiles = await getFilesRecursively(path.join(dir, entry.name), newSubdir);
      files.push(...subFiles);
    } else if (entry.isFile() && /\.(tif|tiff)$/i.test(entry.name)) {
      files.push({
        name: entry.name,
        relativePath: currentSubdir ? `${currentSubdir}/${entry.name}` : entry.name,
        subfolder: currentSubdir,
      });
    }
  }
  return files;
}

/**
 * Read and group forecast GeoTIFF files by area from the shared assets/tiles
 * folder mounted into the web container.
 *
 * Frames are grouped by their subfolder name (if any), otherwise by the leading 
 * area token in the file name. They are ordered by their derived timestamp so 
 * the forecast drawer can animate them in sequence.
 */
export async function listForecastTileGroups(): Promise<ForecastTileGroup[]> {
  const directory = await resolveForecastTilesDirectory();
  
  let allFiles: { name: string; relativePath: string; subfolder: string }[] = [];
  try {
    allFiles = await getFilesRecursively(directory);
  } catch (error) {
    console.error('Error reading forecast tiles directory:', error);
  }

  const grouped = new Map<string, ForecastTileFrame[]>();

  for (const fileInfo of allFiles) {
    const frame = buildFrame(fileInfo.relativePath, fileInfo.subfolder);

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