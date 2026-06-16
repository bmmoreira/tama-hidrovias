'use strict';

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService(
  'api::swot-gauge-collection.swot-gauge-collection',
);
