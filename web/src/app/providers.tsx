'use client';

import React, { useEffect, useRef, useState } from 'react';
import { SessionProvider } from 'next-auth/react';
import { useSession } from 'next-auth/react';
import type { Session } from 'next-auth';
import { ThemeProvider, useTheme } from 'next-themes';
import AppI18nProvider from '@/components/AppI18nProvider';
import {
  APP_SETTINGS_UPDATED_EVENT,
  DEFAULT_LANGUAGE,
  USER_PREFERENCES_UPDATED_EVENT,
  normalizeLanguage,
} from '@/lib/i18n';
import type { LanguagePreference, ThemePreference } from '@/lib/strapi';

/**
 * Top-level providers composing theme, NextAuth session and i18n.
 */
export interface ProvidersProps {
  children: React.ReactNode;
  session?: Session | null;
  initialLanguage: LanguagePreference;
}

const THEME_VALUES = new Set<ThemePreference>(['light', 'dark', 'system']);
const LANGUAGE_VALUES = new Set<LanguagePreference>(['pt-BR', 'en', 'es', 'fr']);

function RuntimePreferenceSync({
  onLanguageChange,
}: {
  onLanguageChange: (language: LanguagePreference) => void;
}) {
  const { status } = useSession();
  const { setTheme } = useTheme();
  const hasLoadedUserPreferencesRef = useRef(false);

  useEffect(() => {
    void fetch('/api/app-settings', {
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
        const language = payload?.data?.appearance?.language;

        if (LANGUAGE_VALUES.has(language)) {
          onLanguageChange(language);
        }
      })
      .catch(() => {
        onLanguageChange(DEFAULT_LANGUAGE);
      });
  }, [onLanguageChange]);

  useEffect(() => {
    if (status !== 'authenticated' || hasLoadedUserPreferencesRef.current) {
      return;
    }

    hasLoadedUserPreferencesRef.current = true;

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
        const language = payload?.data?.appearance?.language;

        if (THEME_VALUES.has(theme)) {
          setTheme(theme);
        }

        if (LANGUAGE_VALUES.has(language)) {
          onLanguageChange(language);
        }
      })
      .catch(() => {
        // Ignore preference sync failures and keep local theme fallback.
      });
  }, [onLanguageChange, setTheme, status]);

  useEffect(() => {
    if (status === 'authenticated') {
      return;
    }

    hasLoadedUserPreferencesRef.current = false;
  }, [status]);

  useEffect(() => {
    function handlePreferencesUpdated(event: Event) {
      const detail = (
        event as CustomEvent<{
          theme?: ThemePreference;
          language?: LanguagePreference;
        }>
      ).detail;

      if (detail?.theme && THEME_VALUES.has(detail.theme)) {
        setTheme(detail.theme);
      }

      if (detail?.language && LANGUAGE_VALUES.has(detail.language)) {
        onLanguageChange(detail.language);
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
  }, [onLanguageChange, setTheme]);

  useEffect(() => {
    function handleAppSettingsUpdated(event: Event) {
      const detail = (event as CustomEvent<{ language?: LanguagePreference }>).detail;

      if (detail?.language && LANGUAGE_VALUES.has(detail.language)) {
        onLanguageChange(detail.language);
      }
    }

    window.addEventListener(
      APP_SETTINGS_UPDATED_EVENT,
      handleAppSettingsUpdated as EventListener,
    );

    return () => {
      window.removeEventListener(
        APP_SETTINGS_UPDATED_EVENT,
        handleAppSettingsUpdated as EventListener,
      );
    };
  }, [onLanguageChange]);

  return null;
}

export function Providers({ children, initialLanguage, session }: ProvidersProps) {
  const [language, setLanguage] = useState<LanguagePreference>(
    normalizeLanguage(initialLanguage ?? DEFAULT_LANGUAGE),
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <SessionProvider session={session}>
        <AppI18nProvider language={normalizeLanguage(language)}>
          <RuntimePreferenceSync onLanguageChange={setLanguage} />
          {children}
        </AppI18nProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
