'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

const SWOT_MEASUREMENT_UID = 'api::swot-measurement.swot-measurement';

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizePublicQuery(query = {}) {
  const page = parsePositiveInteger(query.pagination?.page, 1);
  const pageSize = Math.min(
    parsePositiveInteger(query.pagination?.pageSize, 100),
    1000,
  );

  return {
    filters: query.filters,
    sort: query.sort,
    start: (page - 1) * pageSize,
    limit: pageSize,
  };
}

function serializeSwotMeasurement(record) {
  const { id, ...attributes } = record;

  return {
    id,
    attributes,
  };
}

module.exports = createCoreController(SWOT_MEASUREMENT_UID, () => ({
  async public(ctx) {
    const query = normalizePublicQuery(ctx.query);
    const records = await strapi.entityService.findMany(
      SWOT_MEASUREMENT_UID,
      query,
    );

    ctx.body = {
      data: records.map(serializeSwotMeasurement),
    };
  },
}));
