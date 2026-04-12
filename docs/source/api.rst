API
===

The platform is composed of five primary services:

- ``web`` exposes the user-facing web interface and map views.
- ``cms`` stores domain entities such as stations, measurements,
  forecasts, and climate layers.
- ``pipeline`` contains collectors, processing steps, evaluation code,
  and automation for the hydrology pipeline.
- ``pgadmin`` provides a browser-based PostgreSQL administration interface.
- ``tileserver`` serves generated GeoTIFF assets as map tiles.

Current Authenticated Preference Endpoint
-----------------------------------------

In addition to the domain collections for stations, measurements, forecasts,
and climate layers, the platform now exposes a current-user preferences route.

Runtime shape:

- Strapi route: ``/api/users/me/preferences``
- Next.js proxy route: ``web/src/app/api/users/me/preferences/route.ts``

This route is used for user-scoped appearance, map, favorites, and alert
preferences. It is documented in more detail in ``preferences.rst``.

Current Global App Settings Endpoints
-------------------------------------

The platform also exposes a global app settings model for guest-facing
dashboard and map defaults.

Runtime shape:

- Strapi public route: ``/api/app-settings/public``
- Strapi admin routes: ``/api/app-settings/current``
- Next.js proxy route: ``web/src/app/api/app-settings/route.ts``

This route family is used for the default dashboard language and public map
fallback state. It is documented in more detail in ``preferences.rst``.

Current Map Feature Collection Endpoints
----------------------------------------

The ``/mapview`` route now consumes a Strapi-backed GeoJSON overlay through a
dedicated public endpoint and a matching Next.js proxy.

Runtime shape:

- Strapi public route: ``/api/map-feature-collections/public``
- Next.js proxy route: ``web/src/app/api/map-feature-collections/route.ts``
- Web page route: ``/mapview``

This route family is used to deliver a GeoJSON ``FeatureCollection`` stored in
Strapi and rendered by ``web/src/components/maps/MapBase.tsx``. It is
documented in more detail in ``mapview.rst``.

Python package layout
---------------------

The Python service is organized under ``pipeline/tama_hidrovias``:

- ``automation`` for scheduled and manual pipeline execution
- ``data_collection`` for upstream source collectors
- ``climate_models`` for forecast and reanalysis downloaders
- ``processing`` for basin and standardization workflows
- ``bias_correction`` for adjustment methods
- ``evaluation`` for metrics
- ``database`` for Strapi integration
