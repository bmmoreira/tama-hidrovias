API
===

The platform is composed of five primary services:

- ``web`` exposes the user-facing web interface and map views.
- ``cms`` stores domain entities such as stations, measurements,
  forecasts, and climate layers.
- ``pipeline`` contains collectors, processing steps, evaluation code,
  and automation for the hydrology pipeline.
- ``pgadmin`` provides a browser-based PostgreSQL administration interface.
- ``titiler`` serves generated GeoTIFF assets as dynamic map tiles.

TypeScript frontend API docs
----------------------------

The Next.js frontend in ``web/`` exposes a set of typed utilities, hooks and
components for working with stations, forecasts, climate layers and map
visualisation.

These are documented using `TypeDoc <https://typedoc.org/>`_ and generated
from the TSDoc comments in ``web/src``. To regenerate the HTML API
documentation locally, run from the ``web/`` folder::

    npm install
    npm run docs:typedoc

The generated files are written to::

    web/typedoc/

and can be opened directly in a browser (for example, by opening
``web/typedoc/index.html``). The Sphinx documentation intentionally does not
duplicate that low-level API reference; instead it links to the TypeDoc output
and focuses on higher-level flows and behaviour.

When the documentation site is published via GitHub Pages, the same TypeDoc
output is served under ``/typedoc/``. You can use a relative link such as
``/typedoc/index.html`` from the rendered HTML pages to open the TypeScript
API reference alongside the Sphinx content.

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
dedicated public endpoint and a matching Next.js proxy. The dashboard now also
exposes a protected editor flow for that same single collection.

Runtime shape:

- Strapi public route: ``/api/map-feature-collections/public``
- Strapi protected current routes: ``/api/map-feature-collections/current``
- Next.js proxy route: ``web/src/app/api/map-feature-collections/route.ts``
- Web page route: ``/mapview``
- Dashboard editor route: ``/dashboard/map-features``

This route family is used to deliver a GeoJSON ``FeatureCollection`` stored in
Strapi and rendered by ``web/src/components/maps/MapBase.tsx``. It is
documented in more detail in ``mapview.rst`` and ``dashboard.rst``.

The protected editor flow persists the entire single-type payload instead of
issuing per-feature mutations. The dashboard reads the current
``featureCollection``, lets the user add, edit, or remove GeoJSON Point
features in memory, and then sends the updated collection back through the
internal ``PUT /api/map-feature-collections`` route.

Current Forecast Overlay Endpoints
----------------------------------

The public ``/map`` route now exposes forecast GeoTIFF overlays through a
small internal Next.js API surface backed by TiTiler.

Runtime shape:

- Next.js list route: ``GET /api/forecast-tiles``
- Next.js metadata route: ``GET /api/forecast-tiles/:slug/metadata``
- Next.js tile route: ``GET /api/forecast-tiles/:slug/:z/:x/:y.png``
- TiTiler upstream routes: ``/cog/info``, ``/cog/statistics`` and
    ``/cog/tiles/WebMercatorQuad/...``
- Web page route: ``/map``

This route family reads forecast GeoTIFF files from the shared
``assets/tiles`` volume, groups them by forecast area, and returns frame
metadata used by the public forecast drawer. The tile endpoint keeps the
browser on same-origin ``/api`` URLs while TiTiler performs the raster
rendering and color scaling.

The current payload contract is split into three concerns:

- ``/api/forecast-tiles`` lists available forecast groups and frame URL
    templates for the drawer UI
- ``/api/forecast-tiles/:slug/metadata`` exposes bounds and value statistics
    so the UI can propose a useful render range
- ``/api/forecast-tiles/:slug/:z/:x/:y.png`` proxies the rendered PNG tile and
    returns ``204`` for out-of-bounds requests instead of surfacing noisy tile
    errors in the browser console

This flow is documented in more detail in ``public-map.rst``.

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
