'use strict';

module.exports = ({ env }) => ({
  i18n: {
    enabled: true,
    config: {
      defaultLocale: 'en',
    },
  },
  'users-permissions': {
    enabled: true,
    config: {
      jwtSecret: env('JWT_SECRET'),
    },
  },
});
