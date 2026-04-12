'use client';

import Link from 'next/link';
import { Activity, BarChart2, Layers, Radio } from 'lucide-react';
import { useTranslation } from '@/lib/use-app-translation';
import SummaryCard from '@/components/SummaryCard';
import DashboardCharts from './DashboardCharts';

export default function DashboardOverviewClient({
  totalStations,
}: {
  totalStations: number;
}) {
  const { t } = useTranslation();
  const quickLinks = [
    {
      href: '/dashboard/stations',
      label: t('dashboard.quickStations'),
      description: t('dashboard.quickStationsDescription'),
      Icon: Radio,
    },
    {
      href: '/dashboard/forecasts',
      label: t('dashboard.quickForecasts'),
      description: t('dashboard.quickForecastsDescription'),
      Icon: BarChart2,
    },
    {
      href: '/dashboard/climate-layers',
      label: t('dashboard.quickClimate'),
      description: t('dashboard.quickClimateDescription'),
      Icon: Layers,
    },
    {
      href: '/map',
      label: t('dashboard.quickMap'),
      description: t('dashboard.quickMapDescription'),
      Icon: Activity,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{t('dashboard.title')}</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">{t('dashboard.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard title={t('dashboard.totalStations')} value={totalStations} Icon={Radio} color="blue" description={t('dashboard.allSources')} />
        <SummaryCard title={t('dashboard.recentMeasurements')} value="—" Icon={Activity} color="green" description={t('dashboard.last24Hours')} />
        <SummaryCard title={t('dashboard.activeForecasts')} value="—" Icon={BarChart2} color="amber" description={t('dashboard.next15Days')} />
        <SummaryCard title={t('dashboard.climateLayers')} value="—" Icon={Layers} color="purple" description={t('dashboard.available')} />
      </div>

      <DashboardCharts />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quickLinks.map((ql) => (
          <Link
            key={ql.href}
            href={ql.href}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-950 dark:hover:border-sky-700"
          >
            <div className="mb-2 inline-flex rounded-lg bg-blue-50 p-2 text-blue-700 dark:bg-sky-950/60 dark:text-sky-300">
              <ql.Icon className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">{ql.label}</h3>
            <p className="mt-0.5 text-xs text-gray-400 dark:text-slate-500">{ql.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}