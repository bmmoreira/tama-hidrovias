'use client';

import React from 'react';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from '@/lib/use-app-translation';
import type { MapFeatureCollectionFeature } from '@/lib/strapi';
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

/** Props for the dashboard feature editor modal. */
export interface FeatureCollectionFormModalProps {
  isOpen: boolean;
  feature?: MapFeatureCollectionFeature | null;
  onClose: () => void;
  onSubmit: (feature: MapFeatureCollectionFeature) => Promise<void>;
}

interface FormState {
  longitude: string;
  latitude: string;
  properties: string;
}

const EMPTY_PROPERTIES = '{\n  "name": ""\n}';

const EMPTY_FORM: FormState = {
  longitude: '',
  latitude: '',
  properties: EMPTY_PROPERTIES,
};

function toFormState(feature?: MapFeatureCollectionFeature | null): FormState {
  if (!feature) {
    return EMPTY_FORM;
  }

  return {
    longitude: String(feature.geometry.coordinates[0] ?? ''),
    latitude: String(feature.geometry.coordinates[1] ?? ''),
    properties: JSON.stringify(feature.properties ?? {}, null, 2),
  };
}

/**
 * Modal used to edit a single GeoJSON Point feature before the page persists
 * the updated collection through the internal Next.js API route.
 */
export default function FeatureCollectionFormModal({
  isOpen,
  feature,
  onClose,
  onSubmit,
}: FeatureCollectionFormModalProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(feature);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setForm(toFormState(feature));
    setError(null);
  }, [feature, isOpen]);

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const longitude = Number(form.longitude);
    const latitude = Number(form.latitude);

    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      setError(t('featureModal.invalidLongitude'));
      return;
    }

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      setError(t('featureModal.invalidLatitude'));
      return;
    }

    let properties: Record<string, unknown>;

    try {
      const parsed = JSON.parse(form.properties);

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('invalid');
      }

      properties = parsed as Record<string, unknown>;
    } catch (parseError) {
      setError(t('featureModal.invalidProperties'));
      return;
    }

    setLoading(true);

    try {
      await onSubmit({
        type: 'Feature',
        properties,
        geometry: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
      });
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : t('mapFeatures.saveError'),
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
        className="max-w-2xl rounded-2xl border border-border bg-card p-0"
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
                {isEditing
                  ? t('featureModal.editTitle')
                  : t('featureModal.createTitle')}
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500 dark:text-slate-400">
                {t('featureModal.propertiesDescription')}
              </DialogDescription>
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
              label={t('featureModal.longitude')}
              name="longitude"
              value={form.longitude}
              onChange={handleChange}
              placeholder="-58.1000"
              type="number"
              step="any"
              required
            />
            <FormField
              label={t('featureModal.latitude')}
              name="latitude"
              value={form.latitude}
              onChange={handleChange}
              placeholder="-2.6500"
              type="number"
              step="any"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-slate-300">
              {t('featureModal.properties')}
            </label>
            <textarea
              name="properties"
              value={form.properties}
              onChange={handleChange}
              rows={14}
              spellCheck={false}
              className="min-h-60 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 font-mono text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-500 dark:focus:ring-sky-950"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              {t('featureModal.cancel')}
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading
                ? isEditing
                  ? t('featureModal.saveLoading')
                  : t('featureModal.createLoading')
                : isEditing
                  ? t('featureModal.saveChanges')
                  : t('featureModal.create')}
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
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  step?: string;
  required?: boolean;
}

function FormField({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = 'text',
  step,
  required,
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
        placeholder={placeholder}
        step={step}
        required={required}
      />
    </div>
  );
}