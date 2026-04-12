'use strict';

const APP_SETTING_UID = 'api::app-setting.app-setting';
const ALLOWED_LANGUAGES = new Set(['pt-BR', 'en', 'es', 'fr']);
const ALLOWED_MAP_STYLES = new Set(['outdoors', 'streets', 'satellite', 'dark']);
const ALLOWED_ADMIN_ROLES = new Set(['admin', 'analyst', 'super-admin']);

const DEFAULT_APP_SETTINGS = {
  appearance: {
    language: 'pt-BR',
  },
  map: {
    mapStyle: 'outdoors',
    defaultZoom: 4,
    centerLatitude: -15,
    centerLongitude: -52,
  },
};

const APP_SETTING_POPULATE = {
  appearance: true,
  map: true,
};

function parseFiniteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeRole(value) {
  return value
    ?.trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

async function getAuthenticatedUserFromRequest(ctx) {
  const authorization = ctx.request.header.authorization ?? '';

  if (!authorization.startsWith('Bearer ')) {
    return null;
  }

  const token = authorization.slice('Bearer '.length).trim();

  if (!token) {
    return null;
  }

  try {
    const payload = await strapi
      .plugin('users-permissions')
      .service('jwt')
      .verify(token);

    if (!payload?.id) {
      return null;
    }

    return strapi.entityService.findOne(
      'plugin::users-permissions.user',
      payload.id,
      {
        populate: {
          role: true,
        },
      },
    );
  } catch (error) {
    return null;
  }
}

function normalizePayload(body = {}) {
  const appearance = body.appearance ?? {};
  const map = body.map ?? {};

  return {
    appearance: {
      language: ALLOWED_LANGUAGES.has(appearance.language)
        ? appearance.language
        : DEFAULT_APP_SETTINGS.appearance.language,
    },
    map: {
      mapStyle: ALLOWED_MAP_STYLES.has(map.mapStyle)
        ? map.mapStyle
        : DEFAULT_APP_SETTINGS.map.mapStyle,
      defaultZoom: parseFiniteNumber(
        map.defaultZoom,
        DEFAULT_APP_SETTINGS.map.defaultZoom,
      ),
      centerLatitude: parseFiniteNumber(
        map.centerLatitude,
        DEFAULT_APP_SETTINGS.map.centerLatitude,
      ),
      centerLongitude: parseFiniteNumber(
        map.centerLongitude,
        DEFAULT_APP_SETTINGS.map.centerLongitude,
      ),
    },
  };
}

async function findAppSetting() {
  const appSettings = await strapi.entityService.findMany(APP_SETTING_UID, {
    populate: APP_SETTING_POPULATE,
    limit: 1,
  });

  return Array.isArray(appSettings) ? appSettings[0] ?? null : appSettings;
}

async function findOrCreateAppSetting() {
  const existing = await findAppSetting();

  if (existing) {
    return existing;
  }

  return strapi.entityService.create(APP_SETTING_UID, {
    data: DEFAULT_APP_SETTINGS,
    populate: APP_SETTING_POPULATE,
  });
}

function serializeAppSetting(appSetting) {
  return {
    id: appSetting.id,
    appearance: {
      language:
        appSetting.appearance?.language ??
        DEFAULT_APP_SETTINGS.appearance.language,
    },
    map: {
      mapStyle: appSetting.map?.mapStyle ?? DEFAULT_APP_SETTINGS.map.mapStyle,
      defaultZoom: Number(
        appSetting.map?.defaultZoom ?? DEFAULT_APP_SETTINGS.map.defaultZoom,
      ),
      centerLatitude: Number(
        appSetting.map?.centerLatitude ??
          DEFAULT_APP_SETTINGS.map.centerLatitude,
      ),
      centerLongitude: Number(
        appSetting.map?.centerLongitude ??
          DEFAULT_APP_SETTINGS.map.centerLongitude,
      ),
    },
  };
}

module.exports = {
  async public(ctx) {
    const appSetting = await findOrCreateAppSetting();

    ctx.body = {
      data: serializeAppSetting(appSetting),
    };
  },

  async current(ctx) {
    const authUser = await getAuthenticatedUserFromRequest(ctx);

    if (!authUser) {
      return ctx.unauthorized('Authentication required.');
    }

    const normalizedRole = normalizeRole(
      authUser.role?.name ?? authUser.role?.type,
    );

    if (!ALLOWED_ADMIN_ROLES.has(normalizedRole)) {
      return ctx.forbidden('Admin access required.');
    }

    const appSetting = await findOrCreateAppSetting();

    ctx.body = {
      data: serializeAppSetting(appSetting),
    };
  },

  async updateCurrent(ctx) {
    const authUser = await getAuthenticatedUserFromRequest(ctx);

    if (!authUser) {
      return ctx.unauthorized('Authentication required.');
    }

    const normalizedRole = normalizeRole(
      authUser.role?.name ?? authUser.role?.type,
    );

    if (!ALLOWED_ADMIN_ROLES.has(normalizedRole)) {
      return ctx.forbidden('Admin access required.');
    }

    const body = ctx.request.body?.data ?? ctx.request.body ?? {};
    const existingAppSetting = await findOrCreateAppSetting();

    await strapi.entityService.update(APP_SETTING_UID, existingAppSetting.id, {
      data: normalizePayload(body),
    });

    const updatedAppSetting = await strapi.entityService.findOne(
      APP_SETTING_UID,
      existingAppSetting.id,
      {
        populate: APP_SETTING_POPULATE,
      },
    );

    ctx.body = {
      data: serializeAppSetting(updatedAppSetting),
    };
  },
};