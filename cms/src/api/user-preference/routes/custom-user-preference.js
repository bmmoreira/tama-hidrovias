'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/users/me/preferences',
      handler: 'user-preference.me',
      config: {
        auth: false,
      },
    },
    {
      method: 'PUT',
      path: '/users/me/preferences',
      handler: 'user-preference.updateMe',
      config: {
        auth: false,
      },
    },
  ],
};