'use client';

import React from 'react';
import type { Station } from '@/lib/strapi';

import { useState } from 'react';
import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { Pencil, Plus, Search, Trash2, TriangleAlert } from 'lucide-react';
import { deleteStation, getStations } from '@/lib/strapi';
import ConfirmationModal from '@/components/ConfirmationModal';
import Toast from '@/components/Toast';
import { isAnalystRole } from '@/lib/roles';
import ProtectedActionButton from '@/components/ProtectedActionButton';
import ReadOnlyBadge from '@/components/ReadOnlyBadge';
import StationFormModal from './StationFormModal';

const SOURCES = ['Todas', 'ANA', 'HydroWeb', 'SNIRH', 'Virtual'] as const;

type ToastState = {
  message: string;
  variant: 'success' | 'error';
};

type RowMutationState = {
  stationId: number;
  action: 'edit' | 'delete';
} | null;

export default function StationsPage() {
  const { data: session } = useSession();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [confirmingDeleteStation, setConfirmingDeleteStation] = useState<Station | null>(null);
  const [rowMutation, setRowMutation] = useState<RowMutationState>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<(typeof SOURCES)[number]>(
    'Todas',
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
      sourceFilter === 'Todas' || s.attributes.source === sourceFilter;
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
      showToast('Estação excluída com sucesso.', 'success');
      setConfirmingDeleteStation(null);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Erro ao excluir estação.',
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
            <h1 className="text-2xl font-bold text-gray-900">Estações</h1>
            {!canManageStations ? <ReadOnlyBadge /> : null}
          </div>
          <p className="text-sm text-gray-500">
            {data?.meta.pagination.total ?? 0} estações cadastradas
          </p>
        </div>
        <ProtectedActionButton
          allowed={canManageStations}
          onClick={() => setModalOpen(true)}
          title="Criar nova estação virtual"
          deniedReason="Somente analistas podem criar estações virtuais."
          helperText="Somente analistas podem executar esta ação."
        >
            <Plus className="h-4 w-4" />
            Nova Estação Virtual
        </ProtectedActionButton>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou código"
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <select
          value={sourceFilter}
          onChange={(e) =>
            setSourceFilter(e.target.value as (typeof SOURCES)[number])
          }
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
        >
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s === 'Todas' ? 'Todas as fontes' : s}
            </option>
          ))}
        </select>
        <select
          value={basinFilter}
          onChange={(e) => setBasinFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
        >
          <option value="">Todas as bacias</option>
          {basins.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Código
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Nome
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Fonte
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Bacia
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Rio
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">
                  Lat / Lon
                </th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">
                  Status
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading &&
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(8)].map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 animate-pulse rounded bg-gray-100" />
                      </td>
                    ))}
                  </tr>
                ))}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    Nenhuma estação encontrada.
                  </td>
                </tr>
              )}
              {filtered.map((station: Station) => (
                <StationRow
                  key={station.id}
                  station={station}
                  canManageStations={canManageStations}
                  rowMutation={rowMutation}
                  onEdit={() => setEditingStation(station)}
                  onDelete={() => setConfirmingDeleteStation(station)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
          title="Confirmar exclusão"
          description="Esta ação remove a estação do cadastro atual do painel."
          confirmLabel={
            rowMutation?.action === 'delete' ? 'Excluindo…' : 'Excluir estação'
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
                Se a estação possuir integrações ou registros dependentes no
                Strapi, a exclusão poderá ser recusada pela API.
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
  onEdit,
  onDelete,
}: {
  station: Station;
  canManageStations: boolean;
  rowMutation: RowMutationState;
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
    <tr className="transition hover:bg-gray-50">
      <td className="px-4 py-3 font-mono text-xs text-gray-700">{a.code}</td>
      <td className="px-4 py-3 font-medium text-gray-900">{a.name}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            sourceColors[a.source ?? ''] ?? 'bg-gray-100 text-gray-600'
          }`}
        >
          {a.source}
        </span>
      </td>
      <td className="px-4 py-3 text-gray-600">{a.basin || '—'}</td>
      <td className="px-4 py-3 text-gray-600">{a.river || '—'}</td>
      <td className="px-4 py-3 text-right font-mono text-xs text-gray-500">
        {a.latitude.toFixed(4)}, {a.longitude.toFixed(4)}
      </td>
      <td className="px-4 py-3 text-center">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            a.active ? 'bg-green-500' : 'bg-gray-300'
          }`}
          title={a.active ? 'Ativa' : 'Inativa'}
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onEdit}
            disabled={!canManageStations || isBusy}
            title={
              canManageStations
                ? 'Editar estação'
                : 'Somente analistas podem editar estações.'
            }
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:border-gray-100 disabled:text-gray-300"
          >
            <Pencil className="h-3.5 w-3.5" />
            {isEditing ? 'Salvando…' : 'Editar'}
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={!canManageStations || isBusy}
            title={
              canManageStations
                ? 'Excluir estação'
                : 'Somente analistas podem excluir estações.'
            }
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition hover:border-red-200 hover:text-red-700 disabled:cursor-not-allowed disabled:border-gray-100 disabled:text-gray-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {isDeleting ? 'Excluindo…' : 'Excluir'}
          </button>
        </div>
      </td>
    </tr>
  );
}
