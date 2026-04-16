import React from 'react';
import { fetchCogInfo, formatBounds } from '@/lib/titiler';
import MapViewer from '@/app/dashboard/tiffs/MapViewer';

// Server component example: fetches COG info and wires MapViewer with bounds/minZoom/maxZoom
export default async function TiffExampleCard({ filename }: { filename: string }) {
  // Fetch COG metadata server-side
  const info = await fetchCogInfo(filename);

  // Compute center and fitBounds from COG info if available
  let center: [number, number] | undefined = undefined;
  let fitBounds: [number, number, number, number] | undefined = undefined;
  if (info?.bounds && Array.isArray(info.bounds) && info.bounds.length === 4) {
    const [minX, minY, maxX, maxY] = info.bounds;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    // MapViewer/MapBase expect lon/lat order; the app generally uses EPSG:3857 mercator in helpers
    // Here we assume the COG bounds are already in WebMercator coordinates. If not, transform as needed.
    center = [cx, cy];
    // Convert to [west, south, east, north] for MapViewer
    fitBounds = [minX, minY, maxX, maxY];
  }

  // Build a proxied relative tile URL template so the browser requests go through Next's API proxy
  const relativeTileUrl = `/api/titiler/map/cog/tiles/WebMercatorQuad/{z}/{x}/{y}?url=${encodeURIComponent(
    `file:///app/images/${filename}`,
  )}`;

  // Compute a simple min/max zoom hint from pixel size if available (same heuristic used elsewhere)
  let minZoom: number | undefined = undefined;
  let maxZoom: number | undefined = undefined;
  try {
    if (info?.bounds && Array.isArray(info.bounds) && info.bounds.length === 4 && info.width) {
      const [minX, , maxX] = info.bounds;
      const widthPx = info.width;
      const boundsWidthMeters = Math.abs(maxX - minX);
      const pixelSizeMeters = boundsWidthMeters / widthPx;
      const C = 40075016.686;
      const desiredTileSpan = pixelSizeMeters * 256;
      let z = Math.round(Math.log2(C / desiredTileSpan));
      z = Math.max(0, Math.min(22, z));
      minZoom = Math.max(0, z - 2);
      maxZoom = Math.min(22, z + 2);
    }
  } catch (e) {
    // ignore
  }

  return (
    <div className="border rounded-md p-4">
      <h3 className="text-lg font-semibold">{filename}</h3>
      {info ? (
        <div className="mt-2 space-y-2">
          <div>
            <strong>CRS:</strong> {info.crs ?? 'unknown'}
          </div>
          <div>
            <strong>Size:</strong> {info.width ?? 'N/A'} x {info.height ?? 'N/A'}
          </div>
          <div>
            <strong>Bands:</strong> {info.bands ? info.bands.map((b: any) => b.name ?? b).join(', ') : 'N/A'}
          </div>
          <div>
            <strong>Bounds:</strong>{' '}
            {formatBounds(info.bounds) ? (
              <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(formatBounds(info.bounds), null, 2)}</pre>
            ) : (
              'N/A'
            )}
          </div>

          <div className="mt-4">
            <div className="text-sm font-medium mb-2">Map preview</div>
            <div className="h-[420px]">
              <MapViewer tileUrl={relativeTileUrl} center={center} fitBounds={fitBounds} minZoom={minZoom} maxZoom={maxZoom} />
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-2 text-sm text-muted-foreground">Unable to fetch COG info for this file.</div>
      )}
    </div>
  );
}
