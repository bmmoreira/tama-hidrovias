"use client";
import React, { useEffect, useState } from 'react';
import { formatBounds, formatCogStatistics, formatPixelSize } from '@/lib/titiler';
import { Card } from '@/components/ui/card';

export default function MetadataPanel({ name, initialInfo }: { name: string; initialInfo: any | null }) {
  const [info, setInfo] = useState<any | null>(initialInfo ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileUrl = `file:///app/images/${encodeURIComponent(name)}`;

  const fetchInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/titiler/map/cog/info?url=${encodeURIComponent(fileUrl)}`);
      if (!r.ok) {
        const text = await r.text();
        throw new Error(`Failed to fetch info: ${r.status} ${r.statusText} ${text}`);
      }
      const j = await r.json();
      setInfo(j);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!info) {
      // attempt a client-side fetch if server-provided info was null
      fetchInfo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bounds = formatBounds(info?.bounds ?? null);
  const stats = formatCogStatistics(info?.statistics ?? null);
  const px = formatPixelSize(info?.pixel_size ?? null);

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-medium">Metadata</h3>
          <div className="text-sm text-gray-600 mt-1">Source: TiTiler /map/cog/info</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchInfo} className="rounded border px-3 py-1 text-sm">{loading ? 'Refreshing…' : 'Refresh'}</button>
        </div>
      </div>

      {error ? (
        <div className="mt-3 text-sm text-red-600">{error}</div>
      ) : null}

      <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div>
          <div className="font-medium">CRS</div>
          <div className="text-gray-700">{info?.crs ?? '—'}</div>

          <div className="font-medium mt-2">Dimensions</div>
          <div className="text-gray-700">{info ? `${info.width} × ${info.height}` : '—'}</div>

          <div className="font-medium mt-2">Bands</div>
          <div className="text-gray-700">{info?.bands ? info.bands.map((b: any) => b.description || b.name || b).join(', ') : '—'}</div>

          <div className="font-medium mt-2">Data type</div>
          <div className="text-gray-700">{info?.data_type ?? '—'}</div>

          <div className="font-medium mt-2">NoData</div>
          <div className="text-gray-700">{info?.nodata ?? '—'}</div>
        </div>

        <div>
          <div className="font-medium">Bounds (EPSG:3857)</div>
          {bounds ? (
            <div className="text-gray-700">
              <div>minX: {bounds.minX}</div>
              <div>minY: {bounds.minY}</div>
              <div>maxX: {bounds.maxX}</div>
              <div>maxY: {bounds.maxY}</div>
            </div>
          ) : (
            <div className="text-gray-700">—</div>
          )}

          <div className="font-medium mt-2">Pixel size</div>
          {px ? (
            <div className="text-gray-700">{px.x} × {px.y} ({px.unit})</div>
          ) : (
            <div className="text-gray-700">—</div>
          )}

          <div className="font-medium mt-2">Overviews</div>
          <div className="text-gray-700">{info?.overviews ? (Array.isArray(info.overviews) ? info.overviews.join(', ') : String(info.overviews)) : '—'}</div>

          <div className="font-medium mt-2">COG optimized</div>
          <div className="text-gray-700">{info?.is_cog ? 'Yes' : 'No'}</div>
        </div>
      </div>

      <div className="mt-3">
        <div className="font-medium text-sm">Statistics (per band)</div>
        {stats ? (
          <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            {stats.map((s: any) => (
              <div key={s.band} className="rounded border p-2">
                <div className="font-medium">Band {s.band}</div>
                <div>min: {s.min}</div>
                <div>max: {s.max}</div>
                <div>mean: {s.mean}</div>
                <div>stddev: {s.stddev}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-700 mt-1">No statistics available</div>
        )}
      </div>
    </Card>
  );
}
