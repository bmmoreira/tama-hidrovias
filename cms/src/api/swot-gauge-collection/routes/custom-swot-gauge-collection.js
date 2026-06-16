'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/swot-gauge-collections/public',
      handler: 'swot-gauge-collection.public',
      config: {
        auth: false,
      },
    },
  ],
};
