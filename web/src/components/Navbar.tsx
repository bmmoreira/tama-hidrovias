'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, Droplets, LogOut, Menu, Settings, User, X } from 'lucide-react';
import { useTranslation } from '@/lib/use-app-translation';
import ReadOnlyBadge from '@/components/ReadOnlyBadge';
import ThemeToggle from '@/components/ThemeToggle';
import { getRoleLabel, isViewerRole } from '@/lib/roles';

export default function Navbar() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const roleLabel = getRoleLabel(session?.user?.role);
  const isViewer = isViewerRole(session?.user?.role);

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold text-blue-700 dark:text-sky-300"
        >
          <Droplets className="h-6 w-6" />
          <span>Tama Hidrovias</span>
        </Link>

        {/* Desktop right side */}
        <div className="hidden items-center gap-4 sm:flex">
          <ThemeToggle />
          <Link
            href="/map"
            className="text-sm text-gray-600 transition hover:text-blue-700 dark:text-slate-300 dark:hover:text-sky-300"
          >
            {t('nav.map')}
          </Link>
          {session ? (
            <>
              <Link
                href="/dashboard"
                className="text-sm text-gray-600 transition hover:text-blue-700 dark:text-slate-300 dark:hover:text-sky-300"
              >
                {t('nav.dashboard')}
              </Link>
              {isViewer ? <ReadOnlyBadge /> : null}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white/80 px-3 py-2 text-sm text-gray-700 transition hover:border-blue-200 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:border-sky-700 dark:hover:text-sky-300">
                    <User className="h-4 w-4 text-gray-400 dark:text-slate-400" />
                    <span>
                      {session.user?.name} ({roleLabel})
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={8}
                    className="z-50 min-w-56 rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl outline-none dark:border-slate-700 dark:bg-slate-950"
                  >
                    <div className="px-3 py-2 text-xs uppercase tracking-[0.18em] text-gray-400 dark:text-slate-500">
                      {t('nav.account')}
                    </div>
                    <DropdownMenu.Item asChild>
                      <Link
                        href="/dashboard/settings"
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none transition hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <Settings className="h-4 w-4" />
                        {t('nav.settings')}
                      </Link>
                    </DropdownMenu.Item>
                    <DropdownMenu.Separator className="my-1 h-px bg-gray-100 dark:bg-slate-800" />
                    <DropdownMenu.Item
                      onSelect={() => signOut({ callbackUrl: '/' })}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 outline-none transition hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      <LogOut className="h-4 w-4" />
                      {t('nav.logout')}
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              {t('nav.login')}
            </Link>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 sm:hidden dark:text-slate-300 dark:hover:bg-slate-800"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={t('nav.menu')}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-gray-100 bg-white px-4 pb-4 pt-2 sm:hidden dark:border-slate-800 dark:bg-slate-950">
          <nav className="flex flex-col gap-1">
            <div className="px-3 py-2">
              <ThemeToggle />
            </div>
            <Link
              href="/map"
              className="rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={() => setMenuOpen(false)}
            >
              {t('nav.map')}
            </Link>
            {session ? (
              <>
                <Link
                  href="/dashboard"
                  className="rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  onClick={() => setMenuOpen(false)}
                >
                  {t('nav.dashboard')}
                </Link>
                <Link
                  href="/dashboard/settings"
                  className="rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  onClick={() => setMenuOpen(false)}
                >
                  {t('nav.settings')}
                </Link>
                <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 dark:text-slate-400">
                  <User className="h-4 w-4" />
                  {session.user?.name} ({roleLabel})
                </div>
                {isViewer ? (
                  <div className="px-3 py-1">
                    <ReadOnlyBadge />
                  </div>
                ) : null}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    signOut({ callbackUrl: '/' });
                  }}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                >
                  <LogOut className="h-4 w-4" />
                  {t('nav.logout')}
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 dark:text-sky-300 dark:hover:bg-slate-800"
                onClick={() => setMenuOpen(false)}
              >
                {t('nav.login')}
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
