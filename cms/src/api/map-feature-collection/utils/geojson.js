'use strict';

const fs = require('fs/promises');
const path = require('path');

const ALLOWED_GEOJSON_MIME_TYPES = new Set([
  'application/geo+json',
  'application/json',
  'text/json',
  'text/plain',
]);

const ALLOWED_GEOJSON_EXTENSIONS = new Set(['.geojson', '.json']);

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseCoordinates(geometry) {
  if (
    !isObject(geometry) ||
    geometry.type !== 'Point' ||
    !Array.isArray(geometry.coordinates) ||
    geometry.coordinates.length < 2
  ) {
    throw new Error(
      'GeoJSON features must define Point geometry with [longitude, latitude] coordinates.',
    );
  }

  const [longitude, latitude] = geometry.coordinates;

  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    throw new Error(
      'GeoJSON Point coordinates must contain finite longitude and latitude numbers.',
    );
  }

  return [longitude, latitude];
}

function validateFeature(feature, index) {
  if (!isObject(feature) || feature.type !== 'Feature') {
    throw new Error(`GeoJSON feature at index ${index} must have type "Feature".`);
  }

  if (!isObject(feature.properties)) {
    throw new Error(
      `GeoJSON feature at index ${index} must contain an object in "properties".`,
    );
  }

  parseCoordinates(feature.geometry);
}

function validateFeatureCollection(featureCollection) {
  if (!isObject(featureCollection)) {
    throw new Error('GeoJSON payload must be an object.');
  }

  if (featureCollection.type !== 'FeatureCollection') {
    throw new Error('GeoJSON payload must have type "FeatureCollection".');
  }

  if (!Array.isArray(featureCollection.features)) {
    throw new Error('GeoJSON FeatureCollection must define a "features" array.');
  }

  featureCollection.features.forEach((feature, index) => {
    validateFeature(feature, index);
  });

  return featureCollection;
}

function extractMediaId(value) {
  if (typeof value === 'number') {
    return value;
  }

  if (Array.isArray(value)) {
    return extractMediaId(value[0]);
  }

  if (!isObject(value)) {
    return null;
  }

  if (typeof value.id === 'number') {
    return value.id;
  }

  if (Array.isArray(value.connect) && value.connect.length > 0) {
    return extractMediaId(value.connect[0]);
  }

  if (Array.isArray(value.set) && value.set.length > 0) {
    return extractMediaId(value.set[0]);
  }

  return null;
}

async function readUploadFilePayload(strapiInstance, uploadFile) {
  const normalizedUrl = normalizeString(uploadFile?.url);

  if (!normalizedUrl) {
    throw new Error('Uploaded GeoJSON file is missing a readable URL.');
  }

  if (/^https?:\/\//i.test(normalizedUrl)) {
    const response = await fetch(normalizedUrl, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to download uploaded GeoJSON file (${response.status}).`,
      );
    }

    return response.text();
  }

  const publicDir = strapiInstance.dirs.static.public;
  const relativePath = normalizedUrl.replace(/^\/+/, '');
  const absolutePath = path.join(publicDir, relativePath);

  return fs.readFile(absolutePath, 'utf8');
}

async function importFeatureCollectionFromUpload(strapiInstance, fileId) {
  if (!fileId) {
    return null;
  }

  const uploadFile = await strapiInstance.entityService.findOne(
    'plugin::upload.file',
    fileId,
  );

  if (!uploadFile) {
    throw new Error('Uploaded GeoJSON file could not be found.');
  }

  const extension = normalizeString(uploadFile.ext).toLowerCase();
  const mimeType = normalizeString(uploadFile.mime).toLowerCase();

  if (
    !ALLOWED_GEOJSON_EXTENSIONS.has(extension) &&
    !ALLOWED_GEOJSON_MIME_TYPES.has(mimeType)
  ) {
    throw new Error(
      'Uploaded file must use .geojson or .json and contain valid GeoJSON content.',
    );
  }

  const rawPayload = await readUploadFilePayload(strapiInstance, uploadFile);

  let parsedPayload;

  try {
    parsedPayload = JSON.parse(rawPayload);
  } catch (error) {
    throw new Error('Uploaded GeoJSON file does not contain valid JSON.');
  }

  return validateFeatureCollection(parsedPayload);
}

async function applyGeoJsonImportAndValidation(
  strapiInstance,
  data,
  existingEntry,
) {
  if (!isObject(data)) {
    return;
  }

  const nextFileId = extractMediaId(data.geojsonFile);
  const existingFileId = existingEntry?.geojsonFile?.id ?? null;
  const shouldImportFromUpload =
    nextFileId !== null && nextFileId !== existingFileId;

  if (shouldImportFromUpload) {
    data.featureCollection = await importFeatureCollectionFromUpload(
      strapiInstance,
      nextFileId,
    );

    if (!normalizeString(data.name) && normalizeString(data.featureCollection?.name)) {
      data.name = data.featureCollection.name;
    }
  }

  if (data.featureCollection !== undefined) {
    data.featureCollection = validateFeatureCollection(data.featureCollection);
  }
}

module.exports = {
  applyGeoJsonImportAndValidation,
  validateFeatureCollection,
};