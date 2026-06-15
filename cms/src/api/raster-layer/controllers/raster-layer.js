'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

const RASTER_LAYER_UID = 'api::raster-layer.raster-layer';
const ALLOWED_READER_ROLES = new Set([
	'admin',
	'analyst',
	'viewer',
	'super-admin',
]);
const ALLOWED_WRITER_ROLES = new Set(['admin', 'analyst', 'super-admin']);
const REQUIRED_SYNC_FIELDS = [
	'layer_id',
	'display_name',
	'file_url',
	'area_name',
	'hydrology_variable',
	'computed_min',
	'computed_max',
	'bounds',
];

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

function serializeRasterLayer(entry) {
	return {
		id: entry.id,
		attributes: {
			layer_id: entry.layer_id,
			display_name: entry.display_name,
			file_url: entry.file_url,
			area_name: entry.area_name,
			hydrology_variable: entry.hydrology_variable,
			acquisition_date: entry.acquisition_date ?? null,
			acquisition_time: entry.acquisition_time ?? null,
			file_projection: entry.file_projection ?? null,
			computed_min: entry.computed_min ?? null,
			computed_max: entry.computed_max ?? null,
			colormap_name: entry.colormap_name ?? null,
			bounds: entry.bounds ?? null,
			crs: entry.crs ?? null,
			dtype: entry.dtype ?? null,
			nodata_value: entry.nodata_value ?? null,
			width: entry.width ?? null,
			height: entry.height ?? null,
			band_count: entry.band_count ?? null,
		},
	};
}

module.exports = createCoreController(RASTER_LAYER_UID, () => ({
	async list(ctx) {
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

		const entries = await strapi.entityService.findMany(RASTER_LAYER_UID, {
			publicationState: 'preview',
			sort: {
				display_name: 'asc',
			},
		});

		ctx.body = {
			data: entries.map(serializeRasterLayer),
		};
	},

	async sync(ctx) {
		const authUser = await getAuthenticatedUserFromRequest(ctx);

		if (!authUser) {
			return ctx.unauthorized('Authentication required.');
		}

		const normalizedRole = normalizeRole(
			authUser.role?.name ?? authUser.role?.type,
		);

		if (!ALLOWED_WRITER_ROLES.has(normalizedRole)) {
			return ctx.forbidden('Management access required.');
		}

		const body = ctx.request.body ?? {};
		const missingField = REQUIRED_SYNC_FIELDS.find(
			(field) => body[field] === undefined || body[field] === null,
		);

		if (missingField) {
			return ctx.badRequest(`Missing required field: ${missingField}`);
		}

		const data = {
			layer_id: body.layer_id,
			display_name: body.display_name,
			file_url: body.file_url,
			area_name: body.area_name,
			hydrology_variable: body.hydrology_variable,
			acquisition_date: body.acquisition_date ?? null,
			acquisition_time: body.acquisition_time ?? null,
			file_projection: body.file_projection ?? null,
			computed_min: body.computed_min,
			computed_max: body.computed_max,
			colormap_name: body.colormap_name ?? 'viridis',
			bounds: body.bounds,
			crs: body.crs ?? null,
			dtype: body.dtype ?? null,
			nodata_value: body.nodata_value ?? null,
			width: body.width ?? null,
			height: body.height ?? null,
			band_count: body.band_count ?? null,
			publishedAt: new Date().toISOString(),
		};

		const existing = await strapi.entityService.findMany(RASTER_LAYER_UID, {
			filters: { layer_id: data.layer_id },
			publicationState: 'preview',
			limit: 1,
		});

		const entry = existing?.[0]
			? await strapi.entityService.update(RASTER_LAYER_UID, existing[0].id, {
					data,
				})
			: await strapi.entityService.create(RASTER_LAYER_UID, { data });

		ctx.body = {
			data: serializeRasterLayer(entry),
		};
	},
}));
