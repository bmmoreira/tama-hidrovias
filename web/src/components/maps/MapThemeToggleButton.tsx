'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

/**
 * Compact light/dark toggle for the public map, meant to sit beside the
 * "Hidrovias" (forecast drawer) button at the top of the map. Unlike the
 * dashboard's `ThemeToggle` (a light/dark/system dropdown), this is a
 * single icon button that just flips between light and dark -- the map's
 * floating buttons don't have room for a menu.
 */
export default function MapThemeToggleButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="pointer-events-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-white/95 text-sky-900 shadow-lg shadow-sky-950/10 backdrop-blur transition hover:border-sky-300 hover:bg-white dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100 dark:hover:border-slate-600"
      aria-label={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      title={isDark ? 'Tema claro' : 'Tema escuro'}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
