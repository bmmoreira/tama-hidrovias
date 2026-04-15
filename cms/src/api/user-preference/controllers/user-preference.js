'use strict';

const USER_PREFERENCE_UID = 'api::user-preference.user-preference';
const ALLOWED_THEMES = new Set(['light', 'dark', 'system']);
const ALLOWED_LANGUAGES = new Set(['pt-BR', 'en', 'es', 'fr']);
const ALLOWED_MAP_STYLES = new Set(['outdoors', 'streets', 'satellite', 'dark']);
const ALLOWED_ALERT_SEVERITIES = new Set(['info', 'warning', 'critical']);

const DEFAULT_PREFERENCES = {
  profile: {
    avatar: null,
    firstName: null,
    lastName: null,
    institution: null,
    profession: null,
    birthdate: null,
  },
  appearance: {
    theme: 'system',
    language: 'pt-BR',
    timeZone: 'America/Sao_Paulo',
  },
  map: {
    mapStyle: 'outdoors',
    defaultZoom: 4,
    centerLatitude: -15,
    centerLongitude: -52,
  },
  alerts: {
    enabled: false,
    favoritesOnly: true,
    emailNotifications: false,
    dashboardNotifications: true,
    minimumSeverity: 'warning',
    leadTimeMinutes: 60,
    dailyDigest: false,
    stationOfflineAlerts: true,
    forecastThresholdAlerts: true,
  },
};

const PREFERENCE_POPULATE = {
  profile: {
    populate: {
      avatar: true,
    },
  },
  appearance: true,
  map: true,
  alerts: true,
  favoriteStations: {
    fields: ['name', 'code', 'basin', 'source'],
  },
};

function parseFiniteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
    );
  } catch (error) {
    return null;
  }
}

function normalizePayload(body = {}) {
  const appearance = body.appearance ?? {};
  const map = body.map ?? {};
  const alerts = body.alerts ?? {};
  const profile = body.profile ?? {};
  const favoriteStationIds = Array.isArray(body.favoriteStationIds)
    ? body.favoriteStationIds
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    : null;

  const normalized = {
    profile: {
      avatar:
        typeof profile.avatar === 'number' && Number.isInteger(profile.avatar)
          ? profile.avatar
          : null,
      firstName:
        typeof profile.firstName === 'string' && profile.firstName.trim()
          ? profile.firstName.trim()
          : null,
      lastName:
        typeof profile.lastName === 'string' && profile.lastName.trim()
          ? profile.lastName.trim()
          : null,
      institution:
        typeof profile.institution === 'string' && profile.institution.trim()
          ? profile.institution.trim()
          : null,
      profession:
        typeof profile.profession === 'string' && profile.profession.trim()
          ? profile.profession.trim()
          : null,
      birthdate:
        typeof profile.birthdate === 'string' && profile.birthdate.trim()
          ? profile.birthdate.trim()
          : null,
    },
    appearance: {
      theme: ALLOWED_THEMES.has(appearance.theme)
        ? appearance.theme
        : DEFAULT_PREFERENCES.appearance.theme,
      language: ALLOWED_LANGUAGES.has(appearance.language)
        ? appearance.language
        : DEFAULT_PREFERENCES.appearance.language,
      timeZone:
        typeof appearance.timeZone === 'string' && appearance.timeZone.trim()
          ? appearance.timeZone.trim()
          : DEFAULT_PREFERENCES.appearance.timeZone,
    },
    map: {
      mapStyle: ALLOWED_MAP_STYLES.has(map.mapStyle)
        ? map.mapStyle
        : DEFAULT_PREFERENCES.map.mapStyle,
      defaultZoom: parseFiniteNumber(
        map.defaultZoom,
        DEFAULT_PREFERENCES.map.defaultZoom,
      ),
      centerLatitude: parseFiniteNumber(
        map.centerLatitude,
        DEFAULT_PREFERENCES.map.centerLatitude,
      ),
      centerLongitude: parseFiniteNumber(
        map.centerLongitude,
        DEFAULT_PREFERENCES.map.centerLongitude,
      ),
    },
    alerts: {
      enabled:
        typeof alerts.enabled === 'boolean'
          ? alerts.enabled
          : DEFAULT_PREFERENCES.alerts.enabled,
      favoritesOnly:
        typeof alerts.favoritesOnly === 'boolean'
          ? alerts.favoritesOnly
          : DEFAULT_PREFERENCES.alerts.favoritesOnly,
      emailNotifications:
        typeof alerts.emailNotifications === 'boolean'
          ? alerts.emailNotifications
          : DEFAULT_PREFERENCES.alerts.emailNotifications,
      dashboardNotifications:
        typeof alerts.dashboardNotifications === 'boolean'
          ? alerts.dashboardNotifications
          : DEFAULT_PREFERENCES.alerts.dashboardNotifications,
      minimumSeverity: ALLOWED_ALERT_SEVERITIES.has(alerts.minimumSeverity)
        ? alerts.minimumSeverity
        : DEFAULT_PREFERENCES.alerts.minimumSeverity,
      leadTimeMinutes: parseFiniteNumber(
        alerts.leadTimeMinutes,
        DEFAULT_PREFERENCES.alerts.leadTimeMinutes,
      ),
      dailyDigest:
        typeof alerts.dailyDigest === 'boolean'
          ? alerts.dailyDigest
          : DEFAULT_PREFERENCES.alerts.dailyDigest,
      stationOfflineAlerts:
        typeof alerts.stationOfflineAlerts === 'boolean'
          ? alerts.stationOfflineAlerts
          : DEFAULT_PREFERENCES.alerts.stationOfflineAlerts,
      forecastThresholdAlerts:
        typeof alerts.forecastThresholdAlerts === 'boolean'
          ? alerts.forecastThresholdAlerts
          : DEFAULT_PREFERENCES.alerts.forecastThresholdAlerts,
    },
  };

  if (favoriteStationIds) {
    normalized.favoriteStations = { set: favoriteStationIds };
  }

  return normalized;
}

async function findUserPreference(userId) {
  const preferences = await strapi.entityService.findMany(USER_PREFERENCE_UID, {
    filters: {
      user: {
        id: userId,
      },
    },
    populate: PREFERENCE_POPULATE,
    limit: 1,
  });

  return preferences[0] ?? null;
}

async function findOrCreateUserPreference(userId) {
  const existing = await findUserPreference(userId);

  if (existing) {
    return existing;
  }

  return strapi.entityService.create(USER_PREFERENCE_UID, {
    data: {
      user: userId,
      ...DEFAULT_PREFERENCES,
    },
    populate: PREFERENCE_POPULATE,
  });
}

function serializePreference(preference) {
  return {
    id: preference.id,
    profile: {
      avatar: preference.profile?.avatar
        ? {
            id: preference.profile.avatar.id,
            url: preference.profile.avatar.url,
            alternativeText: preference.profile.avatar.alternativeText,
            width: preference.profile.avatar.width,
            height: preference.profile.avatar.height,
            mime: preference.profile.avatar.mime,
            size: preference.profile.avatar.size,
          }
        : null,
      firstName: preference.profile?.firstName ?? DEFAULT_PREFERENCES.profile.firstName,
      lastName: preference.profile?.lastName ?? DEFAULT_PREFERENCES.profile.lastName,
      institution:
        preference.profile?.institution ?? DEFAULT_PREFERENCES.profile.institution,
      profession:
        preference.profile?.profession ?? DEFAULT_PREFERENCES.profile.profession,
      birthdate: preference.profile?.birthdate ?? DEFAULT_PREFERENCES.profile.birthdate,
    },
    appearance: {
      theme:
        preference.appearance?.theme ?? DEFAULT_PREFERENCES.appearance.theme,
      language:
        preference.appearance?.language ??
        DEFAULT_PREFERENCES.appearance.language,
      timeZone:
        preference.appearance?.timeZone ??
        DEFAULT_PREFERENCES.appearance.timeZone,
    },
    map: {
      mapStyle:
        preference.map?.mapStyle ?? DEFAULT_PREFERENCES.map.mapStyle,
      defaultZoom: Number(
        preference.map?.defaultZoom ?? DEFAULT_PREFERENCES.map.defaultZoom,
      ),
      centerLatitude: Number(
        preference.map?.centerLatitude ??
          DEFAULT_PREFERENCES.map.centerLatitude,
      ),
      centerLongitude: Number(
        preference.map?.centerLongitude ??
          DEFAULT_PREFERENCES.map.centerLongitude,
      ),
    },
    alerts: {
      enabled:
        preference.alerts?.enabled ?? DEFAULT_PREFERENCES.alerts.enabled,
      favoritesOnly:
        preference.alerts?.favoritesOnly ??
        DEFAULT_PREFERENCES.alerts.favoritesOnly,
      emailNotifications:
        preference.alerts?.emailNotifications ??
        DEFAULT_PREFERENCES.alerts.emailNotifications,
      dashboardNotifications:
        preference.alerts?.dashboardNotifications ??
        DEFAULT_PREFERENCES.alerts.dashboardNotifications,
      minimumSeverity:
        preference.alerts?.minimumSeverity ??
        DEFAULT_PREFERENCES.alerts.minimumSeverity,
      leadTimeMinutes: Number(
        preference.alerts?.leadTimeMinutes ??
          DEFAULT_PREFERENCES.alerts.leadTimeMinutes,
      ),
      dailyDigest:
        preference.alerts?.dailyDigest ??
        DEFAULT_PREFERENCES.alerts.dailyDigest,
      stationOfflineAlerts:
        preference.alerts?.stationOfflineAlerts ??
        DEFAULT_PREFERENCES.alerts.stationOfflineAlerts,
      forecastThresholdAlerts:
        preference.alerts?.forecastThresholdAlerts ??
        DEFAULT_PREFERENCES.alerts.forecastThresholdAlerts,
    },
    favoriteStations: (preference.favoriteStations ?? []).map((station) => ({
      id: station.id,
      name: station.name,
      code: station.code,
      basin: station.basin,
      source: station.source,
    })),
  };
}

module.exports = {
  async me(ctx) {
    const authUser = await getAuthenticatedUserFromRequest(ctx);

    if (!authUser) {
      return ctx.unauthorized('Authentication required.');
    }

    const preference = await findOrCreateUserPreference(authUser.id);

    ctx.body = {
      data: serializePreference(preference),
    };
  },

  async updateMe(ctx) {
    const authUser = await getAuthenticatedUserFromRequest(ctx);

    if (!authUser) {
      return ctx.unauthorized('Authentication required.');
    }

    const body = ctx.request.body?.data ?? ctx.request.body ?? {};
    const existingPreference = await findOrCreateUserPreference(authUser.id);
    const existingAvatarId = existingPreference.profile?.avatar?.id ?? null;
    const normalized = normalizePayload(body);

    // Preserve the existing avatar relation unless the client explicitly
    // includes an `avatar` field in the profile payload. This ensures that
    // updates which only touch textual profile fields or other preferences
    // do not accidentally clear the avatar.
    const hasAvatarField = Object.prototype.hasOwnProperty.call(
      body.profile ?? {},
      'avatar',
    );

    if (!hasAvatarField) {
      normalized.profile.avatar = existingAvatarId;
    }

    const isAvatarChanging =
      hasAvatarField &&
      existingAvatarId &&
      typeof normalized.profile.avatar === 'number' &&
      normalized.profile.avatar !== existingAvatarId;

    await strapi.entityService.update(USER_PREFERENCE_UID, existingPreference.id, {
      data: normalized,
    });

    const updatedPreference = await strapi.entityService.findOne(
      USER_PREFERENCE_UID,
      existingPreference.id,
      {
        populate: PREFERENCE_POPULATE,
      },
    );

    ctx.body = {
      data: serializePreference(updatedPreference),
    };

    // If the avatar was changed, attempt to clean up the previous upload
    // file, but only when it is not referenced by any other relations. This
    // keeps the uploads folder tidy without risking deletion of shared
    // media.
    if (isAvatarChanging && existingAvatarId) {
      try {
        const file = await strapi.entityService.findOne(
          'plugin::upload.file',
          existingAvatarId,
          {
            populate: { related: true },
          },
        );

        const related = Array.isArray(file?.related) ? file.related : [];

        if (related.length <= 1) {
          await strapi.plugin('upload').service('upload').remove(file);
        }
      } catch (error) {
        strapi.log.warn(
          `Failed to clean up previous avatar file (id=${existingAvatarId}): ${error.message}`,
        );
      }
    }
  },
};