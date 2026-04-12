'use client';

import React from 'react';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from '@/lib/use-app-translation';
import {
  createVirtualStation,
  type Station,
  type StationMutationInput,
  updateStation,
} from '@/lib/strapi';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(station);
  const source: StationMutationInput['source'] =
    station?.attributes.source === 'ANA' ||
    station?.attributes.source === 'HydroWeb' ||
    station?.attributes.source === 'SNIRH' ||
    station?.attributes.source === 'Virtual'
      ? station.attributes.source
      : 'Virtual';

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
      setError(t('stationModal.invalidLatitude'));
      return;
    }

    if (isNaN(lon) || lon < -180 || lon > 180) {
      setError(t('stationModal.invalidLongitude'));
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
          ? t('stationModal.updated')
          : t('stationModal.created'),
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : isEditing
            ? t('stationModal.updateError')
            : t('stationModal.createError');

      onError(message);
      setError(
        message,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !loading) {
          onClose();
        }
      }}
    >
      <DialogContent
        hideCloseButton={loading}
        className="max-w-lg rounded-2xl border border-border bg-card p-0"
        onPointerDownOutside={(event) => {
          if (loading) {
            event.preventDefault();
          }
        }}
      >
          <div className="border-b border-gray-100 px-6 py-4 dark:border-slate-800">
            <DialogHeader>
            <div>
              <DialogTitle className="text-base text-gray-900 dark:text-slate-100">
                {isEditing ? t('stationModal.editTitle') : t('stationModal.createTitle')}
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500 dark:text-slate-400">{t('stationModal.source')}: {source}</DialogDescription>
            </div>
            </DialogHeader>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
            {error ? (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200">
                {error}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                label={t('stationModal.stationName')}
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                placeholder="Ex.: Estação Virtual Rio Negro"
              />
              <FormField
                label={t('stationModal.code')}
                name="code"
                value={form.code}
                onChange={handleChange}
                required
                placeholder="Ex.: VIRT-001"
              />
              <FormField
                label={t('stationModal.latitude')}
                name="latitude"
                value={form.latitude}
                onChange={handleChange}
                required
                placeholder="-3.1234"
                type="number"
                step="any"
              />
              <FormField
                label={t('stationModal.longitude')}
                name="longitude"
                value={form.longitude}
                onChange={handleChange}
                required
                placeholder="-60.0234"
                type="number"
                step="any"
              />
              <FormField
                label={t('stationModal.basin')}
                name="basin"
                value={form.basin}
                onChange={handleChange}
                placeholder="Ex.: Bacia Amazônica"
              />
              <FormField
                label={t('stationModal.river')}
                name="river"
                value={form.river}
                onChange={handleChange}
                placeholder="Ex.: Rio Negro"
              />
            </div>

            <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 dark:border-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                name="active"
                checked={form.active}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900"
              />
              {t('stationModal.active')}
            </label>

            <DialogFooter className="pt-2">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={loading}
              >
                {t('stationModal.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={loading || !form.name || !form.code || !form.latitude || !form.longitude}
                className="flex-1"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading
                  ? isEditing
                    ? t('stationModal.saveLoading')
                    : t('stationModal.createLoading')
                  : isEditing
                    ? t('stationModal.saveChanges')
                    : t('stationModal.create')}
              </Button>
            </DialogFooter>
          </form>
      </DialogContent>
    </Dialog>
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
      <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-slate-300">
        {label}
      </label>
      <Input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        step={step}
      />
    </div>
  );
}