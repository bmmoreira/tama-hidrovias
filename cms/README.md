# tama-hidrovias Strapi CMS

Strapi v4 headless CMS for the tama-hidrovias hydrology platform.

- **Port:** 1337
- **Purpose:** Serves the hydro data API (stations, measurements, forecasts, climate layers)

## Quick start

```bash
cp .env.example .env   # edit secrets before use
npm install
npm run develop        # development (SQLite)
npm run start          # production (PostgreSQL)
```

## Custom project behavior

This project uses a custom Strapi extension in `src/extensions/users-permissions/strapi-server.js`.

### Bootstrapped application roles

The extension guarantees the existence of these **Users & Permissions** roles:

- `viewer`: read-only dashboard access
- `analyst`: dashboard write access for approved operational flows

The default Strapi `authenticated` role still exists, but the web application
uses it only as a conservative fallback. Operational permissions should be
granted to `viewer` and `analyst` explicitly.

### Custom `users/me` behavior

The default Strapi `GET /api/users/me` response does not always return the role
relation in a way that is reliable for the Next.js session bootstrap. For that
reason, this project overrides the controller and returns a sanitized user
payload with a safe `role` object containing:

- `id`
- `name`
- `type`
- `description`

This response is consumed by the web application after `POST /api/auth/local`
so NextAuth can persist the correct role in `session.user.role`.

### Operational note

Whenever `src/extensions/users-permissions/strapi-server.js` changes, restart
Strapi so the plugin extension is reloaded.

## Role and permission model

Recommended meaning of each application role:

- `authenticated`: fallback role only; avoid dashboard write permissions here
- `viewer`: read-only access to dashboard data and navigation
- `analyst`: read and write access for approved features such as virtual station creation

Strapi remains the source of truth for:

- user accounts
- role assignment
- endpoint permissions in Users & Permissions

Any new protected feature must be implemented in two places:

1. Strapi permission configuration for the target role.
2. Matching UI and API enforcement in the Next.js application.

## Repeatable dev auth bootstrap

For local and Docker-based development, the CMS now includes an idempotent
bootstrap script for known analyst and viewer accounts.

Run it locally inside `cms/`:

```bash
npm run bootstrap:dev-users
```

Run it against the Docker dev stack:

```bash
docker compose -f ../docker-compose.yml -f ../docker-compose.dev.yml exec strapi npm run bootstrap:dev-users
```

Default credentials in Docker dev mode:

- analyst: `dev.analyst@local.test` / `devpass123` / `analyst`
- viewer: `dev.viewer@local.test` / `devviewer123` / `viewer`

Expected behavior of each development user:

- `analyst`: can access `/dashboard/admin` and exercise approved write flows
- `viewer`: can access the dashboard in read-only mode and is redirected away from `/dashboard/admin`

The script updates the same users if they already exist, so it is safe to rerun.
You can override the defaults with these environment variables:

- `DEV_BOOTSTRAP_ANALYST_EMAIL`
- `DEV_BOOTSTRAP_ANALYST_PASSWORD`
- `DEV_BOOTSTRAP_ANALYST_USERNAME`
- `DEV_BOOTSTRAP_ANALYST_ROLE`
- `DEV_BOOTSTRAP_VIEWER_EMAIL`
- `DEV_BOOTSTRAP_VIEWER_PASSWORD`
- `DEV_BOOTSTRAP_VIEWER_USERNAME`
- `DEV_BOOTSTRAP_VIEWER_ROLE`

## User preferences model

User-scoped interface and map settings are stored outside the plugin user model
in a dedicated content type:

- `src/api/user-preference/content-types/user-preference/schema.json`

Supporting components:

- `src/components/preferences/appearance-settings.json`
- `src/components/preferences/map-settings.json`
- `src/components/preferences/alert-settings.json`

Current-user preferences routes:

- `GET /api/users/me/preferences`
- `PUT /api/users/me/preferences`

Implementation files:

- `src/api/user-preference/controllers/user-preference.js`
- `src/api/user-preference/routes/custom-user-preference.js`

This design intentionally keeps `GET /api/users/me` focused on identity and
role resolution, while mutable dashboard settings are handled by a separate
route and model.

Operationally, if any file under `src/api/user-preference/` or
`src/components/preferences/` changes, restart the Strapi service so the schema
and route definitions are reloaded.

## Global app settings model

Guest-facing dashboard and map defaults are stored in a separate app settings
content type:

- `src/api/app-setting/content-types/app-setting/schema.json`

Supporting components:

- `src/components/app/default-appearance.json`
- `src/components/app/default-map.json`
- `src/components/app/feature-collection-layer.json`

Routes:

- `GET /api/app-settings/public`
- `GET /api/app-settings/current`
- `PUT /api/app-settings/current`

Implementation files:

- `src/api/app-setting/controllers/app-setting.js`
- `src/api/app-setting/routes/custom-app-setting.js`

This model is used by the web dashboard admin page to define the guest default
language and public map view while keeping per-user preferences independent.

It now also stores the global `featureCollectionLayer` component used by the
`/mapview` GeoJSON overlay.

Current feature collection layer fields:

- `circleRadius`
- `positiveColor`
- `negativeColor`
- `strokeWidth`
- `strokeColor`
- `circleOpacity`

## Map Feature Collection model

The CMS now includes a dedicated single type for GeoJSON overlays used by
the web `mapview` route.

Content type:

- `src/api/map-feature-collection/content-types/map-feature-collection/schema.json`

Current fields:

- `name`
- `geojsonFile`
- `featureCollection`

Routes:

- `GET /api/map-feature-collections/public`

Implementation files:

- `src/api/map-feature-collection/controllers/map-feature-collection.js`
- `src/api/map-feature-collection/routes/custom-map-feature-collection.js`
- `src/api/map-feature-collection/content-types/map-feature-collection/lifecycles.js`
- `src/api/map-feature-collection/utils/geojson.js`

Operational behavior:

- bootstrap ensures one default mock record exists for local development
- bootstrap also ensures mock ``Station`` entries exist for the feature set by
	matching ``Station.externalId`` to GeoJSON ``properties.id``
- admins can upload a `.geojson` or `.json` file into `geojsonFile`
- on save, the lifecycle imports and validates the uploaded file into `featureCollection`
- admins can also edit `featureCollection` directly as raw JSON
- lifecycle validation rejects payloads that are not valid GeoJSON `FeatureCollection` objects with point features

Station matching details:

- `src/api/station/content-types/station/schema.json` now includes `externalId`
- bootstrap derives mock stations from the single `Map Feature Collection`
- the default mock dataset now generates 128 point features and 128 matching mock stations
- generated station codes use the format `MF-<externalId>`
- generated stations are published immediately so the public `/api/stations` feed can return them

Recommended workflow:

1. open Strapi admin
2. open the `Map Feature Collection` single type
3. upload a new `geojsonFile` or paste JSON into `featureCollection`
4. save the entry
5. refresh `/mapview` in the web app

If any file under `src/api/map-feature-collection/` changes, restart Strapi so
the new schema, routes, or lifecycles are loaded.

If the station schema or the bootstrap sync changes, restart Strapi as well so
the station collection can be repopulated from the current feature payload.

## Related documentation

- Root overview: `../README.rst`
- Architecture/auth docs: `../docs/source/authentication.rst`
- Dashboard customization notes: `../docs/source/dashboard.rst`
- Preferences and map defaults: `../docs/source/preferences.rst`
- MapView GeoJSON flow: `../docs/source/mapview.rst`
