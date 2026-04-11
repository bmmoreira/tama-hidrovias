'use strict';

const { sanitize } = require('@strapi/utils');

module.exports = (plugin) => {
  const originalBootstrap = plugin.bootstrap;

  plugin.controllers.user.me = async (ctx) => {
    const authUser = ctx.state.user;

    if (!authUser) {
      return ctx.unauthorized();
    }

    const user = await strapi.entityService.findOne(
      'plugin::users-permissions.user',
      authUser.id,
      {
        populate: {
          role: true,
        },
      }
    );

    const userSchema = strapi.getModel('plugin::users-permissions.user');
    const sanitizedUser = await sanitize.contentAPI.output(user, userSchema, {
      auth: ctx.state.auth,
    });

    ctx.body = user?.role
      ? {
          ...sanitizedUser,
          role: {
            id: user.role.id,
            name: user.role.name,
            type: user.role.type,
            description: user.role.description,
          },
        }
      : sanitizedUser;
  };

  plugin.bootstrap = async ({ strapi }) => {
    if (originalBootstrap) {
      await originalBootstrap({ strapi });
    }

    const roleService = strapi.plugins['users-permissions'].services.role;
    const existingRoles = await roleService.find();
    const existingNames = existingRoles.map((r) => r.type);

    const customRoles = [
      { name: 'Viewer', description: 'Read-only access to hydro data', type: 'viewer' },
      { name: 'Analyst', description: 'Read and write access to hydro data', type: 'analyst' },
    ];

    for (const role of customRoles) {
      if (!existingNames.includes(role.type)) {
        await roleService.createRole(role);
        strapi.log.info(`[users-permissions] Created role: ${role.name}`);
      }
    }
  };

  return plugin;
};
