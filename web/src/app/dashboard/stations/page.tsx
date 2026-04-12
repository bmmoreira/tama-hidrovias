'use client';

import React from 'react';
import type { Station } from '@/lib/strapi';

import { useState } from 'react';
import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { Pencil, Plus, Search, Trash2, TriangleAlert } from 'lucide-react';
import { useTranslation } from '@/lib/use-app-translation';
import { deleteStation, getStations } from '@/lib/strapi';
import ConfirmationModal from '@/components/ConfirmationModal';
import Toast from '@/components/Toast';
import { isAnalystRole } from '@/lib/roles';
import ProtectedActionButton from '@/components/ProtectedActionButton';
import ReadOnlyBadge from '@/components/ReadOnlyBadge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import StationFormModal from './StationFormModal';

const SOURCES = ['all', 'ANA', 'HydroWeb', 'SNIRH', 'Virtual'] as const;
const ALL_BASINS = '__all_basins__';

type ToastState = {
  message: string;
  variant: 'success' | 'error';
};

type RowMutationState = {
  stationId: number;
  action: 'edit' | 'delete';
} | null;

export default function StationsPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [confirmingDeleteStation, setConfirmingDeleteStation] = useState<Station | null>(null);
  const [rowMutation, setRowMutation] = useState<RowMutationState>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<(typeof SOURCES)[number]>(
    'all',
  );
  const [basinFilter, setBasinFilter] = useState('');

  const { data, isLoading, mutate } = useSWR('stations-list', () =>
    getStations(),
  );

  const stations = data?.data ?? [];

  const basins = Array.from(
    new Set(stations.map((s: Station) => s.attributes.basin).filter(Boolean)),
  ).sort() as string[];

  const filtered = stations.filter((s: Station) => {
    const matchQuery =
      !query ||
      s.attributes.name.toLowerCase().includes(query.toLowerCase()) ||
      s.attributes.code.toLowerCase().includes(query.toLowerCase());
    const matchSource =
      sourceFilter === 'all' || s.attributes.source === sourceFilter;
    const matchBasin = !basinFilter || s.attributes.basin === basinFilter;
    return matchQuery && matchSource && matchBasin;
  });

  const canManageStations = isAnalystRole(session?.user?.role);

  function showToast(message: string, variant: ToastState['variant']) {
    setToast({ message, variant });
  }

  async function handleDeleteStation() {
    if (!confirmingDeleteStation) {
      return;
    }

    setRowMutation({ stationId: confirmingDeleteStation.id, action: 'delete' });
    try {
      await deleteStation(confirmingDeleteStation.id);
      await mutate();
      showToast(t('stations.deleted'), 'success');
      setConfirmingDeleteStation(null);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t('stations.deleteError'),
        'error',
      );
    } finally {
      setRowMutation(null);
    }
  }

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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{t('stations.title')}</h1>
            {!canManageStations ? <ReadOnlyBadge /> : null}
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {t('stations.registeredCount', { count: data?.meta.pagination.total ?? 0 })}
          </p>
        </div>
        <ProtectedActionButton
          allowed={canManageStations}
          onClick={() => setModalOpen(true)}
          title={t('stations.createTitle')}
          deniedReason={t('stations.analystCreateOnly')}
          helperText={t('stations.analystActionOnly')}
        >
            <Plus className="h-4 w-4" />
            {t('stations.createButton')}
        </ProtectedActionButton>
      </div>

      {/* Filters */}
      <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('stations.searchPlaceholder')}
            className="pl-9"
          />
        </div>
        <Select
          value={sourceFilter}
          onValueChange={(value) =>
            setSourceFilter(value as (typeof SOURCES)[number])
          }
        >
          <SelectTrigger className="sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
          {SOURCES.map((s) => (
            <SelectItem key={s} value={s}>
              {s === 'all' ? t('stations.allSources') : s}
            </SelectItem>
          ))}
          </SelectContent>
        </Select>
        <Select
          value={basinFilter || ALL_BASINS}
          onValueChange={(value) => setBasinFilter(value === ALL_BASINS ? '' : value)}
        >
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder={t('stations.allBasins')} />
          </SelectTrigger>
          <SelectContent>
          <SelectItem value={ALL_BASINS}>{t('stations.allBasins')}</SelectItem>
          {basins.map((b) => (
            <SelectItem key={b} value={b}>
              {b}
            </SelectItem>
          ))}
          </SelectContent>
        </Select>
      </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 dark:border-slate-800 dark:bg-slate-900">
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-300">
                  {t('stations.code')}
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-300">
                  {t('stations.name')}
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-300">
                  {t('stations.source')}
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-300">
                  {t('stations.basin')}
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-300">
                  {t('stations.river')}
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-slate-300">
                  {t('stations.latLon')}
                </th>
                <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-slate-300">
                  {t('stations.status')}
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-slate-300">
                  {t('stations.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
              {isLoading &&
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(8)].map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 animate-pulse rounded bg-gray-100 dark:bg-slate-800" />
                      </td>
                    ))}
                  </tr>
                ))}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-gray-400 dark:text-slate-500"
                  >
                    {t('stations.empty')}
                  </td>
                </tr>
              )}
              {filtered.map((station: Station) => (
                <StationRow
                  key={station.id}
                  station={station}
                  canManageStations={canManageStations}
                  rowMutation={rowMutation}
                  t={t}
                  onEdit={() => setEditingStation(station)}
                  onDelete={() => setConfirmingDeleteStation(station)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {canManageStations ? (
        <StationFormModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSaved={(message) => {
            setModalOpen(false);
            showToast(message, 'success');
            mutate();
          }}
          onError={(message) => showToast(message, 'error')}
        />
      ) : null}

      {canManageStations ? (
        <StationFormModal
          isOpen={Boolean(editingStation)}
          station={editingStation}
          onClose={() => {
            setEditingStation(null);
            setRowMutation(null);
          }}
          onSaved={(message) => {
            setEditingStation(null);
            setRowMutation(null);
            showToast(message, 'success');
            mutate();
          }}
          onError={(message) => showToast(message, 'error')}
          onSubmittingChange={(isSubmitting) => {
            if (!editingStation) {
              return;
            }

            setRowMutation((current) => {
              if (isSubmitting) {
                return { stationId: editingStation.id, action: 'edit' };
              }

              if (
                current?.stationId === editingStation.id &&
                current.action === 'edit'
              ) {
                return null;
              }

              return current;
            });
          }}
        />
      ) : null}

      {canManageStations ? (
        <ConfirmationModal
          isOpen={Boolean(confirmingDeleteStation)}
          title={t('stations.confirmDelete')}
          description={t('stations.confirmDeleteDescription')}
          confirmLabel={
            rowMutation?.action === 'delete' ? t('stations.deleting') : t('stations.deleteStation')
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

            setConfirmingDeleteStation(null);
          }}
          onConfirm={handleDeleteStation}
        >
          {confirmingDeleteStation ? (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-900">
              <p className="font-medium">
                {confirmingDeleteStation.attributes.name} (
                {confirmingDeleteStation.attributes.code})
              </p>
              <p className="mt-1 text-red-800">
                {t('stations.deleteDependencyWarning')}
              </p>
            </div>
          ) : null}
        </ConfirmationModal>
      ) : null}
    </div>
  );
}

function StationRow({
  station,
  canManageStations,
  rowMutation,
  t,
  onEdit,
  onDelete,
}: {
  station: Station;
  canManageStations: boolean;
  rowMutation: RowMutationState;
  t: (key: string, options?: Record<string, unknown>) => string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const a = station.attributes;
  const isEditing =
    rowMutation?.stationId === station.id && rowMutation.action === 'edit';
  const isDeleting =
    rowMutation?.stationId === station.id && rowMutation.action === 'delete';
  const isBusy = isEditing || isDeleting;
  const sourceColors: Record<string, string> = {
    ANA: 'bg-blue-100 text-blue-700',
    HydroWeb: 'bg-green-100 text-green-700',
    SNIRH: 'bg-amber-100 text-amber-700',
    Virtual: 'bg-purple-100 text-purple-700',
  };

  return (
    <tr className="transition hover:bg-gray-50 dark:hover:bg-slate-900/60">
      <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-slate-300">{a.code}</td>
      <td className="px-4 py-3 font-medium text-gray-900 dark:text-slate-100">{a.name}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            sourceColors[a.source ?? ''] ?? 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          {a.source}
        </span>
      </td>
      <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{a.basin || '—'}</td>
      <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{a.river || '—'}</td>
      <td className="px-4 py-3 text-right font-mono text-xs text-gray-500 dark:text-slate-400">
        {a.latitude.toFixed(4)}, {a.longitude.toFixed(4)}
      </td>
      <td className="px-4 py-3 text-center">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            a.active ? 'bg-green-500' : 'bg-gray-300'
          }`}
          title={a.active ? t('stations.active') : t('stations.inactive')}
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            onClick={onEdit}
            disabled={!canManageStations || isBusy}
            title={
              canManageStations
                ? t('stations.editStation')
                : t('stations.analystEditOnly')
            }
            variant="outline"
            size="sm"
            className="gap-1 border-gray-200 text-gray-600 hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:text-slate-200 dark:hover:border-sky-700 dark:hover:text-sky-300"
          >
            <Pencil className="h-3.5 w-3.5" />
            {isEditing ? t('stations.saving') : t('stations.edit')}
          </Button>
          <Button
            type="button"
            onClick={onDelete}
            disabled={!canManageStations || isBusy}
            title={
              canManageStations
                ? t('stations.deleteStation')
                : t('stations.analystDeleteOnly')
            }
            variant="outline"
            size="sm"
            className="gap-1 border-gray-200 text-gray-600 hover:border-red-200 hover:text-red-700 dark:border-slate-700 dark:text-slate-200 dark:hover:border-red-700 dark:hover:text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {isDeleting ? t('stations.deleting') : 'Excluir'}
          </Button>
        </div>
      </td>
    </tr>
  );
}
