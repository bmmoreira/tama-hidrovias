'use strict';

const {
  DEFAULT_MAP_FEATURE_COLLECTION_ENTRY,
} = require('./api/map-feature-collection/utils/default-feature-collection');
const {
  ensureStationsForFeatureCollection,
} = require('./api/station/utils/feature-station-sync');

const MAP_FEATURE_COLLECTION_UID =
  'api::map-feature-collection.map-feature-collection';

async function ensureMapFeatureCollection(strapi) {
  const existingEntry = await strapi.entityService.findMany(
    MAP_FEATURE_COLLECTION_UID,
  );

  if (existingEntry) {
    return existingEntry;
  }

  return strapi.entityService.create(MAP_FEATURE_COLLECTION_UID, {
    data: {
      ...DEFAULT_MAP_FEATURE_COLLECTION_ENTRY,
      publishedAt: new Date().toISOString(),
    },
  });
}

module.exports = {
  register(/*{ strapi }*/) {},
  async bootstrap({ strapi }) {
    const featureCollectionEntry = await ensureMapFeatureCollection(strapi);

    await ensureStationsForFeatureCollection(
      strapi,
      featureCollectionEntry?.featureCollection,
    );
  },
  destroy(/*{ strapi }*/) {},
};
