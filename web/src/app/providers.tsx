'use client';

import React, { useEffect, useRef } from 'react';
import { SessionProvider } from 'next-auth/react';
import { useSession } from 'next-auth/react';
import type { Session } from 'next-auth';
import { ThemeProvider, useTheme } from 'next-themes';
import type { ThemePreference } from '@/lib/strapi';

interface ProvidersProps {
  children: React.ReactNode;
  session?: Session | null;
}

const THEME_VALUES = new Set<ThemePreference>(['light', 'dark', 'system']);
const USER_PREFERENCES_UPDATED_EVENT = 'user-preferences-updated';

function UserThemePreferenceSync() {
  const { status } = useSession();
  const { setTheme } = useTheme();
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (status !== 'authenticated' || hasLoadedRef.current) {
      return;
    }

    hasLoadedRef.current = true;

    void fetch('/api/users/me/preferences', {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        return response.json();
      })
      .then((payload) => {
        const theme = payload?.data?.appearance?.theme;

        if (THEME_VALUES.has(theme)) {
          setTheme(theme);
        }
      })
      .catch(() => {
        // Ignore preference sync failures and keep local theme fallback.
      });
  }, [setTheme, status]);

  useEffect(() => {
    function handlePreferencesUpdated(event: Event) {
      const detail = (event as CustomEvent<{ theme?: ThemePreference }>).detail;

      if (detail?.theme && THEME_VALUES.has(detail.theme)) {
        setTheme(detail.theme);
      }
    }

    window.addEventListener(
      USER_PREFERENCES_UPDATED_EVENT,
      handlePreferencesUpdated as EventListener,
    );

    return () => {
      window.removeEventListener(
        USER_PREFERENCES_UPDATED_EVENT,
        handlePreferencesUpdated as EventListener,
      );
    };
  }, [setTheme]);

  return null;
}

export function Providers({ children, session }: ProvidersProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <SessionProvider session={session}>
        <UserThemePreferenceSync />
        {children}
      </SessionProvider>
    </ThemeProvider>
  );
}
