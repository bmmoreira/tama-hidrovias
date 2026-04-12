import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { LanguagePreference } from '@/lib/strapi';
import {
  APP_SETTINGS_UPDATED_EVENT,
  DEFAULT_LANGUAGE,
  USER_PREFERENCES_UPDATED_EVENT,
  normalizeLanguage,
  resources,
} from '@/lib/i18n-config';

export {
  APP_SETTINGS_UPDATED_EVENT,
  DEFAULT_LANGUAGE,
  USER_PREFERENCES_UPDATED_EVENT,
  normalizeLanguage,
  resources,
} from '@/lib/i18n-config';

function getInitialI18nLanguage(): LanguagePreference {
  if (typeof document !== 'undefined') {
    return normalizeLanguage(document.documentElement.lang);
  }

  return DEFAULT_LANGUAGE;
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: getInitialI18nLanguage(),
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: {
      escapeValue: false,
    },
  });
}

export default i18n;