MapView GeoJSON Flow
====================

Overview
--------

The ``/mapview`` route now renders a dedicated map implementation that combines:

- guest or user map defaults for the initial viewport and base style
- a GeoJSON ``FeatureCollection`` loaded from Strapi and rendered as a Mapbox
  ``geojson`` source and circle layer
- the shared station explorer overlay used by other map routes

This route still uses its own GeoJSON renderer, but now shares station search
and station detail overlay controls with the public ``/map`` route.

Current Runtime Files
---------------------

Frontend route and component files:

- ``web/src/app/mapview/page.tsx``
- ``web/src/app/mapview/mapview-state.ts``
- ``web/src/components/maps/MapBase.tsx``
- ``web/src/components/maps/StationExplorerOverlay.tsx``
- ``web/src/components/maps/useStationExplorer.ts``
- ``web/src/app/api/map-feature-collections/route.ts``
- ``web/src/lib/strapi.ts``

Strapi files:

- ``cms/src/api/map-feature-collection/content-types/map-feature-collection/schema.json``
- ``cms/src/api/map-feature-collection/content-types/map-feature-collection/lifecycles.js``
- ``cms/src/api/map-feature-collection/controllers/map-feature-collection.js``
- ``cms/src/api/map-feature-collection/routes/custom-map-feature-collection.js``
- ``cms/src/api/map-feature-collection/utils/default-feature-collection.js``

Route And Data Flow
-------------------

The GeoJSON overlay follows the same proxy pattern already used elsewhere in
the web application.

Request flow for the GeoJSON overlay:

1. The browser opens ``/mapview`` on the Next.js app.
2. ``web/src/app/mapview/page.tsx`` uses ``getMapFeatureCollection()`` from
   ``web/src/lib/strapi.ts``.
3. In the browser, that helper calls the internal Next.js route
   ``/api/map-feature-collections``.
4. ``web/src/app/api/map-feature-collections/route.ts`` proxies the request to
   Strapi.
5. Strapi serves ``GET /api/map-feature-collections/public``.
6. The response payload contains one record with ``featureCollection`` holding
   the raw GeoJSON ``FeatureCollection``.
7. ``web/src/app/mapview/page.tsx`` passes that object into
   ``web/src/components/maps/MapBase.tsx``.
8. ``MapBase`` renders it through ``<Source type="geojson" />`` and a circle
   ``<Layer />``.
9. The page mounts ``StationExplorerOverlay`` as a child of ``MapBase`` so the
   shared station search trigger, search panel, and station chart sheet sit on
   top of the GeoJSON map.

Current route list:

- public page route: ``GET /mapview``
- web proxy route: ``GET /api/map-feature-collections``
- Strapi public route: ``GET /api/map-feature-collections/public``

The map page also still loads:

- ``GET /api/stations`` for feature-to-station metadata matching
- ``GET /api/app-settings`` for guest map defaults
- ``GET /api/users/me/preferences`` for authenticated user map defaults

The app settings payload now also carries the persisted visual style used for
the feature collection layer in ``/mapview``.

Current Payload Shape
---------------------

The stored JSON field holds a GeoJSON ``FeatureCollection`` like:

.. code-block:: json

   {
     "type": "FeatureCollection",
     "name": "sv",
     "crs": {
       "type": "name",
       "properties": {
         "name": "urn:ogc:def:crs:OGC:1.3:CRS84"
       }
     },
     "features": [
       {
         "type": "Feature",
         "properties": {
           "name": "R_AMAZONAS-TRIB3_AMAZONAS-TRIB3_KM0100",
           "id": 201162,
           "lat": -0.1126,
           "long": -51.6211,
           "sat": "SWOT-0005",
           "river": "AMAZONAS-TRIB3",
           "basin": "AMAZONAS-TRIB3",
           "s_date": "2026-03-09",
           "e_date": "2026-03-28",
           "anomalia": 0.3,
           "value": 3.49,
           "change": 0.5
         },
         "geometry": {
           "type": "Point",
           "coordinates": [-51.6211, -0.1126]
         }
       }
     ]
   }

The frontend currently expects point features because the popup and the circle
layer both operate on point coordinates.

Strapi Content Type
-------------------

The Strapi collection type is:

- ``api::map-feature-collection.map-feature-collection``

It is configured as a singleton in Strapi, so operators edit one shared entry
instead of managing a list of records.

Current attributes:

- ``name``
- ``geojsonFile``
- ``featureCollection``

Intent of each field:

- ``name`` is the human-readable identifier for the entry
- ``geojsonFile`` is an optional uploaded source file used for import/update
- ``featureCollection`` is the normalized JSON payload served to the web app

Bootstrap And Mock Data
-----------------------

On Strapi bootstrap, the system ensures the single map feature collection entry
exists.

Current bootstrap source:

- ``cms/src/api/map-feature-collection/utils/default-feature-collection.js``
- ``cms/src/index.js``

This makes local development predictable even before an admin uploads a real
GeoJSON file.

How Upload Import Works
-----------------------

The Strapi model now supports two update paths:

1. direct JSON edits in the ``featureCollection`` field
2. file-driven import through the ``geojsonFile`` media field

Lifecycle behavior:

- ``beforeCreate`` validates the JSON payload if ``featureCollection`` is set
- ``beforeUpdate`` validates manual JSON edits
- when a new file is assigned to ``geojsonFile``, Strapi reads that uploaded
  file, parses the JSON, validates it as a GeoJSON ``FeatureCollection``, and
  writes the parsed payload into ``featureCollection`` automatically

Current implementation file:

- ``cms/src/api/map-feature-collection/utils/geojson.js``

Validation currently enforces:

- top-level object payload
- ``type`` must be ``FeatureCollection``
- ``features`` must be an array
- every feature must have ``type: Feature``
- every feature must have an object ``properties`` field
- every feature must have ``Point`` geometry with finite
  ``[longitude, latitude]`` coordinates

How To Upload Or Update GeoJSON In Strapi
-----------------------------------------

Recommended admin workflow:

1. Open the Strapi admin at ``http://localhost:1337/admin``.
2. Open the ``Map Feature Collection`` single type.
3. Edit the singleton entry.
4. Upload a ``.geojson`` or ``.json`` file into ``geojsonFile``.
5. Save the record.
6. Strapi imports the uploaded file into ``featureCollection`` during save.
7. Reload ``/mapview`` to see the updated overlay.

Manual JSON edit workflow:

1. Open the same Strapi entry.
2. Paste or edit the GeoJSON in ``featureCollection`` directly.
3. Save the record.
4. The lifecycle validation rejects invalid GeoJSON before persistence.

Operational notes:

- if the content-type schema or lifecycle code changes, restart Strapi
- content updates through the admin UI do not require a Strapi restart
- the web app fetch helper uses ``cache: no-store``, so a page refresh should
  pick up the latest payload

Current Map Rendering Behavior
------------------------------

``web/src/components/maps/MapBase.tsx`` currently renders three categories of
content:

- the base Mapbox style from guest or user defaults
- optional raster tiles when ``tileLayerUrl`` is provided
- the Strapi-backed GeoJSON overlay as a ``Source`` + circle ``Layer``

``MapBase`` also now accepts overlay children from the route layer. That makes
it possible to keep the GeoJSON renderer focused on map behavior while reusing
the same station explorer controls in multiple map pages.

GeoJSON overlay behavior:

- rendered with a circle layer
- point color is derived from the ``anomalia`` property
- non-negative anomaly uses the admin-configured positive color
- negative anomaly uses the admin-configured negative color
- circle radius, stroke, and opacity are loaded from global app settings
- clicking a GeoJSON point opens a centered standalone detail card instead of
   relying on the native Mapbox popup chrome
- the related Strapi ``Station`` records can now carry an ``externalId`` field
   that matches the GeoJSON feature ``properties.id`` value

Global Layer Style Settings
---------------------------

The feature collection layer style is now persisted in the global app settings
model instead of being hardcoded only in the frontend.

Current Strapi component file:

- ``cms/src/components/app/feature-collection-layer.json``

Current fields:

- ``circleRadius``
- ``positiveColor``
- ``negativeColor``
- ``strokeWidth``
- ``strokeColor``
- ``circleOpacity``

MainMap Component (``MapBase.tsx``)
-----------------------------------

The main map view for both the public ``/map`` route and the ``/mapview``
route is implemented in ``web/src/components/maps/MapBase.tsx``.

This component (exported as ``MainMap``) is responsible for:

- creating and configuring the underlying Mapbox map via ``react-map-gl``
- applying the selected Mapbox style (streets, outdoors, satellite, dark)
- optionally rendering a raster tile overlay (e.g. climate layers)
- rendering the Strapi-backed GeoJSON feature collection as a circle layer
- translating GeoJSON features into rich station popup and details views
- hosting any additional UI overlays passed as React children

Component props
^^^^^^^^^^^^^^^

Public props for ``MainMap``:

- ``initialViewState?: { longitude: number; latitude: number; zoom: number; }``

   - starting camera position for the map
   - defaults to a broad Brazil view (``{ longitude: -52, latitude: -15, zoom: 4 }``)
   - when this value changes, the map animates with ``flyTo`` to the new center

- ``mapStyle?: MapStylePreference``

   - logical base style key coming from user / app preferences
   - mapped internally to Mapbox style URLs via ``MAPBOX_STYLE_URLS``:

      - ``outdoors`` → ``mapbox://styles/mapbox/outdoors-v12``
      - ``streets`` → ``mapbox://styles/mapbox/streets-v12``
      - ``satellite`` → ``mapbox://styles/mapbox/satellite-streets-v12``
      - ``dark`` → ``mapbox://styles/mapbox/dark-v11``

- ``stations?: Station[]``

   - list of Strapi ``Station`` entities fetched via the standard station API
   - used to enrich GeoJSON points with authoritative metadata when possible
   - matching uses ``station.attributes.externalId === feature.properties.id``

- ``featureCollection?: MapFeatureCollection``

   - raw GeoJSON payload coming from Strapi (see section above)
   - rendered as a ``<Source type="geojson" />`` plus a circle ``<Layer />``
   - if omitted, no feature collection overlay is drawn and map is still usable

- ``featureCollectionLayerStyle?: FeatureCollectionLayerSettings``

   - optional override for the global layer style from app settings
   - if not provided, ``DEFAULT_FEATURE_COLLECTION_LAYER_SETTINGS`` is used
   - passed into ``buildFeatureCollectionLayer()`` to create the circle layer

- ``tileLayerUrl?: string``

   - optional URL template for an additional raster tile overlay
   - when present, ``MainMap`` creates a raster ``Source`` + ``Layer`` with
      partial transparency (``raster-opacity: 0.7``) on top of the base style

- ``onStationDoubleClick?: (station: Station) => void``

   - reserved handler for higher-level interactions when stations are
      double‑clicked (currently unused in the default behavior)

- ``children?: ReactNode``

   - any React elements to render above the map (e.g. ``StationExplorerOverlay``)
   - positioned using absolute layout so they appear as floating UI panels

Mapbox configuration
^^^^^^^^^^^^^^^^^^^^^

``MainMap`` is built on ``react-map-gl``'s ``<Map />`` component:

- reads the Mapbox access token from ``process.env.NEXT_PUBLIC_MAPBOX_TOKEN``
   (must be set in ``web/.env`` and is wired into the Docker config)
- sets ``attributionControl`` to show Mapbox / data attributions
- wires ``interactiveLayerIds`` so clicks only target the feature collection
   layer when GeoJSON is present (``FEATURE_COLLECTION_LAYER_ID``)
- uses ``NavigationControl`` and ``ScaleControl`` for standard map controls

The component enables map reuse with ``reuseMaps`` to improve performance
across page transitions in the Next.js app.

Feature and station matching
^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Several helper functions inside ``MapBase.tsx`` control how a clicked map
feature turns into UI state:

- ``parseFiniteNumber(value)`` and ``parseString(value)``

   - small type guards used to safely coerce arbitrary JSON values from
      ``feature.properties`` or station metadata into ``number`` / ``string``

- ``parseFeatureExternalId(feature)``

   - extracts a numeric ``id`` from ``feature.properties.id`` when present
   - returns ``undefined`` if the property is missing or not a finite number

- ``findMatchingStation(stations, feature)``

   - looks for a ``Station`` whose ``attributes.externalId`` matches the
      feature's external id
   - returns ``null`` when there is no match

- ``getStationMetadata(station)``

   - normalizes ``station.attributes.metadata`` into a plain object for safe
      lookups (ignores non-object or array values)

- ``toPopupFeature(feature)``

   - converts a raw GeoJSON ``Feature`` into a lightweight ``PopupFeature``
      structure containing:

      - coordinates (``longitude``, ``latitude``)
      - basic labels (``name``, ``river``, ``basin``)
      - temporal fields (``startDate``, ``endDate``)
      - numeric indicators (``value``, ``change``, ``anomaly``)

   - validates that geometry is a point with finite coordinates
   - falls back to default values such as ``"Feature"`` when names are missing

- ``buildPopupFeatureFromStation(station, feature)``

   - merges the GeoJSON properties and station metadata into a single
      ``PopupFeature`` used by the UI
   - station attributes take precedence for canonical fields like ``code``,
      ``source``, ``river``, and ``basin``
   - fills gaps using station metadata (e.g. ``metadata.satellite``) when the
      raw GeoJSON data is incomplete

Click handling and UI overlays
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

When a user clicks the map:

1. ``handleFeatureClick`` receives a ``MapLayerMouseEvent``.
2. The handler filters ``event.features`` to only consider those from
    ``FEATURE_COLLECTION_LAYER_ID``.
3. If a feature is found, ``findMatchingStation`` is used to locate a
    corresponding station; if one exists, ``buildPopupFeatureFromStation`` is
    used, otherwise ``toPopupFeature`` is used directly.
4. The resulting ``PopupFeature`` is stored in ``popupFeature`` state and
    rendered as a centered ``StationPopup`` overlay, dimming the map behind it.
5. When the user chooses to view details, ``detailFeature`` is set and a
    ``StationDetailsModal`` is opened while the popup is cleared.

This design keeps the map interactions focused on a single, consistent overlay
experience for the general public, while still allowing route-level components
to inject additional tools (filters, legends, station explorer, etc.) via
``children``.

Runtime flow:

1. the admin page saves global settings through ``PUT /api/app-settings/current``
2. the Next.js proxy exposes those settings through ``/api/app-settings``
3. ``web/src/app/mapview/page.tsx`` loads the app settings payload
4. ``web/src/components/maps/MapBase.tsx`` builds the GeoJSON ``Layer`` from
   ``featureCollectionLayer`` instead of fixed paint values

Admin Page Customization
------------------------

The dashboard admin page now exposes feature collection layer controls in the
same panel used for other guest map defaults.

Current admin files:

- ``web/src/app/dashboard/admin/page.tsx``
- ``web/src/components/AppSettingsPanel.tsx``

Available controls:

- circle radius
- circle opacity
- positive anomaly color
- negative anomaly color
- stroke width
- stroke color

The admin form includes a small live preview swatch so operators can review
the current layer style before saving.

Current popup fields are derived from feature properties:

- ``name``
- ``sat`` or ``satellite``
- ``river``
- ``basin``
- ``value``
- ``change``
- ``anomalia``
- ``s_date``
- ``e_date``

Popup Presentation And Theme Behavior
-------------------------------------

The feature detail UI is now rendered through a dedicated frontend component
instead of inline JSX inside the map layer handler.

Current frontend files:

- ``web/src/components/maps/StationPopup.tsx``
- ``web/src/components/maps/MapBase.tsx``

Current runtime behavior:

- the feature click still starts from the GeoJSON layer in ``MapBase.tsx``
- the clicked feature is normalized into a typed popup payload
- station records are used only to enrich the feature popup and detail modal
   with base metadata such as code, source, river, basin, and coordinates
- ``StationPopup.tsx`` renders that payload as a standalone centered card
- the overlay uses a translucent light backdrop in light theme
- the overlay uses a darker slate backdrop in dark theme
- all popup labels and button text are resolved through runtime i18n
- the action row currently exposes mock buttons for future detail and favorite
   flows plus a working close action
- ``StationExplorerOverlay.tsx`` provides the reusable station search button,
   left/bottom search panel, station chart sheet, and optional legend
- ``useStationExplorer.ts`` centralizes the selection, open/close, and active
   variable state so ``/map`` and ``/mapview`` reuse the same controller logic

Station Matching And Bootstrap Seeding
--------------------------------------

The Strapi ``Station`` collection type now includes an optional ``externalId``
field used to match a station record to a GeoJSON feature coming from the
single-type ``Map Feature Collection`` entry.

Current matching contract:

- ``Station.externalId``
- ``Map Feature Collection.featureCollection.features[*].properties.id``

Bootstrap behavior now uses that contract to keep local development data in
sync:

1. Strapi ensures the single ``Map Feature Collection`` exists.
2. If the default mock dataset is needed, it now generates 128 point features.
3. Bootstrap derives one mock ``Station`` record per feature.
4. Each generated station receives:

    - ``externalId`` from the GeoJSON feature id
    - ``code`` in ``MF-<externalId>`` format
    - ``source = Virtual``
    - latitude/longitude from feature geometry
    - basin/river plus supporting metadata copied from the feature payload

Operational note:

- restart Strapi after changing the schema or bootstrap logic so the station
   sync runs and the mock records are inserted or refreshed
- the web client now requests up to 500 stations by default so the larger mock
   station set is not truncated by Strapi pagination

How To Extend The Feature Payload
---------------------------------

If the GeoJSON needs to carry more fields, the current system is intentionally
flexible because ``featureCollection`` is stored as JSON.

Safe extension path:

1. Add the new property to the GeoJSON producer or uploaded file.
2. Keep the payload valid GeoJSON.
3. Update the popup extraction logic in ``MapBase.tsx`` if the UI should render
   the new field.
4. Update ``StationPopup.tsx`` if the standalone card should display that new
   property or action.
5. Update layer paint rules if styling should depend on the new property.

How To Develop Further
----------------------

Recommended next steps if this mapview flow continues to grow:

1. Add component-level tests for ``MapBase.tsx`` with mocked ``react-map-gl``
   so popup behavior and feature click handling are covered.
2. Add Strapi-side tests or script-based probes for invalid GeoJSON uploads and
   malformed features.
3. Support non-point geometries if line or polygon overlays become necessary.
4. Add versioning or timestamps to the map feature collection model if the
   source data is refreshed operationally.
5. Add admin-facing guidance in Strapi content descriptions so operators know
   the required file format before upload.
6. If multiple overlay datasets are needed, introduce either:

   - one collection entry per named dataset, or
   - a separate relation/model for map overlay metadata and activation rules

7. If the payload becomes large, move from a single-record fetch model to a
   tiled or filtered API strategy.

Development Checklist
---------------------

When changing this feature, use this sequence:

1. update the Strapi schema, lifecycle, or controller if the payload contract changes
2. restart Strapi if code or schema changed
3. probe ``/api/map-feature-collections/public`` directly
4. probe the Next proxy ``/api/map-feature-collections``
5. reload ``/mapview``
6. verify popup behavior and layer styling in the browser

Related Documentation
---------------------

- ``api.rst`` for the wider route inventory
- ``preferences.rst`` for guest and user map default loading
- ``usage.rst`` for local and Docker development commands
- ``web/README.md`` for frontend implementation notes
- ``cms/README.md`` for Strapi operational notes