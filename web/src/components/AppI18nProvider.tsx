'use client';

import { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n, { normalizeLanguage } from '@/lib/i18n';
import type { LanguagePreference } from '@/lib/strapi';

interface AppI18nProviderProps {
  children: React.ReactNode;
  language: LanguagePreference;
}

export default function AppI18nProvider({
  children,
  language,
}: AppI18nProviderProps) {
  const nextLanguage = normalizeLanguage(language);

  useEffect(() => {
    document.documentElement.lang = nextLanguage;

    if (i18n.resolvedLanguage !== nextLanguage) {
      void i18n.changeLanguage(nextLanguage);
    }
  }, [nextLanguage]);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}