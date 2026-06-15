'use client';

import React, { useState, useRef, useMemo } from 'react';
import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import {
  FileImage,
  Trash2,
  Folder,
  Loader2,
  MapPin,
  Droplets,
  Calendar,
  Palette,
  Layers,
  Ruler,
  Globe,
  RefreshCw,
} from 'lucide-react';
import { useTranslation } from '@/lib/use-app-translation';
import ConfirmationModal from '@/components/ConfirmationModal';
import Toast from '@/components/Toast';
import { isAnalystRole } from '@/lib/roles';
import ProtectedActionButton from '@/components/ProtectedActionButton';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getRasterLayers, syncRasterLayer } from '@/lib/strapi';
import type { RasterLayer } from '@/lib/strapi';
import { getRasterLayerFileBaseName } from '@/lib/raster-layer-filename';

type ForecastTiffsData = {
  directory: string;
  files: { name: string; path: string }[];
};

type ForecastTiffsResponse = {
  data: ForecastTiffsData[];
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to load TIFFs');
  return (await res.json()) as ForecastTiffsResponse;
};

/** Formats an ISO date string into a short, localized label. */
function formatAcquisitionDate(dateStr?: string | null, timeStr?: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr).toLocaleDateString('pt-BR');
  if (!timeStr) return date;
  return `${date} ${timeStr.slice(0, 5)}`;
}

/** Formats a [minX, minY, maxX, maxY] bounds array for display. */
function formatBounds(bounds?: unknown): string | null {
  if (!Array.isArray(bounds) || bounds.length !== 4) return null;
  return bounds.map((value) => Number(value).toFixed(2)).join(', ');
}

export default function ForecastTiffsPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);
  const [fileToDelete, setFileToDelete] = useState<{ name: string; path: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [uploadDir, setUploadDir] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, mutate } = useSWR('/api/forecast-tiffs', fetcher);
  const directories = data?.data ?? [];

  const [syncingPath, setSyncingPath] = useState<string | null>(null);

  const { data: rasterLayersData, mutate: mutateRasterLayers } = useSWR('raster-layers', () =>
    getRasterLayers(),
  );
  const rasterLayers = rasterLayersData?.data ?? [];

  const rasterLayerByFile = useMemo(() => {
    const map = new Map<string, RasterLayer>();
    for (const layer of rasterLayers) {
      map.set(getRasterLayerFileBaseName(layer.attributes.file_url), layer);
    }
    return map;
  }, [rasterLayers]);

  const canManage = isAnalystRole(session?.user?.role);

  const handleDelete = async () => {
    if (!fileToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/forecast-tiffs?path=${encodeURIComponent(fileToDelete.path)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed');
      
      setToast({ message: t('actions.deleted') || 'File deleted', variant: 'success' });
      await mutate();
    } catch (error) {
      setToast({ message: t('actions.error') || 'Error deleting file', variant: 'error' });
    } finally {
      setIsDeleting(false);
      setFileToDelete(null);
    }
  };

  const handleSync = async (file: { name: string; path: string }) => {
    setSyncingPath(file.path);
    try {
      await syncRasterLayer(file.path);
      setToast({ message: t('actions.saved') || 'Metadata updated', variant: 'success' });
      await mutateRasterLayers();
    } catch (error) {
      setToast({ message: t('actions.error') || 'Error updating metadata', variant: 'error' });
    } finally {
      setSyncingPath(null);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadDir.trim()) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('directory', uploadDir.trim());
      formData.append('file', file);

      const res = await fetch('/api/forecast-tiffs', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');

      setToast({ message: t('actions.saved') || 'File uploaded', variant: 'success' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      await mutate();
    } catch (error) {
      setToast({ message: t('actions.error') || 'Error uploading file', variant: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      )}

      {fileToDelete && (
        <ConfirmationModal
          isOpen={true}
          title={t('forecastDrawer.deleteTiff') || 'Delete TIFF File'}
          description={`Are you sure you want to delete ${fileToDelete.name}?`}
          confirmLabel={t('actions.delete') || 'Delete'}
          cancelLabel={t('actions.cancel') || 'Cancel'}
          onConfirm={handleDelete}
          onClose={() => setFileToDelete(null)}
          loading={isDeleting}
        />
      )}

      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Forecast TIFFs</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage GeoTIFF forecast rasters used in map overlays
          </p>
        </div>
      </div>

      {canManage && (
        <Card className="p-4 sm:p-6 bg-blue-50/50">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Upload New TIFF</h2>
            <p className="text-xs text-gray-500">Select a folder to upload your .tiff file into.</p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <label className="text-xs font-medium text-gray-700">Folder Name</label>
              <Input
                placeholder="e.g. tapajos"
                value={uploadDir}
                onChange={(e) => setUploadDir(e.target.value)}
                disabled={isUploading}
              />
            </div>
            <div className="flex-1 space-y-2">
              <label className="text-xs font-medium text-gray-700">TIFF File</label>
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept=".tif,.tiff"
                  ref={fileInputRef}
                  disabled={!uploadDir.trim() || isUploading}
                  className="file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                  onChange={handleUpload}
                />
              </div>
            </div>
          </div>
          {isUploading && (
            <div className="mt-4 flex items-center gap-2 text-sm text-blue-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading...
            </div>
          )}
        </Card>
      )}

      <div className="space-y-6">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : directories.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-12 text-center">
            <FileImage className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-2 text-sm font-semibold text-gray-900">
              No Forecast TIFFs
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Upload files to see them here.
            </p>
          </Card>
        ) : (
          directories.map((dir) => (
            <Card key={dir.directory} className="overflow-hidden">
              <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/50 px-4 py-3">
                <Folder className="h-5 w-5 text-gray-400" />
                <h3 className="font-semibold text-gray-700">{dir.directory}</h3>
                <span className="ml-auto rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-gray-500 border border-gray-200">
                  {dir.files.length} files
                </span>
              </div>
              <ul className="divide-y divide-gray-100">
                {dir.files.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-gray-500 text-center">Empty directory</li>
                ) : (
                  dir.files.map((file) => {
                    const layer = rasterLayerByFile.get(file.name);
                    const attrs = layer?.attributes;
                    const bounds = formatBounds(attrs?.bounds);

                    return (
                      <li key={file.path} className="px-4 py-3 hover:bg-gray-50/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <FileImage className="h-4 w-4 text-gray-400 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-700 truncate">
                                {attrs?.display_name || file.name}
                              </p>
                              {attrs?.display_name && (
                                <p className="text-xs text-gray-400 truncate">{file.name}</p>
                              )}
                            </div>
                          </div>
                          <div className="ml-4 flex shrink-0 items-center gap-1">
                            <ProtectedActionButton
                              allowed={canManage}
                              onClick={() => handleSync(file)}
                              disabled={syncingPath === file.path}
                              className="p-2 text-gray-400 hover:text-blue-600 rounded-md transition disabled:opacity-50"
                              title="Update raster layer metadata"
                            >
                              {syncingPath === file.path ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                            </ProtectedActionButton>
                            <ProtectedActionButton
                              allowed={canManage}
                              onClick={() => setFileToDelete(file)}
                              className="p-2 text-gray-400 hover:text-red-600 rounded-md transition"
                              title="Delete file"
                            >
                              <Trash2 className="h-4 w-4" />
                            </ProtectedActionButton>
                          </div>
                        </div>

                        {attrs && (
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 pl-7 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-gray-400" />
                              {attrs.area_name}
                            </span>
                            <span className="flex items-center gap-1">
                              <Droplets className="h-3 w-3 text-gray-400" />
                              {attrs.hydrology_variable}
                            </span>
                            {(attrs.acquisition_date || attrs.acquisition_time) && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-gray-400" />
                                {formatAcquisitionDate(attrs.acquisition_date, attrs.acquisition_time)}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Palette className="h-3 w-3 text-gray-400" />
                              {attrs.colormap_name ?? 'viridis'} ({attrs.computed_min} – {attrs.computed_max})
                            </span>
                            {attrs.width != null && attrs.height != null && (
                              <span className="flex items-center gap-1">
                                <Ruler className="h-3 w-3 text-gray-400" />
                                {attrs.width} × {attrs.height} px
                                {attrs.band_count != null && `, ${attrs.band_count} band${attrs.band_count === 1 ? '' : 's'}`}
                                {attrs.dtype && ` (${attrs.dtype})`}
                              </span>
                            )}
                            {(attrs.file_projection || attrs.crs) && (
                              <span className="flex items-center gap-1">
                                <Globe className="h-3 w-3 text-gray-400" />
                                {attrs.file_projection ?? attrs.crs}
                              </span>
                            )}
                            {bounds && (
                              <span className="flex items-center gap-1">
                                <Layers className="h-3 w-3 text-gray-400" />
                                [{bounds}]
                              </span>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })
                )}
              </ul>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
