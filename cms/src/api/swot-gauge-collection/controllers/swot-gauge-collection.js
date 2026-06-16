'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const {
  DEFAULT_SWOT_GAUGE_COLLECTION_ENTRY,
} = require('../utils/default-feature-collection');

const SWOT_GAUGE_COLLECTION_UID =
  'api::swot-gauge-collection.swot-gauge-collection';

async function findSwotGaugeCollection() {
  return strapi.entityService.findMany(SWOT_GAUGE_COLLECTION_UID);
}

async function findOrCreateSwotGaugeCollection() {
  const existingEntry = await findSwotGaugeCollection();

  if (existingEntry) {
    return existingEntry;
  }

  return strapi.entityService.create(SWOT_GAUGE_COLLECTION_UID, {
    data: DEFAULT_SWOT_GAUGE_COLLECTION_ENTRY,
  });
}

function serializeSwotGaugeCollection(entry) {
  return {
    id: entry.id,
    name: entry.name,
    featureCollection: entry.featureCollection,
  };
}

module.exports = createCoreController(
  SWOT_GAUGE_COLLECTION_UID,
  () => ({
    async public(ctx) {
      const entry = await findOrCreateSwotGaugeCollection();

      ctx.body = {
        data: serializeSwotGaugeCollection(entry),
      };
    },
  }),
);
