'use strict';

module.exports = (plugin) => {
  const originalBootstrap = plugin.bootstrap;

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
