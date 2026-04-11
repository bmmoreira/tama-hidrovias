'use client';

import React from 'react';
import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import {
  createVirtualStation,
  type Station,
  updateStation,
} from '@/lib/strapi';

interface StationFormModalProps {
  isOpen: boolean;
  station?: Station | null;
  onClose: () => void;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
  onSubmittingChange?: (isSubmitting: boolean) => void;
}

interface FormState {
  name: string;
  code: string;
  latitude: string;
  longitude: string;
  basin: string;
  river: string;
  active: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  code: '',
  latitude: '',
  longitude: '',
  basin: '',
  river: '',
  active: true,
};

function toFormState(station?: Station | null): FormState {
  if (!station) {
    return EMPTY_FORM;
  }

  return {
    name: station.attributes.name ?? '',
    code: station.attributes.code ?? '',
    latitude: String(station.attributes.latitude ?? ''),
    longitude: String(station.attributes.longitude ?? ''),
    basin: station.attributes.basin ?? '',
    river: station.attributes.river ?? '',
    active: station.attributes.active ?? true,
  };
}

export default function StationFormModal({
  isOpen,
  station,
  onClose,
  onSaved,
  onError,
  onSubmittingChange,
}: StationFormModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(station);
  const source = station?.attributes.source ?? 'Virtual';

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setForm(toFormState(station));
    setError(null);
  }, [isOpen, station]);

  useEffect(() => {
    onSubmittingChange?.(loading);
  }, [loading, onSubmittingChange]);

  if (!isOpen) {
    return null;
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const { name, value, type } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const lat = parseFloat(form.latitude);
    const lon = parseFloat(form.longitude);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      setError('Latitude inválida. Use um valor entre -90 e 90.');
      return;
    }

    if (isNaN(lon) || lon < -180 || lon > 180) {
      setError('Longitude inválida. Use um valor entre -180 e 180.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      source,
      latitude: lat,
      longitude: lon,
      basin: form.basin.trim(),
      river: form.river.trim(),
      active: form.active,
    } as const;

    setLoading(true);
    try {
      if (station) {
        await updateStation(station.id, payload);
      } else {
        await createVirtualStation(payload);
      }

      setForm(EMPTY_FORM);
      onSaved(
        station
          ? 'Estação atualizada com sucesso.'
          : 'Estação criada com sucesso.',
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : isEditing
            ? 'Erro ao atualizar estação.'
            : 'Erro ao criar estação virtual.';

      onError(message);
      setError(
        message,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={loading ? undefined : onClose}
      />

      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
        <div className="w-full max-w-lg rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {isEditing ? 'Editar Estação' : 'Nova Estação Virtual'}
              </h2>
              <p className="text-xs text-gray-500">Fonte: {source}</p>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
            {error ? (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                label="Nome da Estação *"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                placeholder="Ex.: Estação Virtual Rio Negro"
              />
              <FormField
                label="Código *"
                name="code"
                value={form.code}
                onChange={handleChange}
                required
                placeholder="Ex.: VIRT-001"
              />
              <FormField
                label="Latitude *"
                name="latitude"
                value={form.latitude}
                onChange={handleChange}
                required
                placeholder="-3.1234"
                type="number"
                step="any"
              />
              <FormField
                label="Longitude *"
                name="longitude"
                value={form.longitude}
                onChange={handleChange}
                required
                placeholder="-60.0234"
                type="number"
                step="any"
              />
              <FormField
                label="Bacia Hidrográfica"
                name="basin"
                value={form.basin}
                onChange={handleChange}
                placeholder="Ex.: Bacia Amazônica"
              />
              <FormField
                label="Rio"
                name="river"
                value={form.river}
                onChange={handleChange}
                placeholder="Ex.: Rio Negro"
              />
            </div>

            <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="active"
                checked={form.active}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Estação ativa
            </label>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !form.name || !form.code || !form.latitude || !form.longitude}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? (isEditing ? 'Salvando…' : 'Criando…') : isEditing ? 'Salvar Alterações' : 'Criar Estação'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

interface FormFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  placeholder?: string;
  type?: string;
  step?: string;
}

function FormField({
  label,
  name,
  value,
  onChange,
  required,
  placeholder,
  type = 'text',
  step,
}: FormFieldProps) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-gray-700">
        {label}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        step={step}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}