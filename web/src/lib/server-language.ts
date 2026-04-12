import { cookies } from 'next/headers';
import { getToken } from 'next-auth/jwt';
import { NextRequest } from 'next/server';
import {
  DEFAULT_LANGUAGE,
  getTranslationMessages,
  normalizeLanguage,
} from '@/lib/i18n-config';
import type { LanguagePreference } from '@/lib/strapi';

const STRAPI_INTERNAL_URL =
  process.env.STRAPI_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_STRAPI_URL ??
  'http://localhost:1337';

type AppSettingsResponse = {
  data?: {
    appearance?: {
      language?: string | null;
    };
  };
};

type UserPreferencesResponse = {
  data?: {
    appearance?: {
      language?: string | null;
    };
  };
};

async function fetchLanguage<T extends { data?: { appearance?: { language?: string | null } } }>(
  url: string,
  headers?: HeadersInit,
) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...(headers ?? {}),
    },
  }).catch(() => null);

  if (!response?.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as T | null;
  return normalizeLanguage(payload?.data?.appearance?.language);
}

async function getAuthenticatedLanguage() {
  const cookieHeader = (await cookies()).toString();

  if (!cookieHeader) {
    return null;
  }

  const token = await getToken({
    req: new NextRequest('http://localhost', {
      headers: {
        cookie: cookieHeader,
      },
    }),
    secret: process.env.NEXTAUTH_SECRET,
  });

  const accessToken = typeof token?.strapiJwt === 'string' ? token.strapiJwt : null;

  if (!accessToken) {
    return null;
  }

  return fetchLanguage<UserPreferencesResponse>(
    `${STRAPI_INTERNAL_URL}/api/users/me/preferences`,
    {
      Authorization: `Bearer ${accessToken}`,
    },
  );
}

async function getDefaultLanguage() {
  return fetchLanguage<AppSettingsResponse>(
    `${STRAPI_INTERNAL_URL}/api/app-settings/public`,
  );
}

export async function resolveRequestLanguage(): Promise<LanguagePreference> {
  const authenticatedLanguage = await getAuthenticatedLanguage();

  if (authenticatedLanguage) {
    return authenticatedLanguage;
  }

  const defaultLanguage = await getDefaultLanguage();

  return defaultLanguage ?? DEFAULT_LANGUAGE;
}

export async function getRequestTranslationMessages() {
  const language = await resolveRequestLanguage();

  return {
    language,
    messages: getTranslationMessages(language),
  };
}