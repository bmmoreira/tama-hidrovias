'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Plus, Search, Radio } from 'lucide-react';
import { getStations } from '@/lib/strapi';
import type { Station } from '@/lib/strapi';
import VirtualStationModal from './VirtualStationModal';

const SOURCES = ['Todas', 'ANA', 'HydroWeb', 'SNIRH', 'Virtual'] as const;

export default function StationsPage() {
  const [modalOpen, setModalOpen] = useState(false);
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
    new Set(stations.map((s) => s.attributes.basin).filter(Boolean)),
  ).sort();

  const filtered = stations.filter((s) => {
    const matchQuery =
      !query ||
      s.attributes.name.toLowerCase().includes(query.toLowerCase()) ||
      s.attributes.code.toLowerCase().includes(query.toLowerCase());
    const matchSource =
      sourceFilter === 'Todas' || s.attributes.source === sourceFilter;
    const matchBasin = !basinFilter || s.attributes.basin === basinFilter;
    return matchQuery && matchSource && matchBasin;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estações</h1>
          <p className="text-sm text-gray-500">
            {data?.meta.pagination.total ?? 0} estações cadastradas
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Nova Estação Virtual
        </button>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading &&
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(7)].map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 animate-pulse rounded bg-gray-100" />
                      </td>
                    ))}
                  </tr>
                ))}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    Nenhuma estação encontrada.
                  </td>
                </tr>
              )}
              {filtered.map((station) => (
                <StationRow key={station.id} station={station} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <VirtualStationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => {
          setModalOpen(false);
          mutate();
        }}
      />
    </div>
  );
}

function StationRow({ station }: { station: Station }) {
  const a = station.attributes;
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
            sourceColors[a.source] ?? 'bg-gray-100 text-gray-600'
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
    </tr>
  );
}
