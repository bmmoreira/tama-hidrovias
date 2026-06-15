'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/raster-layers/current/list',
      handler: 'raster-layer.list',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/raster-layers/sync',
      handler: 'raster-layer.sync',
      config: {
        auth: false,
      },
    },
  ],
};
