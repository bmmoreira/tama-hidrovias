'use client';

import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

const THEMES = [
  { value: 'light', label: 'Claro', Icon: Sun },
  { value: 'dark', label: 'Escuro', Icon: Moon },
  { value: 'system', label: 'Sistema', Icon: Monitor },
] as const;

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const activeTheme = theme ?? 'system';
  const ActiveIcon =
    activeTheme === 'dark' ? Moon : activeTheme === 'light' ? Sun : Monitor;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white/80 px-3 py-2 text-sm text-gray-600 transition hover:border-blue-200 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-sky-700 dark:hover:text-sky-300"
          aria-label="Alterar tema"
        >
          <ActiveIcon className="h-4 w-4" />
          <span className="hidden md:inline">
            {resolvedTheme === 'dark' ? 'Escuro' : 'Claro'}
          </span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-44 rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl outline-none dark:border-slate-700 dark:bg-slate-950"
        >
          {THEMES.map(({ value, label, Icon }) => (
            <DropdownMenu.Item
              key={value}
              onSelect={() => setTheme(value)}
              className={cn(
                'flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm text-gray-700 outline-none transition hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-slate-800',
                activeTheme === value && 'bg-blue-50 text-blue-700 dark:bg-slate-800 dark:text-sky-300',
              )}
            >
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {label}
              </span>
              {activeTheme === value ? <Check className="h-4 w-4" /> : null}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}