'use client';

import ThemeSettingsPanel from '@/components/ThemeSettingsPanel';
import { useTranslation } from '@/lib/use-app-translation';

/**
 * User appearance and theme settings route under
 * ``/dashboard/settings``.
 */
export default function DashboardSettingsPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
          {t('settings.title')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {t('settings.subtitle')}
        </p>
      </div>

      <ThemeSettingsPanel />
    </div>
  );
}