'use strict';

const RIVER_SEED_DEFINITIONS = [
  { river: 'AMAZONAS', basin: 'AMAZONAS', latitude: -2.65, longitude: -58.1, value: 14.2 },
  { river: 'SOLIMOES', basin: 'AMAZONAS', latitude: -3.18, longitude: -60.1, value: 18.4 },
  { river: 'NEGRO', basin: 'AMAZONAS', latitude: -1.92, longitude: -61.2, value: 7.6 },
  { river: 'MADEIRA', basin: 'MADEIRA', latitude: -8.21, longitude: -63.9, value: 11.1 },
  { river: 'TAPAJOS', basin: 'TAPAJOS', latitude: -4.31, longitude: -55.8, value: 8.9 },
  { river: 'XINGU', basin: 'XINGU', latitude: -3.44, longitude: -52.4, value: 6.7 },
  { river: 'TOCANTINS', basin: 'TOCANTINS', latitude: -5.52, longitude: -49.1, value: 5.1 },
  { river: 'PURUS', basin: 'AMAZONAS', latitude: -6.14, longitude: -67.2, value: 9.4 },
];

const DEFAULT_FEATURE_COUNT = 128;
const DEFAULT_FEATURE_COLLECTION_NAME = 'sv';

function toRoundedNumber(value, digits) {
  return Number(value.toFixed(digits));
}

function formatIsoDate(dayOffset) {
  const date = new Date(Date.UTC(2026, 2, 1 + dayOffset));
  return date.toISOString().slice(0, 10);
}

function buildMockFeature(index) {
  const definition = RIVER_SEED_DEFINITIONS[index % RIVER_SEED_DEFINITIONS.length];
  const riverBatch = Math.floor(index / RIVER_SEED_DEFINITIONS.length);
  const featureId = 201100 + index;
  const latitude = toRoundedNumber(
    definition.latitude + riverBatch * 0.11 + ((index % 3) - 1) * 0.035,
    4,
  );
  const longitude = toRoundedNumber(
    definition.longitude + riverBatch * 0.16 + ((index % 4) - 1.5) * 0.045,
    4,
  );
  const anomaly = toRoundedNumber(((index % 11) - 5) * 0.18, 1);
  const change = toRoundedNumber(((index % 7) - 3) * 0.17, 2);
  const value = toRoundedNumber(definition.value + riverBatch * 0.28 + (index % 5) * 0.14, 2);
  const kilometerMark = String(100 + index * 8).padStart(4, '0');

  return {
    type: 'Feature',
    properties: {
      name: `R_${definition.river}_${definition.basin}_KM${kilometerMark}`,
      id: featureId,
      lat: latitude,
      long: longitude,
      sat: `SWOT-${String(index + 1).padStart(4, '0')}`,
      river: definition.river,
      basin: definition.basin,
      s_date: formatIsoDate(index % 21),
      e_date: formatIsoDate(7 + (index % 21)),
      anomalia: anomaly,
      value,
      change,
    },
    geometry: {
      type: 'Point',
      coordinates: [longitude, latitude],
    },
  };
}

function buildDefaultFeatureCollection() {
  return {
    type: 'FeatureCollection',
    name: DEFAULT_FEATURE_COLLECTION_NAME,
    crs: {
      type: 'name',
      properties: {
        name: 'urn:ogc:def:crs:OGC:1.3:CRS84',
      },
    },
    features: Array.from({ length: DEFAULT_FEATURE_COUNT }, (_, index) =>
      buildMockFeature(index),
    ),
  };
}

const DEFAULT_MAP_FEATURE_COLLECTION_ENTRY = {
  name: DEFAULT_FEATURE_COLLECTION_NAME,
  featureCollection: buildDefaultFeatureCollection(),
};

module.exports = {
  DEFAULT_FEATURE_COUNT,
  buildDefaultFeatureCollection,
  DEFAULT_MAP_FEATURE_COLLECTION_ENTRY,
};