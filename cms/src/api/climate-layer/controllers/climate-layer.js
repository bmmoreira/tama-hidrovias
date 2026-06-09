'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

const CLIMATE_LAYER_UID = 'api::climate-layer.climate-layer';
const ALLOWED_READER_ROLES = new Set([
	'admin',
	'analyst',
	'viewer',
	'super-admin',
]);

function normalizeRole(value) {
	return value
		?.trim()
		.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
		.replace(/[^a-zA-Z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.toLowerCase();
}

async function getAuthenticatedUserFromRequest(ctx) {
	const authorization = ctx.request.header.authorization ?? '';

	if (!authorization.startsWith('Bearer ')) {
		return null;
	}

	const token = authorization.slice('Bearer '.length).trim();

	if (!token) {
		return null;
	}

	try {
		const payload = await strapi
			.plugin('users-permissions')
			.service('jwt')
			.verify(token);

		if (!payload?.id) {
			return null;
		}

		return strapi.entityService.findOne(
			'plugin::users-permissions.user',
			payload.id,
			{
				populate: {
					role: true,
				},
			},
		);
	} catch (error) {
		return null;
	}
}

function serializeClimateLayer(entry) {
	return {
		id: entry.id,
		attributes: {
			title: entry.title,
			variable: entry.variable,
			model: entry.model ?? null,
			period_start: entry.period_start ?? null,
			period_end: entry.period_end ?? null,
			colormap: entry.colormap ?? null,
			min_value: entry.min_value ?? null,
			max_value: entry.max_value ?? null,
			geotiff: entry.geotiff
				? {
						data: {
							id: entry.geotiff.id,
							attributes: {
								name: entry.geotiff.name,
								url: entry.geotiff.url,
							},
						},
					}
				: {
						data: null,
					},
		},
	};
}

module.exports = createCoreController(CLIMATE_LAYER_UID, () => ({
	async current(ctx) {
		const authUser = await getAuthenticatedUserFromRequest(ctx);

		if (!authUser) {
			return ctx.unauthorized('Authentication required.');
		}

		const normalizedRole = normalizeRole(
			authUser.role?.name ?? authUser.role?.type,
		);

		if (!ALLOWED_READER_ROLES.has(normalizedRole)) {
			return ctx.forbidden('Dashboard access required.');
		}

		const entries = await strapi.entityService.findMany(CLIMATE_LAYER_UID, {
			publicationState: 'preview',
			sort: {
				period_start: 'desc',
			},
			populate: {
				geotiff: {
					fields: ['name', 'url'],
				},
			},
		});

		ctx.body = {
			data: entries.map(serializeClimateLayer),
		};
	},
}));
