'use client';

import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/lib/use-app-translation';
import type { StationPopupData } from './StationPopup';

interface StationDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: StationPopupData | null;
}

type MeasurementPoint = {
  label: string;
  measured: number;
  anomalyBand: number;
};

type ForecastPoint = {
  label: string;
  baseline: number;
  optimistic: number;
  conservative: number;
};

function buildSeed(input: string) {
  return input.split('').reduce((total, character) => total + character.charCodeAt(0), 0);
}

function toFixedNumber(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function buildMeasurementSeries(data: StationPopupData) {
  const seed = buildSeed(`${data.name}${data.code ?? ''}`);
  const baseValue = data.value ?? 4 + (seed % 20) * 0.25;

  return Array.from({ length: 12 }, (_, index) => {
    const wave = Math.sin((seed + index * 11) / 9) * 0.45;
    const drift = (index - 6) * 0.03;
    const anomalyBand = (data.anomaly ?? 0.2) * 0.6;

    return {
      label: `D-${11 - index}`,
      measured: toFixedNumber(baseValue + wave + drift),
      anomalyBand: toFixedNumber(baseValue + anomalyBand),
    };
  });
}

function buildForecastSeries(data: StationPopupData) {
  const seed = buildSeed(`${data.name}${data.source ?? ''}`);
  const baseValue = data.value ?? 4 + (seed % 15) * 0.22;

  return Array.from({ length: 10 }, (_, index) => {
    const trend = index * 0.08;
    const amplitude = Math.cos((seed + index * 7) / 8) * 0.35;
    const baseline = toFixedNumber(baseValue + trend + amplitude);

    return {
      label: `+${index + 1}`,
      baseline,
      optimistic: toFixedNumber(baseline + 0.32),
      conservative: toFixedNumber(baseline - 0.28),
    };
  });
}

function formatCoordinate(value?: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${value.toFixed(4)}°`
    : '...';
}

function SummaryCard({ title, value, tone = 'default' }: { title: string; value: string; tone?: 'default' | 'positive' | 'negative'; }) {
  const toneClassName =
    tone === 'positive'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'negative'
        ? 'text-orange-600 dark:text-orange-400'
        : 'text-slate-900 dark:text-slate-100';

  return (
    <div className="rounded-2xl border border-gray-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500 dark:text-slate-400">
        {title}
      </div>
      <div className={`mt-2 text-2xl font-semibold ${toneClassName}`}>
        {value}
      </div>
    </div>
  );
}

export default function StationDetailsModal({
  open,
  onOpenChange,
  data,
}: StationDetailsModalProps) {
  const { t } = useTranslation();

  const measurementData = useMemo(
    () => (data ? buildMeasurementSeries(data) : []),
    [data],
  );
  const forecastData = useMemo(
    () => (data ? buildForecastSeries(data) : []),
    [data],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1rem)] max-w-6xl overflow-y-auto rounded-[1.75rem] border border-gray-200 bg-white p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-950 sm:w-[calc(100%-2rem)]">
        {data ? (
          <div className="flex flex-col">
            <DialogHeader className="border-b border-gray-200 bg-gradient-to-br from-sky-50 via-white to-cyan-50 px-4 py-5 dark:border-slate-800 dark:from-sky-950/40 dark:via-slate-950 dark:to-cyan-950/20 sm:px-6 sm:py-6">
              <DialogTitle className="pr-12 text-lg font-semibold text-slate-900 dark:text-slate-100 sm:text-2xl">
                {data.name}
              </DialogTitle>
              <DialogDescription className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
                {t('mapDetails.subtitle')}
              </DialogDescription>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                {data.code ? (
                  <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 dark:border-slate-700 dark:bg-slate-900/80">
                    {data.code}
                  </span>
                ) : null}
                {data.source ? (
                  <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 dark:border-slate-700 dark:bg-slate-900/80">
                    {data.source}
                  </span>
                ) : null}
                {data.satellite ? (
                  <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 dark:border-slate-700 dark:bg-slate-900/80">
                    {data.satellite}
                  </span>
                ) : null}
              </div>
            </DialogHeader>

            <div className="grid gap-4 px-4 py-4 sm:px-6 sm:py-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
              <div className="space-y-4">
                <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <SummaryCard
                    title={t('mapDetails.currentLevel')}
                    value={typeof data.value === 'number' ? `${data.value.toFixed(2)} m` : '...'}
                  />
                  <SummaryCard
                    title={t('mapDetails.currentChange')}
                    value={typeof data.change === 'number' ? `${data.change >= 0 ? '+' : ''}${data.change.toFixed(2)} m` : '...'}
                    tone={typeof data.change === 'number' ? (data.change >= 0 ? 'positive' : 'negative') : 'default'}
                  />
                  <SummaryCard
                    title={t('mapDetails.currentAnomaly')}
                    value={typeof data.anomaly === 'number' ? `${data.anomaly >= 0 ? '+' : ''}${data.anomaly.toFixed(1)}` : '...'}
                    tone={typeof data.anomaly === 'number' ? (data.anomaly >= 0 ? 'positive' : 'negative') : 'default'}
                  />
                  <SummaryCard
                    title={t('mapDetails.forecastWindow')}
                    value={t('mapDetails.forecastWindowValue')}
                  />
                </section>

                <Card className="overflow-hidden border-gray-200/80 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/90">
                  <CardHeader className="pb-2">
                    <CardTitle>{t('mapDetails.measurementsTitle')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 w-full sm:h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={measurementData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                          <Tooltip
                            contentStyle={{ borderRadius: 16, borderColor: '#cbd5e1' }}
                            formatter={(value: number, key: string) => [
                              `${value.toFixed(2)} m`,
                              key === 'measured' ? t('mapDetails.measuredSeries') : t('mapDetails.anomalyBand'),
                            ]}
                          />
                          <Line type="monotone" dataKey="measured" stroke="#0284c7" strokeWidth={3} dot={false} />
                          <Line type="monotone" dataKey="anomalyBand" stroke="#f97316" strokeWidth={2} dot={false} strokeDasharray="6 4" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden border-gray-200/80 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/90">
                  <CardHeader className="pb-2">
                    <CardTitle>{t('mapDetails.forecastTitle')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 w-full sm:h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={forecastData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.04} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                          <Tooltip
                            contentStyle={{ borderRadius: 16, borderColor: '#cbd5e1' }}
                            formatter={(value: number, key: string) => [
                              `${value.toFixed(2)} m`,
                              key === 'baseline'
                                ? t('mapDetails.forecastBaseline')
                                : key === 'optimistic'
                                  ? t('mapDetails.forecastOptimistic')
                                  : t('mapDetails.forecastConservative'),
                            ]}
                          />
                          <Area type="monotone" dataKey="baseline" stroke="#14b8a6" fill="url(#forecastFill)" strokeWidth={3} />
                          <Line type="monotone" dataKey="optimistic" stroke="#22c55e" strokeWidth={2} dot={false} strokeDasharray="4 4" />
                          <Line type="monotone" dataKey="conservative" stroke="#f97316" strokeWidth={2} dot={false} strokeDasharray="4 4" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <Card className="border-gray-200/80 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/90">
                  <CardHeader className="pb-2">
                    <CardTitle>{t('mapDetails.baseInfoTitle')}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500 dark:text-slate-400">{t('mapDetails.code')}</div>
                      <div className="mt-1 text-sm text-slate-900 dark:text-slate-100">{data.code ?? t('mapPopup.noCode')}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500 dark:text-slate-400">{t('mapDetails.source')}</div>
                      <div className="mt-1 text-sm text-slate-900 dark:text-slate-100">{data.source ?? '...'}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500 dark:text-slate-400">{t('mapDetails.river')}</div>
                      <div className="mt-1 text-sm text-slate-900 dark:text-slate-100">{data.river ?? t('mapPopup.unknownRiver')}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500 dark:text-slate-400">{t('mapDetails.basin')}</div>
                      <div className="mt-1 text-sm text-slate-900 dark:text-slate-100">{data.basin ?? '...'}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500 dark:text-slate-400">{t('mapPopup.latitude')}</div>
                      <div className="mt-1 text-sm text-slate-900 dark:text-slate-100">{formatCoordinate(data.latitude)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500 dark:text-slate-400">{t('mapPopup.longitude')}</div>
                      <div className="mt-1 text-sm text-slate-900 dark:text-slate-100">{formatCoordinate(data.longitude)}</div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-gray-200/80 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/90">
                  <CardHeader className="pb-2">
                    <CardTitle>{t('mapDetails.insightsTitle')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                    <div className="rounded-2xl bg-sky-50 p-3 dark:bg-sky-950/30">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{t('mapDetails.insightOneTitle')}</div>
                      <p className="mt-1">{t('mapDetails.insightOneDescription')}</p>
                    </div>
                    <div className="rounded-2xl bg-emerald-50 p-3 dark:bg-emerald-950/25">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{t('mapDetails.insightTwoTitle')}</div>
                      <p className="mt-1">{t('mapDetails.insightTwoDescription')}</p>
                    </div>
                    <div className="rounded-2xl bg-orange-50 p-3 dark:bg-orange-950/20">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{t('mapDetails.insightThreeTitle')}</div>
                      <p className="mt-1">{t('mapDetails.insightThreeDescription')}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}