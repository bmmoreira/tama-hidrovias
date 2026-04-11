'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Monitor, Moon, Search, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import useSWR from 'swr';
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
  {
    value: 'light',
    label: 'Claro',
    description: 'Interface com fundos claros e alto contraste para luz ambiente.',
    Icon: Sun,
  },
  {
    value: 'dark',
    label: 'Escuro',
    description: 'Interface com fundos escuros para reduzir brilho e fadiga visual.',
    Icon: Moon,
  },
  {
    value: 'system',
    label: 'Sistema',
    description: 'Segue automaticamente a preferencia do dispositivo.',
    Icon: Monitor,
  },
] as const;

const MAP_STYLE_OPTIONS: Array<{
  value: MapStylePreference;
  label: string;
  description: string;
}> = [
  {
    value: 'outdoors',
    label: 'Outdoors',
    description: 'Mapa topografico com relevo e contexto ambiental.',
  },
  {
    value: 'streets',
    label: 'Streets',
    description: 'Mapa urbano mais neutro para navegacao geral.',
  },
  {
    value: 'satellite',
    label: 'Satellite',
    description: 'Imagem de satelite com rotulos de referencia.',
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Base escura com contraste forte para ambientes de operacao.',
  },
];

const LANGUAGE_OPTIONS: Array<{
  value: LanguagePreference;
  label: string;
}> = [
  { value: 'pt-BR', label: 'Portugues (Brasil)' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Espanol' },
];

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

export default function ThemeSettingsPanel() {
  const { setTheme } = useTheme();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM_STATE);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [stationQuery, setStationQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
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

  useEffect(() => {
    if (!preferences || hasInitialized) {
      return;
    }

    setForm({
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

  async function handleSave() {
    setIsSaving(true);
    setFeedback(null);

    try {
      const updatedPreferences = await updateUserPreferences({
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
        theme: updatedPreferences.data.appearance.theme,
        language: updatedPreferences.data.appearance.language,
        timeZone: updatedPreferences.data.appearance.timeZone,
        mapStyle: updatedPreferences.data.map.mapStyle,
        defaultZoom: String(updatedPreferences.data.map.defaultZoom),
        centerLatitude: String(updatedPreferences.data.map.centerLatitude),
        centerLongitude: String(updatedPreferences.data.map.centerLongitude),
        favoriteStationIds: updatedPreferences.data.favoriteStations.map(
          (station) => station.id,
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
        message: 'Preferencias salvas com sucesso.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Nao foi possivel salvar as preferencias.',
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Aparencia</CardTitle>
          <CardDescription>
            Tema, idioma e fuso horario persistidos por usuario.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            {OPTIONS.map(({ value, label, description, Icon }) => {
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
                Idioma preferencial
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
                  {LANGUAGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-700 dark:text-slate-300">
                Fuso horario
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
          <CardTitle>Mapa</CardTitle>
          <CardDescription>
            Padrao usado na pagina de mapa para estilo, zoom e centro inicial.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-medium text-gray-700 dark:text-slate-300">
              Estilo do mapa
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
                {MAP_STYLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {
                MAP_STYLE_OPTIONS.find((option) => option.value === form.mapStyle)
                  ?.description
              }
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700 dark:text-slate-300">
              Zoom padrao
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
              Latitude central
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
              Longitude central
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
          <CardTitle>Estacoes Favoritas</CardTitle>
          <CardDescription>
            Selecione as estacoes que voce quer destacar e acompanhar primeiro.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
            <Input
              type="text"
              value={stationQuery}
              onChange={(event) => setStationQuery(event.target.value)}
              placeholder="Buscar estacao por nome ou codigo"
              className="pl-9"
            />
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-slate-800">
            <div className="max-h-72 overflow-y-auto p-2">
              {isStationsLoading ? (
                <div className="flex items-center justify-center py-8 text-sm text-gray-500 dark:text-slate-400">
                  Carregando estacoes...
                </div>
              ) : filteredStations.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-sm text-gray-500 dark:text-slate-400">
                  Nenhuma estacao encontrada.
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
            {form.favoriteStationIds.length} estacao(oes) favorita(s) selecionada(s).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alertas</CardTitle>
          <CardDescription>
            Preferencias operacionais para notificacoes de estacoes favoritas e eventos criticos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            {[
              {
                key: 'alertsEnabled',
                label: 'Alertas habilitados',
                description: 'Ativa a avaliacao das regras de alerta para o usuario.',
              },
              {
                key: 'favoritesOnly',
                label: 'Somente favoritas',
                description: 'Restringe alertas as estacoes marcadas como favoritas.',
              },
              {
                key: 'emailNotifications',
                label: 'Notificacoes por e-mail',
                description: 'Reserva de canal para a futura entrega por e-mail.',
              },
              {
                key: 'dashboardNotifications',
                label: 'Notificacoes no painel',
                description: 'Mostra alertas diretamente na interface autenticada.',
              },
              {
                key: 'dailyDigest',
                label: 'Resumo diario',
                description: 'Agrupa alertas nao urgentes em um resumo consolidado.',
              },
              {
                key: 'stationOfflineAlerts',
                label: 'Estacao sem atualizacao',
                description: 'Destaca ausencia de dados recentes nas estacoes monitoradas.',
              },
              {
                key: 'forecastThresholdAlerts',
                label: 'Alertas de previsao',
                description: 'Permite regras futuras baseadas em previsoes e limiares.',
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
                Severidade minima
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
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-700 dark:text-slate-300">
                Antecedencia do alerta (minutos)
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
              Persistencia por usuario
            </p>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              As preferencias ficam associadas ao usuario autenticado no Strapi.
            </p>
          </div>
          <Button onClick={handleSave} disabled={isSaving || isLoading || !hasInitialized}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isSaving ? 'Salvando...' : 'Salvar preferencias'}
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
          Carregando preferencias salvas...
        </div>
      ) : null}
    </div>
  );
}