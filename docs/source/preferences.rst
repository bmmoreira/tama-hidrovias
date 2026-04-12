User And Map Preferences
========================

Overview
--------

The platform now persists user-scoped dashboard preferences through a
dedicated preferences model instead of attaching implementation-specific fields
directly to the Strapi Users & Permissions plugin user entity.

This design keeps ``/api/users/me`` focused on identity and role resolution,
while a separate current-user preferences route handles mutable interface and
map settings.

Current preference scope includes:

- theme selection
- preferred language for runtime interface localization
- preferred time zone for future date/time formatting work
- default map style
- default map zoom and center coordinates
- favorite stations
- alert preferences and future alert delivery settings

Why A Separate Preference Model
-------------------------------

The project intentionally stores preferences in a custom content type instead
of extending the Strapi plugin user schema.

Reasons:

- reduces coupling to the ``users-permissions`` plugin internals
- keeps authentication identity and product settings as separate concerns
- makes future preference growth easier to manage
- keeps station favorites and alert behavior queryable as first-class data

The Strapi model currently used is:

- ``api::user-preference.user-preference``

Related files:

- ``cms/src/api/user-preference/content-types/user-preference/schema.json``
- ``cms/src/components/preferences/appearance-settings.json``
- ``cms/src/components/preferences/map-settings.json``
- ``cms/src/components/preferences/alert-settings.json``

Data Model
----------

The ``user-preference`` entry has a one-to-one relation with the Strapi plugin
user model:

- ``user`` -> ``plugin::users-permissions.user``

It also stores:

- ``appearance`` component
- ``map`` component
- ``alerts`` component
- ``favoriteStations`` relation to ``api::station.station``

Current appearance fields:

- ``theme``
- ``language``
- ``timeZone``

Current map fields:

- ``mapStyle``
- ``defaultZoom``
- ``centerLatitude``
- ``centerLongitude``

Current alert fields:

- ``enabled``
- ``favoritesOnly``
- ``emailNotifications``
- ``dashboardNotifications``
- ``minimumSeverity``
- ``leadTimeMinutes``
- ``dailyDigest``
- ``stationOfflineAlerts``
- ``forecastThresholdAlerts``

API Pattern
-----------

The implementation keeps role and identity on ``/api/users/me`` and exposes a
separate current-user preferences route:

- Strapi: ``GET /api/users/me/preferences``
- Strapi: ``PUT /api/users/me/preferences``
- Next.js proxy: ``web/src/app/api/users/me/preferences/route.ts``

The browser does not call Strapi directly for authenticated preferences.
Instead, client components call the Next.js proxy route, and the proxy forwards
the request with the server-held Strapi JWT.

Important files:

- ``web/src/app/api/users/me/preferences/route.ts``
- ``web/src/lib/strapi.ts``
- ``web/src/lib/strapi-server.ts``

Authentication Behavior
-----------------------

The preferences route does not rely on browser-held bearer tokens.

Runtime sequence:

1. The user signs in through NextAuth.
2. NextAuth stores the Strapi JWT only in the server-side token.
3. Browser code calls ``/api/users/me/preferences`` on the Next.js app.
4. The Next.js route forwards the request to Strapi with the stored JWT.
5. The Strapi controller validates the bearer token and resolves the current user.

Current Strapi implementation:

- ``cms/src/api/user-preference/controllers/user-preference.js``
- ``cms/src/api/user-preference/routes/custom-user-preference.js``

The controller currently performs explicit bearer-token resolution for the
preferences route. This avoids depending on additional custom permission wiring
for a non-standard ``/users/me/*`` path while still returning a proper ``401``
for unauthenticated requests.

Web Settings Wiring
-------------------

The dashboard preferences page is rendered in:

- ``web/src/app/dashboard/settings/page.tsx``

The main client implementation is:

- ``web/src/components/ThemeSettingsPanel.tsx``

That component currently:

- loads preferences from ``getUserPreferences()``
- hydrates the form from the saved backend payload
- saves updates with ``updateUserPreferences()``
- applies the returned saved theme immediately through ``next-themes``
- applies the saved language through the shared i18next runtime
- emits an in-app update event so the current session reflects the saved theme
  without requiring logout or a fresh login

Global Defaults And Admin Page
------------------------------

Guest-facing defaults are stored separately from per-user preferences in a
dedicated global settings model:

- ``api::app-setting.app-setting``

Related Strapi files:

- ``cms/src/api/app-setting/content-types/app-setting/schema.json``
- ``cms/src/api/app-setting/controllers/app-setting.js``
- ``cms/src/api/app-setting/routes/custom-app-setting.js``
- ``cms/src/components/app/default-appearance.json``
- ``cms/src/components/app/default-map.json``
- ``cms/src/components/app/feature-collection-layer.json``

Current app settings routes:

- Strapi public route: ``GET /api/app-settings/public``
- Strapi admin route: ``GET /api/app-settings/current``
- Strapi admin route: ``PUT /api/app-settings/current``
- Next.js proxy route: ``web/src/app/api/app-settings/route.ts``

The dashboard admin page is rendered in:

- ``web/src/app/dashboard/admin/page.tsx``
- ``web/src/components/AppSettingsPanel.tsx``

That page currently controls:

- default dashboard language for guests and fallback sessions
- guest map base style
- guest map default zoom
- guest map default center latitude and longitude
- global GeoJSON feature collection layer style for ``/mapview``

Current feature collection layer fields:

- ``circleRadius``
- ``positiveColor``
- ``negativeColor``
- ``strokeWidth``
- ``strokeColor``
- ``circleOpacity``

The admin form includes a live preview swatch for these values before save.

Theme Persistence Hook Points
-----------------------------

Theme persistence now has two hook points in the web application:

1. Save-time update in ``web/src/components/ThemeSettingsPanel.tsx``.
2. Session bootstrap sync in ``web/src/app/providers.tsx``.

Save-time behavior:

- the settings panel sends ``PUT /api/users/me/preferences``
- the panel uses the response payload as the new source of truth
- the panel calls ``setTheme(savedTheme)`` immediately
- the panel dispatches a ``user-preferences-updated`` event so the provider can
  react during the same session

Bootstrap behavior:

- ``web/src/app/providers.tsx`` fetches ``/api/users/me/preferences`` after the
  authenticated session becomes available
- the saved theme is applied through ``next-themes``

Operationally, a user should not need to log out and log back in just to see a
saved theme take effect.

Map Defaults Hook Points
------------------------

Map defaults are applied through two main hook points:

- ``web/src/app/map/page.tsx``
- ``web/src/components/MapboxMap.tsx``

Current behavior:

1. The map page loads user preferences with ``getUserPreferences()``.
2. It derives ``flyTarget`` from ``centerLongitude``, ``centerLatitude``, and
   ``defaultZoom``.
3. It derives ``mapStyle`` from the saved preference.
4. It passes both to ``MapboxMap``.
5. The map component flies to the current ``initialViewState`` when that prop
   changes.
6. The map page remounts ``MapboxMap`` when ``mapStyle`` changes by using the
   style as a React ``key``.

The remount-on-style-change behavior is intentional. Mapbox base-style changes
can clear custom layers and sources, so remounting is the simplest way to keep
station overlays consistent with the selected style.

Current implementation files:

- ``web/src/app/map/page.tsx``
- ``web/src/components/MapboxMap.tsx``

When the user is not authenticated, the map page falls back to the global app
settings model instead of per-user preferences. This keeps the public map and
initial landing experience aligned with the admin-defined defaults.

Runtime I18n And SSR Resolution
-------------------------------

Application copy now ships with runtime localization for these languages:

- ``pt-BR``
- ``en``
- ``es``
- ``fr``

The shared translation runtime lives in:

- ``web/src/lib/i18n.ts``
- ``web/src/lib/use-app-translation.ts``
- ``web/src/components/AppI18nProvider.tsx``

Hydration Safety
----------------

The client i18n runtime now avoids language changes during render.

Current implementation details:

- ``web/src/components/AppI18nProvider.tsx`` normalizes the current language in
  render and applies ``i18n.changeLanguage(...)`` only in ``useEffect``
- ``web/src/lib/i18n.ts`` initializes the client runtime from the
  server-rendered ``<html lang>`` attribute when available

This reduces hydration mismatches between the server-rendered HTML and the
first client render on translated pages such as the dashboard admin section.

The initial request language is resolved on the server in:

- ``web/src/lib/server-language.ts``

Current resolution order:

1. Authenticated user preference from ``/api/users/me/preferences`` when a
   valid NextAuth session carries a Strapi JWT.
2. Global default language from ``/api/app-settings/public``.
3. ``pt-BR`` as a final application fallback.

This request-time resolution is used to:

- set the root ``<html lang>`` attribute in ``web/src/app/layout.tsx``
- localize the public landing page on first response
- localize server-rendered loading UI such as ``web/src/app/map/loading.tsx``

Current Limitations
-------------------

- The map preferences currently affect the main map route only.
- Timezone-aware numeric and date formatting is still incomplete across the
  application.
- Alert settings are stored as user intent only. Per-station operational alert
  rules still require a dedicated subscription model if alerting grows beyond
  preference storage.

Recommended Extension Path
--------------------------

For future work, follow this sequence:

1. Keep generic user-scoped settings in ``user-preference``.
2. Introduce a dedicated ``station-subscription`` model only when per-station
   thresholds, channels, or alert history become necessary.
3. Reuse the current Next.js proxy pattern for any additional authenticated
   preference routes.
4. Keep ``/api/users/me`` focused on identity and role only.

Operational Notes
-----------------

- In this workspace, restarting Strapi through Docker Compose is the reliable
  runtime path.
- The direct ``cms`` local CLI path was not reliable because the local package
  install state was incomplete in the checked environment.
- The verified compose workflow is:

  - ``docker compose restart strapi``
  - probe ``http://localhost:1337/api/users/me/preferences``

An unauthenticated probe should return ``401 Unauthorized``.

Related Documentation
---------------------

- ``authentication.rst`` for the session and proxy model
- ``dashboard.rst`` for dashboard UI behavior and role-aware controls
- ``web/README.md`` for frontend-specific implementation notes
- ``cms/README.md`` for Strapi-specific operational notes