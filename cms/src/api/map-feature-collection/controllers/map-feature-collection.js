'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const {
  DEFAULT_MAP_FEATURE_COLLECTION_ENTRY,
} = require('../utils/default-feature-collection');

const MAP_FEATURE_COLLECTION_UID =
  'api::map-feature-collection.map-feature-collection';
const ALLOWED_EDITOR_ROLES = new Set(['admin', 'analyst', 'super-admin']);

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

async function findMapFeatureCollection() {
  return strapi.entityService.findMany(MAP_FEATURE_COLLECTION_UID, {
    populate: {
      geojsonFile: true,
    },
  });
}

async function findOrCreateMapFeatureCollection() {
  const existingEntry = await findMapFeatureCollection();

  if (existingEntry) {
    return existingEntry;
  }

  return strapi.entityService.create(MAP_FEATURE_COLLECTION_UID, {
    data: DEFAULT_MAP_FEATURE_COLLECTION_ENTRY,
    populate: {
      geojsonFile: true,
    },
  });
}

function serializeMapFeatureCollection(entry) {
  return {
    id: entry.id,
    name: entry.name,
    geojsonFile: entry.geojsonFile ?? null,
    featureCollection: entry.featureCollection,
  };
}

module.exports = createCoreController(
  MAP_FEATURE_COLLECTION_UID,
  () => ({
    async public(ctx) {
      const entry = await findOrCreateMapFeatureCollection();

      ctx.body = {
        data: serializeMapFeatureCollection(entry),
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

      if (!ALLOWED_EDITOR_ROLES.has(normalizedRole)) {
        return ctx.forbidden('Analyst or admin access required.');
      }

      const entry = await findOrCreateMapFeatureCollection();

      ctx.body = {
        data: serializeMapFeatureCollection(entry),
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

      if (!ALLOWED_EDITOR_ROLES.has(normalizedRole)) {
        return ctx.forbidden('Analyst or admin access required.');
      }

      const body = ctx.request.body?.data ?? ctx.request.body ?? {};
      const existingEntry = await findOrCreateMapFeatureCollection();

      await strapi.entityService.update(
        MAP_FEATURE_COLLECTION_UID,
        existingEntry.id,
        {
          data: {
            name: body.name ?? existingEntry.name,
            featureCollection:
              body.featureCollection ?? existingEntry.featureCollection,
            geojsonFile: body.geojsonFile,
          },
          populate: {
            geojsonFile: true,
          },
        },
      );

      const updatedEntry = await strapi.entityService.findOne(
        MAP_FEATURE_COLLECTION_UID,
        existingEntry.id,
        {
          populate: {
            geojsonFile: true,
          },
        },
      );

      ctx.body = {
        data: serializeMapFeatureCollection(updatedEntry),
      };
    },
  }),
);