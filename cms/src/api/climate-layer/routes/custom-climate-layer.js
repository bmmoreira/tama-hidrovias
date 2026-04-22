'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/climate-layers/current/list',
      handler: 'climate-layer.current',
      config: {
        auth: false,
      },
    },
  ],
};