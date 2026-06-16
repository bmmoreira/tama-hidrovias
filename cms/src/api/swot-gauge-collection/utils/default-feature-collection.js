'use strict';

const DEFAULT_FEATURE_COLLECTION_NAME = 'swot_nodes_gauges_latest';

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
    features: [
      {
        type: 'Feature',
        properties: {
          station_id: '10014500',
          Nome: 'JIVINO VERDE SALIDA DEL PUEBLO JIVINIO',
          latitude: -0.1883,
          longitude: -76.8331,
          date: null,
          median: null,
          std: null,
          previous_date: null,
          previous_median: null,
          previous_std: null,
          Change: null,
          Change_day: null,
          delta_days: null,
        },
        geometry: {
          type: 'Point',
          coordinates: [-76.8331, -0.1883],
        },
      },
      {
        type: 'Feature',
        properties: {
          station_id: '10014600',
          Nome: 'LIMONCOCHA SECTOR SHUSHUFINDI',
          latitude: -0.3528,
          longitude: -76.6114,
          date: null,
          median: null,
          std: null,
          previous_date: null,
          previous_median: null,
          previous_std: null,
          Change: null,
          Change_day: null,
          delta_days: null,
        },
        geometry: {
          type: 'Point',
          coordinates: [-76.6114, -0.3528],
        },
      },
      {
        type: 'Feature',
        properties: {
          station_id: '10015000',
          Nome: 'PUERTO FRANCISCO DE ORELLANA',
          latitude: -0.4736,
          longitude: -76.9753,
          date: '2026-06-08 15:01:06',
          median: 245.4615,
          std: 0.0583,
          previous_date: '2026-05-24 05:27:53',
          previous_median: 249.6316,
          previous_std: 1.2655,
          Change: -4.1701,
          Change_day: -0.2708,
          delta_days: 15.3981,
        },
        geometry: {
          type: 'Point',
          coordinates: [-76.9753, -0.4736],
        },
      },
    ],
  };
}

const DEFAULT_SWOT_GAUGE_COLLECTION_ENTRY = {
  name: DEFAULT_FEATURE_COLLECTION_NAME,
  featureCollection: buildDefaultFeatureCollection(),
};

module.exports = {
  DEFAULT_FEATURE_COLLECTION_NAME,
  buildDefaultFeatureCollection,
  DEFAULT_SWOT_GAUGE_COLLECTION_ENTRY,
};
