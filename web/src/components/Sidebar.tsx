'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  LayoutDashboard,
  Radio,
  BarChart2,
  Layers,
  SlidersHorizontal,
  Settings,
  Map,
} from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from '@/lib/use-app-translation';
import ReadOnlyBadge from '@/components/ReadOnlyBadge';
import { canAccessAdmin, isViewerRole } from '@/lib/roles';

export default function Sidebar() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = canAccessAdmin(session?.user?.role);
  const isViewer = isViewerRole(session?.user?.role);

  const links = [
    { href: '/dashboard', label: t('sidebar.overview'), Icon: LayoutDashboard },
    { href: '/dashboard/stations', label: t('sidebar.stations'), Icon: Radio },
    { href: '/dashboard/forecasts', label: t('sidebar.forecasts'), Icon: BarChart2 },
    {
      href: '/dashboard/climate-layers',
      label: t('sidebar.climateLayers'),
      Icon: Layers,
    },
    {
      href: '/dashboard/mapview',
      label: t('sidebar.mapview'),
      Icon: Map,
    },
    {
      href: '/dashboard/settings',
      label: t('sidebar.preferences'),
      Icon: SlidersHorizontal,
    },
  ];
  const adminLink = {
    href: '/dashboard/admin',
    label: t('sidebar.admin'),
    Icon: Settings,
  };

  const allLinks = isAdmin ? [...links, adminLink] : links;

  return (
    <aside className="flex w-full flex-col border-r border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-950 md:w-56 md:min-h-full">
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {allLinks.map(({ href, label, Icon }) => {
          const active =
            href === '/dashboard'
              ? pathname === href
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                active
                  ? 'bg-blue-50 text-blue-700 dark:bg-sky-950/60 dark:text-sky-300'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-100',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
      {isViewer ? (
        <div className="border-t border-gray-100 p-3 dark:border-slate-800">
          <ReadOnlyBadge className="w-full justify-center" />
        </div>
      ) : null}
    </aside>
  );
}
