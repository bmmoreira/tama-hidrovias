'use strict';

const {
  applyGeoJsonImportAndValidation,
} = require('../../utils/geojson');

const MAP_FEATURE_COLLECTION_UID =
  'api::map-feature-collection.map-feature-collection';

async function findExistingEntry(id) {
  if (!id) {
    return null;
  }

  return strapi.entityService.findOne(MAP_FEATURE_COLLECTION_UID, id, {
    populate: {
      geojsonFile: true,
    },
  });
}

module.exports = {
  async beforeCreate(event) {
    await applyGeoJsonImportAndValidation(strapi, event.params.data);
  },

  async beforeUpdate(event) {
    const existingEntry = await findExistingEntry(event.params.where?.id);

    await applyGeoJsonImportAndValidation(
      strapi,
      event.params.data,
      existingEntry,
    );
  },
};