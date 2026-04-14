/**
 * Climate layers dashboard route (``/dashboard/climate-layers``).
 *
 * Lets analysts browse available climate GeoTIFF layers from
 * Strapi, inspect metadata and preview them on top of the base map
 * using the tileserver-backed raster overlay.
 */
'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import useSWR from 'swr';
import { Layers, Calendar, Database, Map } from 'lucide-react';
import { getClimateLayers } from '@/lib/strapi';
import type { ClimateLayer } from '@/lib/strapi';
import { Card } from '@/components/ui/card';
import { useTranslation } from '@/lib/use-app-translation';

const MapboxMap = dynamic(() => import('@/components/MapboxMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-gray-100">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
    </div>
  ),
});

const TILESERVER_URL =
  process.env.NEXT_PUBLIC_TILESERVER_URL ?? 'http://localhost:8080';

/** Build a TileServer URL for the given climate layer GeoTIFF. */
function layerTileUrl(layer: ClimateLayer): string | undefined {
  // Derive a TileServer URL from the uploaded geotiff's file name
  const fileName = layer.attributes.geotiff?.data?.attributes.name;
  if (!fileName) return undefined;
  const slug = encodeURIComponent(fileName.replace(/\.tiff?$/i, ''));
  return `${TILESERVER_URL}/data/${slug}/{z}/{x}/{y}.png`;
}

/** Format ISO date strings into a short, localized label. */
function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

/**
 * Interactive list and preview map for climate layers.
 */
export default function ClimateLayersPage() {
  const { t } = useTranslation();
  const [selectedLayer, setSelectedLayer] = useState<ClimateLayer | null>(null);

  const { data, isLoading } = useSWR('climate-layers', () =>
    getClimateLayers(),
  );

  const layers: ClimateLayer[] = data?.data ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{t('climate.title')}</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {t('climate.subtitle')}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Layer list */}
        <div className="space-y-3">
          {isLoading &&
            [...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-slate-800"
              />
            ))}

          {!isLoading && layers.length === 0 && (
            <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400 dark:border-slate-800 dark:text-slate-500">
              {t('climate.noLayers')}
            </div>
          )}

          {layers.map((layer: ClimateLayer) => (
            <button
              key={layer.id}
              onClick={() =>
                setSelectedLayer(
                  selectedLayer?.id === layer.id ? null : layer,
                )
              }
              className={`w-full rounded-xl border p-4 text-left shadow-sm transition hover:border-blue-200 hover:shadow-md ${
                selectedLayer?.id === layer.id
                  ? 'border-blue-400 bg-blue-50 dark:border-sky-700 dark:bg-sky-950/40'
                  : 'border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-950'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-lg bg-blue-100 p-2 text-blue-700 dark:bg-sky-950/60 dark:text-sky-300">
                  <Layers className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900 dark:text-slate-100">
                    {layer.attributes.title}
                  </p>
                  {layer.attributes.model && (
                    <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-slate-400">
                      {t('climate.model')}: {layer.attributes.model}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 dark:text-slate-500">
                    <span className="flex items-center gap-1">
                      <Database className="h-3 w-3" />
                      {layer.attributes.variable}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(layer.attributes.period_start)} —{' '}
                      {formatDate(layer.attributes.period_end)}
                    </span>
                  </div>
                </div>
                {selectedLayer?.id === layer.id && (
                  <Map className="h-4 w-4 shrink-0 text-blue-600 dark:text-sky-300" />
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Preview map */}
        <Card className="sticky top-4 h-80 overflow-hidden bg-gray-100 lg:h-[500px] dark:border-slate-800 dark:bg-slate-900">
          {selectedLayer ? (
            <MapboxMap
              initialViewState={{ longitude: -52, latitude: -15, zoom: 4 }}
              stations={[]}
              tileLayerUrl={layerTileUrl(selectedLayer)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400 dark:text-slate-500">
              <Map className="h-10 w-10 text-gray-300 dark:text-slate-700" />
              <p className="text-sm">{t('climate.selectLayer')}</p>
            </div>
          )}

          {selectedLayer && (
            <div className="absolute bottom-3 left-3 rounded-lg bg-white/90 px-3 py-1.5 text-xs text-gray-700 shadow backdrop-blur dark:bg-slate-950/90 dark:text-slate-200">
              <strong>{selectedLayer.attributes.title}</strong> ·{' '}
              {selectedLayer.attributes.variable}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
