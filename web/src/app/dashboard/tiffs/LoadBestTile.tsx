"use client";
import React, { useState } from 'react';
import { mercatorToLonLat, lonLatToTile } from '@/lib/tiles';
import { useTranslation } from '@/lib/use-app-translation';
import { Loader2, Check, X } from 'lucide-react';

export default function LoadBestTile({ name, info }: { name: string; info: any }) {
  const [tileUrl, setTileUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [fetchedInfo, setFetchedInfo] = useState<any | null>(null);
  const [colorize, setColorize] = useState<boolean>(true);
  const colormaps = ['viridis', 'magma', 'plasma', 'inferno', 'gray'];
  const [colormap, setColormap] = useState<string>(colormaps[0]);
  const { t } = useTranslation();

  const handleClick = async () => {
    setStatus('computing');
    try {
      // Determine which info to use: server-provided `info` or client-fetched
      let effectiveInfo = info ?? fetchedInfo;

      if (!effectiveInfo || !effectiveInfo.bounds || !effectiveInfo.width) {
        // Attempt a client-side fetch of COG info via the proxy
        setStatus('fetchingInfo');
        try {
          const cogUrl = `/api/titiler/map/cog/info?url=${encodeURIComponent(`file:///app/images/${name}`)}`;
          const r = await fetch(cogUrl, { method: 'GET' });
          if (!r.ok) {
            setStatus('missingInfo');
            return;
          }
          const j = await r.json();
          if (!j) {
            setStatus('missingInfo');
            return;
          }
          setFetchedInfo(j);
          effectiveInfo = j;
        } catch (e) {
          setStatus('missingInfo');
          return;
        }
      }

      // Validate effectiveInfo now contains bounds and width
      if (!effectiveInfo || !effectiveInfo.bounds || !effectiveInfo.width) {
        setStatus('missingInfo');
        return;
      }

      const [minX, minY, maxX, maxY] = effectiveInfo.bounds;
      const widthPx = effectiveInfo.width;
      const boundsWidthMeters = Math.abs(maxX - minX);
      const pixelSizeMeters = boundsWidthMeters / widthPx;

      // Earth circumference in meters at equator for WebMercator approximation
      const C = 40075016.686;

      // desired tile span in meters to match the dataset pixel size
      const desiredTileSpan = pixelSizeMeters * 256;
      let z = Math.round(Math.log2(C / desiredTileSpan));
      z = Math.max(0, Math.min(22, z));

      const sw = mercatorToLonLat(minX, minY);
      const ne = mercatorToLonLat(maxX, maxY);

      // Try zoom and fallback down until we find an available tile. For
      // each zoom compute the tile x/y range that covers the COG bounds
      // and probe a tile from the interior of that range (more likely to
      // exist than using the geographic center alone when datasets are
      // oddly shaped).
      for (let tryZ = z; tryZ >= 0; tryZ--) {
        // top-left (west,north) and bottom-right (east,south)
        const tl = lonLatToTile(sw[0], ne[1], tryZ);
        const br = lonLatToTile(ne[0], sw[1], tryZ);
        const tileCount = 1 << tryZ;
        const xMin = Math.max(0, Math.min(tl.x, br.x));
        const xMax = Math.min(tileCount - 1, Math.max(tl.x, br.x));
        const yMin = Math.max(0, Math.min(tl.y, br.y));
        const yMax = Math.min(tileCount - 1, Math.max(tl.y, br.y));

        // pick a tile in the middle of the valid range
        const x = Math.floor((xMin + xMax) / 2);
        const y = Math.floor((yMin + yMax) / 2);
        const tileMatrix = 'WebMercatorQuad';

        // Build tile URL and colorization params
        const baseFileUrl = `file:///app/images/${name}`;
        const params: string[] = [];
        params.push('format=png');
        params.push('bidx=1');

        // Compute rescale from stats if available
        let rescaleMin = 0;
        let rescaleMax = 255;
        try {
          const stats = effectiveInfo?.statistics;
          if (Array.isArray(stats) && stats[0] && typeof stats[0].min === 'number' && typeof stats[0].max === 'number') {
            rescaleMin = Math.round(stats[0].min);
            rescaleMax = Math.round(stats[0].max);
          }
        } catch (e) {
          // keep defaults
        }
        params.push(`rescale=${rescaleMin},${rescaleMax}`);

        if (colorize) {
          params.push(`colormap_name=${encodeURIComponent(colormap)}`);
        }

        const url = `/api/titiler/map/cog/tiles/${tileMatrix}/${tryZ}/${x}/${y}?url=${encodeURIComponent(baseFileUrl)}&${params.join('&')}`;

        try {
          const resp = await fetch(url, { method: 'GET' });
          if (resp.ok) {
            setTileUrl(url);
            setStatus(`found z=${tryZ}`);
            return;
          }
          if (resp.status === 502) {
            let msg = 'Upstream error';
            try {
              const j = await resp.json();
              msg = j?.message || JSON.stringify(j);
            } catch (e) {
              msg = await resp.text();
            }
            setStatus(`error: ${msg}`);
            return;
          }
        } catch (e) {
          // ignore and continue to next zoom
        }
      }

      setStatus('notFound');
    } catch (e: any) {
      setStatus(e?.message ?? String(e));
    }
  };

  const renderStatus = () => {
    if (!status) return null;
    if (status === 'computing' || status === 'fetchingInfo') {
      return (
        <div className="mt-2 flex items-center gap-2 text-sm text-gray-600" aria-live="polite">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t('dashboard.tiffs.computing')}</span>
        </div>
      );
    }
    if (status === 'missingInfo') {
      return <div className="mt-2 text-sm text-gray-600">{t('dashboard.tiffs.missingInfo')}</div>;
    }
    if (status === 'notFound') {
      return (
        <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
          <X className="h-4 w-4 text-red-600" />
          <span>{t('dashboard.tiffs.notFound')}</span>
        </div>
      );
    }
    if (status.startsWith('found')) {
      const m = status.match(/z=(\d+)/);
      const z = m ? m[1] : undefined;
      return (
        <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
          <Check className="h-4 w-4 text-green-600" />
          <span>{t('dashboard.tiffs.found', { z })}</span>
        </div>
      );
    }

    return <div className="mt-2 text-sm text-gray-600">{status}</div>;
  };

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3 mb-2">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={colorize} onChange={(e) => setColorize(e.target.checked)} />
          <span className="text-sm">Colorize</span>
        </label>
        <select value={colormap} onChange={(e) => setColormap(e.target.value)} className="rounded border px-2 py-1 text-sm">
          {colormaps.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <button onClick={handleClick} className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-white">
        <span>{t('dashboard.tiffs.loadBestTile')}</span>
      </button>
      {renderStatus()}
      {tileUrl ? (
        <div className="mt-2">
          <img src={tileUrl} alt="tile" />
        </div>
      ) : null}
    </div>
  );
}
