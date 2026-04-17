import { fetchCogInfo } from '@/lib/titiler';
import { Card } from '@/components/ui/card';
import { mercatorToLonLat } from '@/lib/tiles';
import MapViewer from '../MapViewer';
import LoadBestTile from '../LoadBestTile';
import MetadataPanel from '../MetadataPanel';

export default async function TiffDetail({ params }: any) {
  // Accept `params` as `any` to remain compatible with Next's evolving
  // PageProps typing across versions; guard access to `params.name`.
  const name = decodeURIComponent((params && params.name) ? params.name : '');
  const info = await fetchCogInfo(name);

  let center: [number, number] | undefined = undefined;
  let fitBounds: [number, number, number, number] | undefined = undefined;
  if (info?.bounds && Array.isArray(info.bounds) && info.bounds.length === 4) {
    const [minX, minY, maxX, maxY] = info.bounds;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    center = mercatorToLonLat(cx, cy);
    const sw = mercatorToLonLat(minX, minY);
    const ne = mercatorToLonLat(maxX, maxY);
    fitBounds = [sw[0], sw[1], ne[0], ne[1]];
  }

  // Prefer relative proxy so it goes through Next
  // Include the TileMatrixSet identifier required by TiTiler (WebMercatorQuad)
  const relativeTileUrl = `/api/titiler/map/cog/tiles/WebMercatorQuad/{z}/{x}/{y}?url=${encodeURIComponent(
    `file:///app/images/${name}`,
  )}`;

  // Compute an approximate preferred zoom level from the dataset pixel size
  // so we can suggest sensible min/max zooms for Mapbox and avoid many
  // out-of-bounds tile requests. Fall back to a small default range.
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
    // ignore and leave min/max undefined
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{name}</h1>
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <MetadataPanel name={name} initialInfo={info} />
          </div>
          <div>
            <h2 className="text-lg font-medium">Preview</h2>
            <div className="mt-2">
              <img src={`/api/titiler/map/cog/preview?url=${encodeURIComponent(`file:///app/images/${name}`)}&width=512&height=512`} alt="preview" />
              <LoadBestTile name={name} info={info} />
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-medium mb-2">Map</h2>
  <MapViewer tileUrl={relativeTileUrl} center={center} fitBounds={fitBounds} minZoom={minZoom} maxZoom={maxZoom} />
      </Card>
    </div>
  );
}
