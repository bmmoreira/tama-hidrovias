'use strict';

const STATION_UID = 'api::station.station';
const MANAGED_METADATA_KEY = 'mockFeatureCollectionStation';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function getFeatureCoordinates(feature) {
  const coordinates = feature?.geometry?.coordinates;

  if (Array.isArray(coordinates) && coordinates.length >= 2) {
    const longitude = normalizeNumber(coordinates[0]);
    const latitude = normalizeNumber(coordinates[1]);

    if (longitude !== undefined && latitude !== undefined) {
      return { longitude, latitude };
    }
  }

  const properties = asObject(feature?.properties);
  const longitude = normalizeNumber(properties.long ?? properties.longitude);
  const latitude = normalizeNumber(properties.lat ?? properties.latitude);

  if (longitude !== undefined && latitude !== undefined) {
    return { longitude, latitude };
  }

  return null;
}

function getExternalId(feature, index) {
  const properties = asObject(feature?.properties);
  const candidate = normalizeNumber(properties.id);

  if (candidate !== undefined) {
    return Math.trunc(candidate);
  }

  return 900000 + index;
}

function buildStationSeed(feature, index) {
  const coordinates = getFeatureCoordinates(feature);

  if (!coordinates) {
    return null;
  }

  const properties = asObject(feature?.properties);
  const externalId = getExternalId(feature, index);
  const name = normalizeString(properties.name) ?? `Mock Station ${externalId}`;

  return {
    externalId,
    name,
    code: `MF-${String(externalId)}`,
    source: 'Virtual',
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    basin: normalizeString(properties.basin),
    river: normalizeString(properties.river),
    active: true,
    metadata: {
      [MANAGED_METADATA_KEY]: true,
      featureName: name,
      satellite: normalizeString(properties.sat ?? properties.satellite),
      anomaly: normalizeNumber(properties.anomalia),
      value: normalizeNumber(properties.value),
      change: normalizeNumber(properties.change),
      startDate: normalizeString(properties.s_date),
      endDate: normalizeString(properties.e_date),
    },
    publishedAt: new Date().toISOString(),
  };
}

function collectStationSeeds(featureCollection) {
  const features = Array.isArray(featureCollection?.features)
    ? featureCollection.features
    : [];

  return features
    .map((feature, index) => buildStationSeed(feature, index))
    .filter(Boolean);
}

function isManagedMockStation(station) {
  return station?.source === 'Virtual' || station?.metadata?.[MANAGED_METADATA_KEY] === true;
}

async function ensureStationsForFeatureCollection(strapi, featureCollection) {
  const stationSeeds = collectStationSeeds(featureCollection);
  let created = 0;
  let updated = 0;

  for (const seed of stationSeeds) {
    const existingStation = await strapi.db.query(STATION_UID).findOne({
      where: { externalId: seed.externalId },
      select: ['id', 'source', 'metadata'],
    });

    if (!existingStation) {
      await strapi.entityService.create(STATION_UID, {
        data: seed,
      });
      created += 1;
      continue;
    }

    if (!isManagedMockStation(existingStation)) {
      continue;
    }

    await strapi.entityService.update(STATION_UID, existingStation.id, {
      data: seed,
    });
    updated += 1;
  }

  return {
    totalSeeds: stationSeeds.length,
    created,
    updated,
  };
}

module.exports = {
  collectStationSeeds,
  ensureStationsForFeatureCollection,
};