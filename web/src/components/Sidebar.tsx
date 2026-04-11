'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  LayoutDashboard,
  Radio,
  BarChart2,
  Layers,
  Settings,
} from 'lucide-react';
import clsx from 'clsx';
import ReadOnlyBadge from '@/components/ReadOnlyBadge';
import { canAccessAdmin, isViewerRole } from '@/lib/roles';

const links = [
  { href: '/dashboard', label: 'Visão Geral', Icon: LayoutDashboard },
  { href: '/dashboard/stations', label: 'Estações', Icon: Radio },
  { href: '/dashboard/forecasts', label: 'Previsões', Icon: BarChart2 },
  {
    href: '/dashboard/climate-layers',
    label: 'Camadas Climáticas',
    Icon: Layers,
  },
];

const adminLink = { href: '/dashboard/admin', label: 'Admin', Icon: Settings };

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = canAccessAdmin(session?.user?.role);
  const isViewer = isViewerRole(session?.user?.role);

  const allLinks = isAdmin ? [...links, adminLink] : links;

  return (
    <aside className="flex w-full flex-col border-r border-gray-200 bg-white md:w-56 md:min-h-full">
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
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
      {isViewer ? (
        <div className="border-t border-gray-100 p-3">
          <ReadOnlyBadge className="w-full justify-center" />
        </div>
      ) : null}
    </aside>
  );
}
