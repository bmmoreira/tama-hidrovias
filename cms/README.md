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

## Related documentation

- Root overview: `../README.rst`
- Architecture/auth docs: `../docs/source/authentication.rst`
- Dashboard customization notes: `../docs/source/dashboard.rst`
- Preferences and map defaults: `../docs/source/preferences.rst`
