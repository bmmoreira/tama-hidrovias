'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Loader2 } from 'lucide-react';
import { getAppSettings, updateAppSettings, type LanguagePreference, type MapStylePreference } from '@/lib/strapi';
import { APP_SETTINGS_UPDATED_EVENT } from '@/lib/i18n';
import { useTranslation } from '@/lib/use-app-translation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const LANGUAGE_OPTIONS: LanguagePreference[] = ['pt-BR', 'en', 'es', 'fr'];
const MAP_STYLE_OPTIONS: MapStylePreference[] = ['outdoors', 'streets', 'satellite', 'dark'];

type FormState = {
  language: LanguagePreference;
  mapStyle: MapStylePreference;
  defaultZoom: string;
  centerLatitude: string;
  centerLongitude: string;
  featureCircleRadius: string;
  featurePositiveColor: string;
  featureNegativeColor: string;
  featureStrokeWidth: string;
  featureStrokeColor: string;
  featureCircleOpacity: string;
};

const DEFAULT_FORM: FormState = {
  language: 'pt-BR',
  mapStyle: 'outdoors',
  defaultZoom: '4',
  centerLatitude: '-15',
  centerLongitude: '-52',
  featureCircleRadius: '6',
  featurePositiveColor: '#0284c7',
  featureNegativeColor: '#ea580c',
  featureStrokeWidth: '1.5',
  featureStrokeColor: '#ffffff',
  featureCircleOpacity: '0.9',
};

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function AppSettingsPanel() {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { data, isLoading, mutate } = useSWR('app-settings', () => getAppSettings());

  const previewCircleRadius = clampNumber(
    Number(form.featureCircleRadius) || 0,
    1,
    24,
  );
  const previewStrokeWidth = clampNumber(
    Number(form.featureStrokeWidth) || 0,
    0,
    8,
  );
  const previewCircleOpacity = clampNumber(
    Number(form.featureCircleOpacity) || 0,
    0,
    1,
  );
  const previewCircleSize = previewCircleRadius * 2 + previewStrokeWidth * 2;

  useEffect(() => {
    if (!data?.data || hasInitialized) {
      return;
    }

    setForm({
      language: data.data.appearance.language,
      mapStyle: data.data.map.mapStyle,
      defaultZoom: String(data.data.map.defaultZoom),
      centerLatitude: String(data.data.map.centerLatitude),
      centerLongitude: String(data.data.map.centerLongitude),
      featureCircleRadius: String(data.data.featureCollectionLayer.circleRadius),
      featurePositiveColor: data.data.featureCollectionLayer.positiveColor,
      featureNegativeColor: data.data.featureCollectionLayer.negativeColor,
      featureStrokeWidth: String(data.data.featureCollectionLayer.strokeWidth),
      featureStrokeColor: data.data.featureCollectionLayer.strokeColor,
      featureCircleOpacity: String(data.data.featureCollectionLayer.circleOpacity),
    });
    setHasInitialized(true);
  }, [data, hasInitialized]);

  async function handleSave() {
    setIsSaving(true);
    setFeedback(null);

    try {
      const updated = await updateAppSettings({
        appearance: {
          language: form.language,
        },
        map: {
          mapStyle: form.mapStyle,
          defaultZoom: Number(form.defaultZoom),
          centerLatitude: Number(form.centerLatitude),
          centerLongitude: Number(form.centerLongitude),
        },
        featureCollectionLayer: {
          circleRadius: Number(form.featureCircleRadius),
          positiveColor: form.featurePositiveColor,
          negativeColor: form.featureNegativeColor,
          strokeWidth: Number(form.featureStrokeWidth),
          strokeColor: form.featureStrokeColor,
          circleOpacity: Number(form.featureCircleOpacity),
        },
      });

      await mutate(updated, false);
      window.dispatchEvent(
        new CustomEvent(APP_SETTINGS_UPDATED_EVENT, {
          detail: {
            language: updated.data.appearance.language,
          },
        }),
      );
      setFeedback({ type: 'success', message: t('admin.saved') });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : t('admin.saveError'),
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
          {t('admin.title')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {t('admin.subtitle')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.defaultLanguage')}</CardTitle>
          <CardDescription>{t('admin.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={form.language}
            onValueChange={(value) =>
              setForm((current) => ({
                ...current,
                language: value as LanguagePreference,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGE_OPTIONS.map((value) => (
                <SelectItem key={value} value={value}>
                  {value === 'pt-BR'
                    ? t('settings.portugueseBrazil')
                    : value === 'en'
                      ? t('settings.english')
                      : value === 'es'
                        ? t('settings.spanish')
                        : t('settings.french')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.guestMapDefaults')}</CardTitle>
          <CardDescription>{t('admin.guestMapDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-medium text-gray-700 dark:text-slate-300">
              {t('settings.mapStyle')}
            </label>
            <Select
              value={form.mapStyle}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  mapStyle: value as MapStylePreference,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MAP_STYLE_OPTIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value === 'outdoors'
                      ? t('settings.outdoors')
                      : value === 'streets'
                        ? t('settings.streets')
                        : value === 'satellite'
                          ? t('settings.satellite')
                          : t('settings.darkMap')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700 dark:text-slate-300">
              {t('settings.defaultZoom')}
            </label>
            <Input
              type="number"
              step="0.1"
              value={form.defaultZoom}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  defaultZoom: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700 dark:text-slate-300">
              {t('settings.centerLatitude')}
            </label>
            <Input
              type="number"
              step="0.0001"
              value={form.centerLatitude}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  centerLatitude: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-medium text-gray-700 dark:text-slate-300">
              {t('settings.centerLongitude')}
            </label>
            <Input
              type="number"
              step="0.0001"
              value={form.centerLongitude}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  centerLongitude: event.target.value,
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.featureCollectionLayer')}</CardTitle>
          <CardDescription>{t('admin.featureCollectionLayerDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 md:col-span-2">
            <div className="text-xs font-medium text-gray-700 dark:text-slate-300">
              {t('admin.livePreview')}
            </div>
            <div className="rounded-2xl border border-gray-200 bg-[radial-gradient(circle_at_top,#f8fafc,#e2e8f0)] p-4 dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top,#1e293b,#0f172a)]">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block rounded-full"
                      style={{
                        width: `${previewCircleSize}px`,
                        height: `${previewCircleSize}px`,
                        backgroundColor: form.featurePositiveColor,
                        borderColor: form.featureStrokeColor,
                        borderStyle: 'solid',
                        borderWidth: `${previewStrokeWidth}px`,
                        opacity: previewCircleOpacity,
                      }}
                    />
                    <span className="text-xs text-gray-600 dark:text-slate-300">
                      {t('admin.positiveColor')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block rounded-full"
                      style={{
                        width: `${previewCircleSize}px`,
                        height: `${previewCircleSize}px`,
                        backgroundColor: form.featureNegativeColor,
                        borderColor: form.featureStrokeColor,
                        borderStyle: 'solid',
                        borderWidth: `${previewStrokeWidth}px`,
                        opacity: previewCircleOpacity,
                      }}
                    />
                    <span className="text-xs text-gray-600 dark:text-slate-300">
                      {t('admin.negativeColor')}
                    </span>
                  </div>
                </div>
                <div className="text-right text-xs text-gray-500 dark:text-slate-400">
                  <div>{t('admin.circleRadius')}: {previewCircleRadius}</div>
                  <div>{t('admin.strokeWidth')}: {previewStrokeWidth}</div>
                  <div>{t('admin.circleOpacity')}: {previewCircleOpacity.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700 dark:text-slate-300">
              {t('admin.circleRadius')}
            </label>
            <Input
              type="number"
              step="0.1"
              min="1"
              max="24"
              value={form.featureCircleRadius}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  featureCircleRadius: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700 dark:text-slate-300">
              {t('admin.circleOpacity')}
            </label>
            <Input
              type="number"
              step="0.05"
              min="0"
              max="1"
              value={form.featureCircleOpacity}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  featureCircleOpacity: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700 dark:text-slate-300">
              {t('admin.positiveColor')}
            </label>
            <Input
              type="color"
              value={form.featurePositiveColor}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  featurePositiveColor: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700 dark:text-slate-300">
              {t('admin.negativeColor')}
            </label>
            <Input
              type="color"
              value={form.featureNegativeColor}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  featureNegativeColor: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700 dark:text-slate-300">
              {t('admin.strokeWidth')}
            </label>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="8"
              value={form.featureStrokeWidth}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  featureStrokeWidth: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700 dark:text-slate-300">
              {t('admin.strokeColor')}
            </label>
            <Input
              type="color"
              value={form.featureStrokeColor}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  featureStrokeColor: event.target.value,
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
              {t('admin.title')}
            </p>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              {t('admin.guestMapDescription')}
            </p>
          </div>
          <Button onClick={handleSave} disabled={isSaving || isLoading || !hasInitialized}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isSaving ? t('admin.saving') : t('admin.save')}
          </Button>
        </CardContent>
      </Card>

      {feedback ? (
        <div
          className={
            feedback.type === 'success'
              ? 'rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
              : 'rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200'
          }
        >
          {feedback.message}
        </div>
      ) : null}
    </div>
  );
}