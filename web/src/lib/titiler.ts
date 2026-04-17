/**
 * TileServer COG Info API Utility
 * 
 * Utility functions to fetch detailed file information from TileServer
 */


// Internal service URL (used when code runs server-side inside the Docker network)
// Falls back to NEXT_PUBLIC_TITILER_URL for local dev convenience.
const TITILER_INTERNAL_URL =
  process.env.TITILER_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_TITILER_URL ??
  'http://hfs-titiler:8000';

// Optional token to call the internal (protected) TiTiler API
const TITILER_INTERNAL_TOKEN = process.env.TITILER_INTERNAL_TOKEN || null;

// Public URL that the browser can use (should be proxied through nginx or set to a public-facing endpoint)
const TITILER_PUBLIC_URL = process.env.NEXT_PUBLIC_TITILER_URL || null;

// Get detailed information about a file from TileServer
export const fetchCogInfo = async (filename: string) => {
  try {
    // Determine whether we're running server-side (Node) or client-side (browser).
    const isServer = typeof window === 'undefined';

    // Prefer internal URL for server-side calls so TiTiler can access host file paths
    const base = isServer ? TITILER_INTERNAL_URL : (TITILER_PUBLIC_URL ?? TITILER_INTERNAL_URL);
    const fileUrl = `file:///app/images/${encodeURIComponent(filename)}`;
    const cogInfoUrl = `${base.replace(/\/$/, '')}/map/cog/info?url=${encodeURIComponent(fileUrl)}`;

    const headers: Record<string, string> = { Accept: 'application/json' };
    // If calling the internal protected API from the server, attach the internal token if provided
    if (isServer && TITILER_INTERNAL_TOKEN) {
      headers['Authorization'] = `Bearer ${TITILER_INTERNAL_TOKEN}`;
    }

    const response = await fetch(cogInfoUrl, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`TiTiler error: ${response.status} ${response.statusText}`);
    }

    const cogInfo = await response.json();
    return cogInfo;

  } catch (error: any) {
    // Keep diagnostics concise and safe
    console.warn(`Failed to fetch COG info for ${filename}:`, error?.message ?? error);
    return null;
  }
};

// Enhanced layer data with COG information
export const enrichLayerWithCogInfo = async (layer: any) => {
  try {
    const cogInfo = await fetchCogInfo(layer.name);
    
    if (!cogInfo) {
      return layer; // Return original layer if COG info fetch fails
    }

    // Merge COG information with existing layer data
    return {
      ...layer,
      cogInfo,
      // Extract useful properties from COG info
      actualDimensions: cogInfo.width && cogInfo.height ? `${cogInfo.width}x${cogInfo.height}` : layer.dimensions,
      pixelSize: cogInfo.pixel_size || null,
      bounds: cogInfo.bounds || null,
      center: cogInfo.center || null,
      projection: cogInfo.crs || layer.projection,
      actualBands: cogInfo.bands || layer.bands,
      dataType: cogInfo.data_type || layer.dataType,
      noDataValue: cogInfo.nodata || null,
      statistics: cogInfo.statistics || null,
      overviews: cogInfo.overviews || null,
      tileInfo: {
        tileSize: cogInfo.tile_size || null,
        levels: cogInfo.levels || null,
        format: cogInfo.format || null
      },
      // Additional metadata
      isCogOptimized: cogInfo.is_cog || false,
      hasMask: cogInfo.has_mask || false,
      hasAlpha: cogInfo.has_alpha || false,
      compression: cogInfo.compression || layer.compression,
      colorInterp: cogInfo.color_interp || null,
      geotransform: cogInfo.geotransform || null,
    };
    
  } catch (error: any) {
    console.warn(`Error enriching layer ${layer.name}:`, error?.message ?? error);
    return layer;
  }
};

// Batch enrich multiple layers with COG information
export const enrichLayersWithCogInfo = async (layers: any[], maxConcurrent = 5) => {
  const enrichedLayers: any[] = [];

  // Process layers in batches to avoid overwhelming the server
  for (let i = 0; i < layers.length; i += maxConcurrent) {
    const batch = layers.slice(i, i + maxConcurrent);
    const enrichedBatch = await Promise.all(batch.map((layer) => enrichLayerWithCogInfo(layer)));
    enrichedLayers.push(...enrichedBatch);
  }

  return enrichedLayers;
};

// Format COG statistics for display
export const formatCogStatistics = (statistics: any) => {
  if (!statistics || !Array.isArray(statistics)) {
    return null;
  }

  return statistics.map((bandStats: any, index: number) => ({
    band: index + 1,
    min: typeof bandStats.min === 'number' ? bandStats.min.toFixed(2) : 'N/A',
    max: typeof bandStats.max === 'number' ? bandStats.max.toFixed(2) : 'N/A',
    mean: typeof bandStats.mean === 'number' ? bandStats.mean.toFixed(2) : 'N/A',
    stddev: typeof bandStats.stddev === 'number' ? bandStats.stddev.toFixed(2) : 'N/A',
    count: bandStats.count ?? 'N/A',
  }));
};

// Format bounds for display
export const formatBounds = (bounds: number[] | null) => {
  if (!bounds || !Array.isArray(bounds) || bounds.length !== 4) {
    return null;
  }

  const [minX, minY, maxX, maxY] = bounds;
  return {
    minX: minX.toFixed(6),
    minY: minY.toFixed(6),
    maxX: maxX.toFixed(6),
    maxY: maxY.toFixed(6),
    width: (maxX - minX).toFixed(6),
    height: (maxY - minY).toFixed(6),
  };
};

// Format pixel size for display
export const formatPixelSize = (pixelSize: number[] | null) => {
  if (!pixelSize || !Array.isArray(pixelSize) || pixelSize.length !== 2) {
    return null;
  }

  const [xRes, yRes] = pixelSize;
  return {
    x: Math.abs(xRes).toFixed(6),
    y: Math.abs(yRes).toFixed(6),
    unit: 'degrees', // Assuming geographic coordinates, could be enhanced to detect units
  };
};

// Get tile URL for preview
export const getTileUrl = (filename: string, z = '{z}', x = '{x}', y = '{y}') => {
  // Use public base on client; fallback to internal URL if not provided
  const base = TITILER_PUBLIC_URL ?? TITILER_INTERNAL_URL;
  const fileUrl = `file:///app/images/${encodeURIComponent(filename)}`;
  return `${base.replace(/\/$/, '')}/map/cog/tiles/${z}/${x}/${y}?url=${encodeURIComponent(fileUrl)}`;
};

// Get preview URL for the layer
export const getPreviewUrl = (filename: string, width = 256, height = 256) => {
  const base = TITILER_PUBLIC_URL ?? TITILER_INTERNAL_URL;
  const fileUrl = `file:///app/images/${encodeURIComponent(filename)}`;
  return `${base.replace(/\/$/, '')}/map/cog/preview?url=${encodeURIComponent(fileUrl)}&width=${width}&height=${height}`;
};