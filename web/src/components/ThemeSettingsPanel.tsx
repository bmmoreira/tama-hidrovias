'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Monitor, Moon, Search, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslation } from '@/lib/use-app-translation';
import useSWR from 'swr';
import { USER_PREFERENCES_UPDATED_EVENT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import {
  getStations,
  getUserPreferences,
  updateUserPreferences,
  type AlertSeverityPreference,
  type LanguagePreference,
  type MapStylePreference,
  type Station,
  type ThemePreference,
} from '@/lib/strapi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const OPTIONS = [
  { value: 'light', Icon: Sun },
  { value: 'dark', Icon: Moon },
  { value: 'system', Icon: Monitor },
] as const;

const MAP_STYLE_OPTIONS: Array<{ value: MapStylePreference }> = [
  { value: 'outdoors' },
  { value: 'streets' },
  { value: 'satellite' },
  { value: 'dark' },
];

const LANGUAGE_OPTIONS: LanguagePreference[] = ['pt-BR', 'en', 'es', 'fr'];

const TIME_ZONE_OPTIONS = [
  'America/Sao_Paulo',
  'UTC',
  'America/Manaus',
  'America/Cuiaba',
  'America/Lima',
];

const ALERT_SEVERITY_OPTIONS: Array<{
  value: AlertSeverityPreference;
  label: string;
}> = [
  { value: 'info', label: 'Informativo' },
  { value: 'warning', label: 'Aviso' },
  { value: 'critical', label: 'Critico' },
];

type FormState = {
  firstName: string;
  lastName: string;
  institution: string;
  profession: string;
  birthdate: string;
  theme: ThemePreference;
  language: LanguagePreference;
  timeZone: string;
  mapStyle: MapStylePreference;
  defaultZoom: string;
  centerLatitude: string;
  centerLongitude: string;
  favoriteStationIds: number[];
  alertsEnabled: boolean;
  favoritesOnly: boolean;
  emailNotifications: boolean;
  dashboardNotifications: boolean;
  minimumSeverity: AlertSeverityPreference;
  leadTimeMinutes: string;
  dailyDigest: boolean;
  stationOfflineAlerts: boolean;
  forecastThresholdAlerts: boolean;
};

const DEFAULT_FORM_STATE: FormState = {
  firstName: '',
  lastName: '',
  institution: '',
  profession: '',
  birthdate: '',
  theme: 'system',
  language: 'pt-BR',
  timeZone: 'America/Sao_Paulo',
  mapStyle: 'outdoors',
  defaultZoom: '4',
  centerLatitude: '-15',
  centerLongitude: '-52',
  favoriteStationIds: [],
  alertsEnabled: false,
  favoritesOnly: true,
  emailNotifications: false,
  dashboardNotifications: true,
  minimumSeverity: 'warning',
  leadTimeMinutes: '60',
  dailyDigest: false,
  stationOfflineAlerts: true,
  forecastThresholdAlerts: true,
};

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function buildAvatarUrl(path?: string | null): string | null {
  if (!path) {
    return null;
  }

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  // Prefer the dedicated assets host when using the gateway topology.
  if (typeof window !== 'undefined') {
    try {
      const current = new URL(window.location.origin);

      if (current.hostname === 'app.local') {
        current.hostname = 'assets.local';
        return `${current.origin}${path}`;
      }

      if (current.hostname.startsWith('app.')) {
        current.hostname = current.hostname.replace(/^app\./, 'assets.');
        return `${current.origin}${path}`;
      }
    } catch {
      // Ignore URL parsing errors and fall back to default asset host.
    }
  }

  // Sensible fallback for local development.
  return `http://assets.local${path}`;
}

export default function ThemeSettingsPanel() {
  const { t } = useTranslation();
  const { setTheme } = useTheme();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM_STATE);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [stationQuery, setStationQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const { data: preferencesData, isLoading, mutate } = useSWR(
    'user-preferences',
    () => getUserPreferences(),
  );
  const { data: stationsData, isLoading: isStationsLoading } = useSWR(
    'settings-stations',
    () => getStations(),
    {
      revalidateOnFocus: false,
    },
  );

  const preferences = preferencesData?.data;
  const stations = stationsData?.data ?? [];
  const localizedThemeOptions = OPTIONS.map(({ value, Icon }) => ({
    value,
    Icon,
    label:
      value === 'light'
        ? t('settings.light')
        : value === 'dark'
          ? t('settings.dark')
          : t('settings.system'),
    description:
      value === 'light'
        ? t('settings.lightDescription')
        : value === 'dark'
          ? t('settings.darkDescription')
          : t('settings.systemDescription'),
  }));
  const localizedMapStyleOptions = MAP_STYLE_OPTIONS.map(({ value }) => ({
    value,
    label:
      value === 'outdoors'
        ? t('settings.outdoors')
        : value === 'streets'
          ? t('settings.streets')
          : value === 'satellite'
            ? t('settings.satellite')
            : t('settings.darkMap'),
    description:
      value === 'outdoors'
        ? t('settings.outdoorsDescription')
        : value === 'streets'
          ? t('settings.streetsDescription')
          : value === 'satellite'
            ? t('settings.satelliteDescription')
            : t('settings.darkMapDescription'),
  }));

  useEffect(() => {
    if (!preferences || hasInitialized) {
      return;
    }

    setForm({
      firstName: preferences.profile.firstName ?? '',
      lastName: preferences.profile.lastName ?? '',
      institution: preferences.profile.institution ?? '',
      profession: preferences.profile.profession ?? '',
      birthdate: preferences.profile.birthdate ?? '',
      theme: preferences.appearance.theme,
      language: preferences.appearance.language,
      timeZone: preferences.appearance.timeZone,
      mapStyle: preferences.map.mapStyle,
      defaultZoom: String(preferences.map.defaultZoom),
      centerLatitude: String(preferences.map.centerLatitude),
      centerLongitude: String(preferences.map.centerLongitude),
      favoriteStationIds: preferences.favoriteStations.map((station) => station.id),
      alertsEnabled: preferences.alerts.enabled,
      favoritesOnly: preferences.alerts.favoritesOnly,
      emailNotifications: preferences.alerts.emailNotifications,
      dashboardNotifications: preferences.alerts.dashboardNotifications,
      minimumSeverity: preferences.alerts.minimumSeverity,
      leadTimeMinutes: String(preferences.alerts.leadTimeMinutes),
      dailyDigest: preferences.alerts.dailyDigest,
      stationOfflineAlerts: preferences.alerts.stationOfflineAlerts,
      forecastThresholdAlerts: preferences.alerts.forecastThresholdAlerts,
    });
    setAvatarPreviewUrl(buildAvatarUrl(preferences.profile.avatar?.url ?? null));
    setHasInitialized(true);
    setTheme(preferences.appearance.theme);
  }, [hasInitialized, preferences, setTheme]);

  const filteredStations = useMemo(() => {
    const query = stationQuery.trim().toLowerCase();

    return stations
      .filter((station: Station) => {
        if (!query) {
          return true;
        }

        return (
          station.attributes.name.toLowerCase().includes(query) ||
          station.attributes.code.toLowerCase().includes(query)
        );
      })
      .slice(0, 24);
  }, [stationQuery, stations]);

  function toggleFavoriteStation(stationId: number) {
    setForm((current) => {
      const exists = current.favoriteStationIds.includes(stationId);

      return {
        ...current,
        favoriteStationIds: exists
          ? current.favoriteStationIds.filter((id) => id !== stationId)
          : [...current.favoriteStationIds, stationId],
      };
    });
  }

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    setAvatarError(null);

    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!ALLOWED_AVATAR_MIME_TYPES.includes(file.type)) {
      setAvatarError(t('settings.avatarUnsupportedType'));
      event.target.value = '';
      return;
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      setAvatarError(t('settings.avatarTooLarge'));
      event.target.value = '';
      return;
    }

    setIsUploadingAvatar(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/users/me/avatar', {
        method: 'POST',
        body: formData,
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setAvatarError(
          payload?.error ?? payload?.message ?? t('settings.avatarUploadError'),
        );
        return;
      }

      // Update the local preferences cache and preview from the server response.
      await mutate(payload, false);

      if (payload?.data?.profile?.avatar?.url) {
        setAvatarPreviewUrl(buildAvatarUrl(payload.data.profile.avatar.url));
      }

      setFeedback({
        type: 'success',
        message: t('settings.avatarUpdated'),
      });
    } catch (error) {
      setAvatarError(
        error instanceof Error ? error.message : t('settings.avatarUploadError'),
      );
    } finally {
      setIsUploadingAvatar(false);
      event.target.value = '';
    }
  }

  async function handleSave() {
    setIsSaving(true);
    setFeedback(null);

    try {
      const updatedPreferences = await updateUserPreferences({
        profile: {
          firstName: form.firstName || null,
          lastName: form.lastName || null,
          institution: form.institution || null,
          profession: form.profession || null,
          birthdate: form.birthdate || null,
          // Preserve avatar when updating profile fields – some API typings
          // require the avatar property to be present.
          avatar: preferences?.profile?.avatar ?? null,
        },
        appearance: {
          theme: form.theme,
          language: form.language,
          timeZone: form.timeZone,
        },
        map: {
          mapStyle: form.mapStyle,
          defaultZoom: Number(form.defaultZoom),
          centerLatitude: Number(form.centerLatitude),
          centerLongitude: Number(form.centerLongitude),
        },
        favoriteStationIds: form.favoriteStationIds,
        alerts: {
          enabled: form.alertsEnabled,
          favoritesOnly: form.favoritesOnly,
          emailNotifications: form.emailNotifications,
          dashboardNotifications: form.dashboardNotifications,
          minimumSeverity: form.minimumSeverity,
          leadTimeMinutes: Number(form.leadTimeMinutes),
          dailyDigest: form.dailyDigest,
          stationOfflineAlerts: form.stationOfflineAlerts,
          forecastThresholdAlerts: form.forecastThresholdAlerts,
        },
      });
      await mutate(updatedPreferences, false);
      setForm({
        firstName: updatedPreferences.data.profile.firstName ?? '',
        lastName: updatedPreferences.data.profile.lastName ?? '',
        institution: updatedPreferences.data.profile.institution ?? '',
        profession: updatedPreferences.data.profile.profession ?? '',
        birthdate: updatedPreferences.data.profile.birthdate ?? '',
        theme: updatedPreferences.data.appearance.theme,
        language: updatedPreferences.data.appearance.language,
        timeZone: updatedPreferences.data.appearance.timeZone,
        mapStyle: updatedPreferences.data.map.mapStyle,
        defaultZoom: String(updatedPreferences.data.map.defaultZoom),
        centerLatitude: String(updatedPreferences.data.map.centerLatitude),
        centerLongitude: String(updatedPreferences.data.map.centerLongitude),
        favoriteStationIds: updatedPreferences.data.favoriteStations.map(
          (station: Station) => station.id,
        ),
        alertsEnabled: updatedPreferences.data.alerts.enabled,
        favoritesOnly: updatedPreferences.data.alerts.favoritesOnly,
        emailNotifications: updatedPreferences.data.alerts.emailNotifications,
        dashboardNotifications:
          updatedPreferences.data.alerts.dashboardNotifications,
        minimumSeverity: updatedPreferences.data.alerts.minimumSeverity,
        leadTimeMinutes: String(updatedPreferences.data.alerts.leadTimeMinutes),
        dailyDigest: updatedPreferences.data.alerts.dailyDigest,
        stationOfflineAlerts:
          updatedPreferences.data.alerts.stationOfflineAlerts,
        forecastThresholdAlerts:
          updatedPreferences.data.alerts.forecastThresholdAlerts,
      });
      setTheme(updatedPreferences.data.appearance.theme);
      window.dispatchEvent(
        new CustomEvent('user-preferences-updated', {
          detail: {
            theme: updatedPreferences.data.appearance.theme,
          },
        }),
      );
      setFeedback({
        type: 'success',
        message: t('settings.saved'),
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : t('settings.saveError'),
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.profile')}</CardTitle>
          <CardDescription>
            {t('settings.profileDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2 flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-100 text-lg font-semibold text-gray-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              {avatarPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarPreviewUrl}
                  alt={t('settings.avatarAlt')}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>
                  {(form.firstName?.[0] ?? '').toUpperCase() ||
                    (form.lastName?.[0] ?? '').toUpperCase() ||
                    '·'}
                </span>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                {t('settings.avatarTitle')}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {t('settings.avatarDescription')}
              </p>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleAvatarChange}
                    disabled={isUploadingAvatar || isLoading || !hasInitialized}
                  />
                  {isUploadingAvatar ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      {t('settings.avatarUploading')}
                    </>
                  ) : (
                    t('settings.changeAvatar')
                  )}
                </label>
                {avatarError ? (
                  <p className="text-xs text-red-500 dark:text-red-400">
                    {avatarError}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700 dark:text-slate-300">
              {t('settings.firstName')}
            </label>
            <Input
              type="text"
              value={form.firstName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  firstName: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700 dark:text-slate-300">
              {t('settings.lastName')}
            </label>
            <Input
              type="text"
              value={form.lastName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  lastName: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700 dark:text-slate-300">
              {t('settings.institution')}
            </label>
            <Input
              type="text"
              value={form.institution}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  institution: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700 dark:text-slate-300">
              {t('settings.profession')}
            </label>
            <Input
              type="text"
              value={form.profession}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  profession: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-medium text-gray-700 dark:text-slate-300">
              {t('settings.birthdate')}
            </label>
            <Input
              type="date"
              value={form.birthdate}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  birthdate: event.target.value,
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.appearance')}</CardTitle>
          <CardDescription>
            {t('settings.appearanceDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            {localizedThemeOptions.map(({ value, label, description, Icon }) => {
              const active = form.theme === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setForm((current) => ({ ...current, theme: value }));
                    setTheme(value);
                  }}
                  className={cn(
                    'rounded-2xl border p-4 text-left transition',
                    active
                      ? 'border-blue-300 bg-blue-50 text-blue-900 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-100'
                      : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-blue-200 hover:bg-white dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-700',
                  )}
                >
                  <div className="mb-3 inline-flex rounded-xl bg-white/80 p-2 shadow-sm dark:bg-slate-900">
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="font-medium">{label}</p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                    {description}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-700 dark:text-slate-300">
                {t('settings.preferredLanguage')}
              </label>
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
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-700 dark:text-slate-300">
                {t('settings.timeZone')}
              </label>
              <Select
                value={form.timeZone}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    timeZone: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_ZONE_OPTIONS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.map')}</CardTitle>
          <CardDescription>
            {t('settings.mapDescription')}
          </CardDescription>
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
                {localizedMapStyleOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {
                localizedMapStyleOptions.find((option) => option.value === form.mapStyle)
                  ?.description
              }
            </p>
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
          <CardTitle>{t('settings.favoriteStations')}</CardTitle>
          <CardDescription>
            {t('settings.favoriteStationsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
            <Input
              type="text"
              value={stationQuery}
              onChange={(event) => setStationQuery(event.target.value)}
              placeholder={t('settings.stationSearchPlaceholder')}
              className="pl-9"
            />
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-slate-800">
            <div className="max-h-72 overflow-y-auto p-2">
              {isStationsLoading ? (
                <div className="flex items-center justify-center py-8 text-sm text-gray-500 dark:text-slate-400">
                  {t('settings.loadingStations')}
                </div>
              ) : filteredStations.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-sm text-gray-500 dark:text-slate-400">
                  {t('settings.noStations')}
                </div>
              ) : (
                filteredStations.map((station: Station) => {
                  const active = form.favoriteStationIds.includes(station.id);

                  return (
                    <button
                      key={station.id}
                      type="button"
                      onClick={() => toggleFavoriteStation(station.id)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition',
                        active
                          ? 'bg-blue-50 text-blue-900 dark:bg-sky-950/40 dark:text-sky-100'
                          : 'hover:bg-gray-50 dark:hover:bg-slate-900',
                      )}
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                          {station.attributes.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          {station.attributes.code}
                          {station.attributes.basin
                            ? ` · ${station.attributes.basin}`
                            : ''}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'inline-flex h-5 w-5 items-center justify-center rounded-full border',
                          active
                            ? 'border-blue-500 bg-blue-600 text-white dark:border-sky-400 dark:bg-sky-400 dark:text-slate-950'
                            : 'border-gray-300 text-transparent dark:border-slate-700',
                        )}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-slate-400">
            {t('settings.favoriteCount', { count: form.favoriteStationIds.length })}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.alerts')}</CardTitle>
          <CardDescription>
            {t('settings.alertsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            {[
              {
                key: 'alertsEnabled',
                label: t('settings.alertsEnabled'),
                description: t('settings.alertsEnabledDescription'),
              },
              {
                key: 'favoritesOnly',
                label: t('settings.favoritesOnly'),
                description: t('settings.favoritesOnlyDescription'),
              },
              {
                key: 'emailNotifications',
                label: t('settings.emailNotifications'),
                description: t('settings.emailNotificationsDescription'),
              },
              {
                key: 'dashboardNotifications',
                label: t('settings.dashboardNotifications'),
                description: t('settings.dashboardNotificationsDescription'),
              },
              {
                key: 'dailyDigest',
                label: t('settings.dailyDigest'),
                description: t('settings.dailyDigestDescription'),
              },
              {
                key: 'stationOfflineAlerts',
                label: t('settings.stationOfflineAlerts'),
                description: t('settings.stationOfflineAlertsDescription'),
              },
              {
                key: 'forecastThresholdAlerts',
                label: t('settings.forecastThresholdAlerts'),
                description: t('settings.forecastThresholdAlertsDescription'),
              },
            ].map(({ key, label, description }) => (
              <label
                key={key}
                className="flex items-start gap-3 rounded-2xl border border-gray-200 px-4 py-3 text-sm dark:border-slate-800"
              >
                <input
                  type="checkbox"
                  checked={Boolean(form[key as keyof FormState])}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      [key]: event.target.checked,
                    }))
                  }
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900"
                />
                <span>
                  <span className="block font-medium text-gray-900 dark:text-slate-100">
                    {label}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500 dark:text-slate-400">
                    {description}
                  </span>
                </span>
              </label>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-700 dark:text-slate-300">
                {t('settings.minimumSeverity')}
              </label>
              <Select
                value={form.minimumSeverity}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    minimumSeverity: value as AlertSeverityPreference,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALERT_SEVERITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.value === 'info'
                        ? t('settings.info')
                        : option.value === 'warning'
                          ? t('settings.warning')
                          : t('settings.critical')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-700 dark:text-slate-300">
                {t('settings.alertLeadTime')}
              </label>
              <Input
                type="number"
                min="0"
                step="5"
                value={form.leadTimeMinutes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    leadTimeMinutes: event.target.value,
                  }))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
              {t('settings.persistenceTitle')}
            </p>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              {t('settings.persistenceDescription')}
            </p>
          </div>
          <Button onClick={handleSave} disabled={isSaving || isLoading || !hasInitialized}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isSaving ? t('settings.saving') : t('settings.save')}
          </Button>
        </CardContent>
      </Card>

      {feedback ? (
        <div
          className={cn(
            'rounded-2xl border px-4 py-3 text-sm',
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200',
          )}
        >
          {feedback.message}
        </div>
      ) : null}

      {!hasInitialized && isLoading ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          {t('settings.loadingPreferences')}
        </div>
      ) : null}
    </div>
  );
}