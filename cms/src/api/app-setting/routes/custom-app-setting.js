'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/app-settings/public',
      handler: 'app-setting.public',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/app-settings/current',
      handler: 'app-setting.current',
      config: {
        auth: false,
      },
    },
    {
      method: 'PUT',
      path: '/app-settings/current',
      handler: 'app-setting.updateCurrent',
      config: {
        auth: false,
      },
    },
  ],
};