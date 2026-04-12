'use strict';

const {
  DEFAULT_MAP_FEATURE_COLLECTION_ENTRY,
} = require('./api/map-feature-collection/utils/default-feature-collection');

const MAP_FEATURE_COLLECTION_UID =
  'api::map-feature-collection.map-feature-collection';

module.exports = {
  register(/*{ strapi }*/) {},
  async bootstrap({ strapi }) {
    const existingEntries = await strapi.entityService.findMany(
      MAP_FEATURE_COLLECTION_UID,
      {
        limit: 1,
      },
    );

    const existingEntry = Array.isArray(existingEntries)
      ? existingEntries[0] ?? null
      : existingEntries;

    if (!existingEntry) {
      await strapi.entityService.create(MAP_FEATURE_COLLECTION_UID, {
        data: DEFAULT_MAP_FEATURE_COLLECTION_ENTRY,
      });
    }
  },
  destroy(/*{ strapi }*/) {},
};
