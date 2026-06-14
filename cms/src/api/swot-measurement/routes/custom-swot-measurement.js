'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/swot-measurements/public',
      handler: 'swot-measurement.public',
      config: {
        auth: false,
      },
    },
  ],
};
