'use strict';

const DEFAULT_MAP_FEATURE_COLLECTION_ENTRY = {
  name: 'sv',
  featureCollection: {
    type: 'FeatureCollection',
    name: 'sv',
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
          name: 'R_AMAZONAS-TRIB3_AMAZONAS-TRIB3_KM0100',
          id: 201162,
          lat: -0.1126,
          long: -51.6211,
          sat: 'SWOT-0005',
          river: 'AMAZONAS-TRIB3',
          basin: 'AMAZONAS-TRIB3',
          s_date: '2026-03-09',
          e_date: '2026-03-28',
          anomalia: 0.3,
          value: 3.49,
          change: 0.5,
        },
        geometry: {
          type: 'Point',
          coordinates: [-51.6211, -0.1126],
        },
      },
      {
        type: 'Feature',
        properties: {
          name: 'R_SOLIMOES_SOLIMOES_KM0420',
          id: 201163,
          lat: -3.1404,
          long: -60.0234,
          sat: 'SWOT-0008',
          river: 'SOLIMOES',
          basin: 'AMAZONAS',
          s_date: '2026-03-10',
          e_date: '2026-03-29',
          anomalia: -0.1,
          value: 18.72,
          change: -0.2,
        },
        geometry: {
          type: 'Point',
          coordinates: [-60.0234, -3.1404],
        },
      },
      {
        type: 'Feature',
        properties: {
          name: 'R_NEGRO_NEGRO_KM0875',
          id: 201164,
          lat: -1.4558,
          long: -48.4902,
          sat: 'SWOT-0012',
          river: 'NEGRO',
          basin: 'AMAZONAS',
          s_date: '2026-03-11',
          e_date: '2026-03-30',
          anomalia: 0.6,
          value: 5.81,
          change: 0.4,
        },
        geometry: {
          type: 'Point',
          coordinates: [-48.4902, -1.4558],
        },
      },
    ],
  },
};

module.exports = {
  DEFAULT_MAP_FEATURE_COLLECTION_ENTRY,
};