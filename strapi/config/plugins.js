'use strict';

module.exports = ({ env }) => ({
  'plugin::i18n': {
    enabled: true,
    config: {
      defaultLocale: 'en',
    },
  },
  'plugin::users-permissions': {
    enabled: true,
    config: {
      jwtSecret: env('JWT_SECRET'),
    },
  },
});
