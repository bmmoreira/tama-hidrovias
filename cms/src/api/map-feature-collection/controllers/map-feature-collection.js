'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const {
  DEFAULT_MAP_FEATURE_COLLECTION_ENTRY,
} = require('../utils/default-feature-collection');

const MAP_FEATURE_COLLECTION_UID =
  'api::map-feature-collection.map-feature-collection';

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
  }),
);