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
  ],
};