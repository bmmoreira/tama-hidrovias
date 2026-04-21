'use client';

import React from 'react';
import { useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { Pencil, Plus, Search, Trash2, TriangleAlert } from 'lucide-react';
import { useTranslation } from '@/lib/use-app-translation';
import {
  type MapFeatureCollectionFeature,
  type MapFeatureCollectionRecord,
  getMapFeatureCollection,
  updateMapFeatureCollection,
} from '@/lib/strapi';
import Toast from '@/components/Toast';
import ConfirmationModal from '@/components/ConfirmationModal';
import ProtectedActionButton from '@/components/ProtectedActionButton';
import ReadOnlyBadge from '@/components/ReadOnlyBadge';
import { canAccessAdmin } from '@/lib/roles';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import FeatureCollectionFormModal from './FeatureCollectionFormModal';

type ToastState = {
  message: string;
  variant: 'success' | 'error';
};

type RowMutationState = {
  featureIndex: number;
  action: 'edit' | 'delete';
} | null;

function getFeatureLabel(feature: MapFeatureCollectionFeature, index: number) {
  const name = feature.properties.name;
  const identifier = feature.properties.id;
  const river = feature.properties.river;

  if (typeof name === 'string' && name.trim()) {
    return name.trim();
  }

  if (typeof identifier === 'string' || typeof identifier === 'number') {
    return `Feature ${identifier}`;
  }

  if (typeof river === 'string' && river.trim()) {
    return river.trim();
  }

  return `Feature ${index + 1}`;
}

function getPropertyPreview(feature: MapFeatureCollectionFeature) {
  return Object.entries(feature.properties)
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' · ');
}

/**
 * Dashboard editor for the single Strapi-backed GeoJSON feature collection
 * used by the map views.
 */
export default function DashboardMapFeaturesPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const [toast, setToast] = useState<ToastState | null>(null);
  const [query, setQuery] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingFeatureIndex, setEditingFeatureIndex] = useState<number | null>(null);
  const [confirmingDeleteIndex, setConfirmingDeleteIndex] = useState<number | null>(null);
  const [rowMutation, setRowMutation] = useState<RowMutationState>(null);

  const canManageFeatures = canAccessAdmin(session?.user?.role);

  const { data, isLoading, mutate } = useSWR(
    'dashboard-map-feature-collection-editor',
    () => getMapFeatureCollection(),
  );

  const collection = data?.data;
  const features = collection?.featureCollection.features ?? [];

  const filteredFeatures = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const indexedFeatures = features.map((feature, index) => ({ feature, index }));

    if (!normalizedQuery) {
      return indexedFeatures;
    }

    return indexedFeatures.filter(({ feature, index }) => {
      const label = getFeatureLabel(feature, index).toLowerCase();
      const preview = JSON.stringify(feature.properties).toLowerCase();

      return label.includes(normalizedQuery) || preview.includes(normalizedQuery);
    });
  }, [features, query]);

  const editingFeature =
    editingFeatureIndex !== null ? features[editingFeatureIndex] ?? null : null;
  const deletingFeature =
    confirmingDeleteIndex !== null ? features[confirmingDeleteIndex] ?? null : null;

  function showToast(message: string, variant: ToastState['variant']) {
    setToast({ message, variant });
  }

  const persistFeatures = useCallback(
    async (nextFeatures: MapFeatureCollectionFeature[]) => {
      if (!collection) {
        throw new Error(t('mapFeatures.loadError'));
      }

      await updateMapFeatureCollection({
        name: collection.name,
        featureCollection: {
          ...collection.featureCollection,
          features: nextFeatures,
        },
      });

      await mutate();
    },
    [collection, mutate, t],
  );

  const handleCreateFeature = useCallback(
    async (feature: MapFeatureCollectionFeature) => {
      await persistFeatures([...features, feature]);
      showToast(t('mapFeatures.created'), 'success');
      setCreateModalOpen(false);
    },
    [features, persistFeatures, t],
  );

  const handleEditFeature = useCallback(
    async (feature: MapFeatureCollectionFeature) => {
      if (editingFeatureIndex === null) {
        return;
      }

      setRowMutation({ featureIndex: editingFeatureIndex, action: 'edit' });

      try {
        const nextFeatures = [...features];
        nextFeatures[editingFeatureIndex] = feature;
        await persistFeatures(nextFeatures);
        showToast(t('mapFeatures.updated'), 'success');
        setEditingFeatureIndex(null);
      } finally {
        setRowMutation(null);
      }
    },
    [editingFeatureIndex, features, persistFeatures, t],
  );

  const handleDeleteFeature = useCallback(async () => {
    if (confirmingDeleteIndex === null) {
      return;
    }

    setRowMutation({ featureIndex: confirmingDeleteIndex, action: 'delete' });

    try {
      await persistFeatures(
        features.filter((_, index) => index !== confirmingDeleteIndex),
      );
      showToast(t('mapFeatures.deleted'), 'success');
      setConfirmingDeleteIndex(null);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t('mapFeatures.deleteError'),
        'error',
      );
    } finally {
      setRowMutation(null);
    }
  }, [confirmingDeleteIndex, features, persistFeatures, t]);

  return (
    <div className="space-y-5">
      {toast ? (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              {t('mapFeatures.title')}
            </h1>
            {!canManageFeatures ? <ReadOnlyBadge /> : null}
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {t('mapFeatures.featureCount', { count: features.length })}
            {collection?.name ? ` · ${collection.name}` : ''}
          </p>
        </div>
        <ProtectedActionButton
          allowed={canManageFeatures}
          onClick={() => setCreateModalOpen(true)}
          title={t('mapFeatures.createTitle')}
          deniedReason={t('mapFeatures.editorsOnly')}
          helperText={t('mapFeatures.actionOnly')}
        >
          <Plus className="h-4 w-4" />
          {t('mapFeatures.createButton')}
        </ProtectedActionButton>
      </div>

      <Card className="space-y-3 p-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
            {t('mapFeatures.subtitle')}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            {t('mapFeatures.description')}
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
          <Input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('mapFeatures.searchPlaceholder')}
            className="pl-9"
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 dark:border-slate-800 dark:bg-slate-900">
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-300">
                  {t('mapFeatures.feature')}
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-300">
                  {t('mapFeatures.geometry')}
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-slate-300">
                  {t('mapFeatures.coordinates')}
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-300">
                  {t('mapFeatures.properties')}
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-slate-300">
                  {t('mapFeatures.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
              {isLoading
                ? [...Array(6)].map((_, index) => (
                    <tr key={index}>
                      {[...Array(5)].map((__, cellIndex) => (
                        <td key={cellIndex} className="px-4 py-3">
                          <div className="h-4 animate-pulse rounded bg-gray-100 dark:bg-slate-800" />
                        </td>
                      ))}
                    </tr>
                  ))
                : null}
              {!isLoading && filteredFeatures.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-gray-400 dark:text-slate-500"
                  >
                    {t('mapFeatures.empty')}
                  </td>
                </tr>
              ) : null}
              {!isLoading
                ? filteredFeatures.map(({ feature, index }) => (
                    <FeatureRow
                      key={`${getFeatureLabel(feature, index)}-${index}`}
                      feature={feature}
                      featureIndex={index}
                      canManageFeatures={canManageFeatures}
                      rowMutation={rowMutation}
                      t={t}
                      onEdit={() => setEditingFeatureIndex(index)}
                      onDelete={() => setConfirmingDeleteIndex(index)}
                    />
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </Card>

      {canManageFeatures ? (
        <FeatureCollectionFormModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onSubmit={handleCreateFeature}
        />
      ) : null}

      {canManageFeatures ? (
        <FeatureCollectionFormModal
          isOpen={Boolean(editingFeature)}
          feature={editingFeature}
          onClose={() => {
            setEditingFeatureIndex(null);
            setRowMutation(null);
          }}
          onSubmit={handleEditFeature}
        />
      ) : null}

      {canManageFeatures ? (
        <ConfirmationModal
          isOpen={Boolean(deletingFeature)}
          title={t('mapFeatures.confirmDelete')}
          description={t('mapFeatures.confirmDeleteDescription')}
          confirmLabel={
            rowMutation?.action === 'delete'
              ? t('mapFeatures.deleting')
              : t('mapFeatures.deleteFeature')
          }
          loading={rowMutation?.action === 'delete'}
          tone="danger"
          icon={
            <span className="rounded-full bg-red-50 p-2 text-red-600">
              <TriangleAlert className="h-5 w-5" />
            </span>
          }
          onClose={() => {
            if (rowMutation?.action === 'delete') {
              return;
            }

            setConfirmingDeleteIndex(null);
          }}
          onConfirm={handleDeleteFeature}
        >
          {deletingFeature ? (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-900">
              <p className="font-medium">
                {getFeatureLabel(deletingFeature, confirmingDeleteIndex ?? 0)}
              </p>
              <p className="mt-1 text-red-800">
                {t('mapFeatures.deleteWarning')}
              </p>
            </div>
          ) : null}
        </ConfirmationModal>
      ) : null}
    </div>
  );
}

function FeatureRow({
  feature,
  featureIndex,
  canManageFeatures,
  rowMutation,
  t,
  onEdit,
  onDelete,
}: {
  feature: MapFeatureCollectionFeature;
  featureIndex: number;
  canManageFeatures: boolean;
  rowMutation: RowMutationState;
  t: (key: string, options?: Record<string, unknown>) => string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isEditing =
    rowMutation?.featureIndex === featureIndex && rowMutation.action === 'edit';
  const isDeleting =
    rowMutation?.featureIndex === featureIndex && rowMutation.action === 'delete';
  const isBusy = isEditing || isDeleting;

  return (
    <tr className="transition hover:bg-gray-50 dark:hover:bg-slate-900/60">
      <td className="px-4 py-3 align-top">
        <div className="font-medium text-gray-900 dark:text-slate-100">
          {getFeatureLabel(feature, featureIndex)}
        </div>
        <div className="mt-1 text-xs text-gray-500 dark:text-slate-400">
          {t('mapFeatures.propertyCount', {
            count: Object.keys(feature.properties).length,
          })}
        </div>
      </td>
      <td className="px-4 py-3 align-top text-gray-600 dark:text-slate-300">
        {feature.geometry.type}
      </td>
      <td className="px-4 py-3 align-top text-right font-mono text-xs text-gray-500 dark:text-slate-400">
        {feature.geometry.coordinates[1].toFixed(4)},{' '}
        {feature.geometry.coordinates[0].toFixed(4)}
      </td>
      <td className="px-4 py-3 align-top text-xs text-gray-600 dark:text-slate-300">
        {getPropertyPreview(feature) || '—'}
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            onClick={onEdit}
            disabled={!canManageFeatures || isBusy}
            title={
              canManageFeatures
                ? t('mapFeatures.editFeature')
                : t('mapFeatures.editorsOnly')
            }
            variant="outline"
            size="sm"
            className="gap-1 border-gray-200 text-gray-600 hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:text-slate-200 dark:hover:border-sky-700 dark:hover:text-sky-300"
          >
            <Pencil className="h-3.5 w-3.5" />
            {isEditing ? t('mapFeatures.saving') : t('mapFeatures.edit')}
          </Button>
          <Button
            type="button"
            onClick={onDelete}
            disabled={!canManageFeatures || isBusy}
            title={
              canManageFeatures
                ? t('mapFeatures.deleteFeature')
                : t('mapFeatures.editorsOnly')
            }
            variant="outline"
            size="sm"
            className="gap-1 border-gray-200 text-gray-600 hover:border-red-200 hover:text-red-700 dark:border-slate-700 dark:text-slate-200 dark:hover:border-red-700 dark:hover:text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {isDeleting ? t('mapFeatures.deleting') : t('mapFeatures.delete')}
          </Button>
        </div>
      </td>
    </tr>
  );
}