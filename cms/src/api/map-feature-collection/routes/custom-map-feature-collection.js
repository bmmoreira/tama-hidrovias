'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/map-feature-collections/public',
      handler: 'map-feature-collection.public',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/map-feature-collections/current',
      handler: 'map-feature-collection.current',
      config: {
        auth: false,
      },
    },
    {
      method: 'PUT',
      path: '/map-feature-collections/current',
      handler: 'map-feature-collection.updateCurrent',
      config: {
        auth: false,
      },
    },
  ],
};