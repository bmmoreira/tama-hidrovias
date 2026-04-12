'use client';

import ReadOnlyBadge from '@/components/ReadOnlyBadge';
import { useTranslation } from '@/lib/use-app-translation';

export default function DashboardReadOnlyBanner() {
  const { t } = useTranslation();

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-amber-900 dark:from-amber-950 dark:to-slate-950">
      <div>
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
          {t('readOnly.bannerTitle')}
        </p>
        <p className="text-sm text-amber-700 dark:text-amber-300">
          {t('readOnly.bannerDescription')}
        </p>
      </div>
      <ReadOnlyBadge className="self-start sm:self-center" />
    </div>
  );
}