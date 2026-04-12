'use strict';

const {
  DEFAULT_MAP_FEATURE_COLLECTION_ENTRY,
} = require('./api/map-feature-collection/utils/default-feature-collection');

const MAP_FEATURE_COLLECTION_UID =
  'api::map-feature-collection.map-feature-collection';

module.exports = {
  register(/*{ strapi }*/) {},
  async bootstrap({ strapi }) {
    const existingEntry = await strapi.entityService.findMany(
      MAP_FEATURE_COLLECTION_UID,
    );

    if (!existingEntry) {
      await strapi.entityService.create(MAP_FEATURE_COLLECTION_UID, {
        data: DEFAULT_MAP_FEATURE_COLLECTION_ENTRY,
      });
    }
  },
  destroy(/*{ strapi }*/) {},
};
