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
