Map Layers Drawer (Rivers, Basins, Spatial Filter)
===================================================

Quick Summary
-------------

High-level data flow for the "Camadas" (layers) drawer on the public ``/map``
route:

1. Static GeoJSON files ``public/geojson/rivers.geojson`` and
   ``public/geojson/subbacias.geojson`` are fetched client-side with SWR.
2. ``web/src/components/maps/LayersDrawer.tsx`` lets visitors toggle the
   rivers layer and the sub-basins layer on/off, and pick individual
   features within each.
3. ``web/src/components/maps/useMockRainHeatmap.ts`` injects a deterministic
   mock rainfall value (mm) onto every basin feature, used to color a
   choropleth fill while a real rainfall data source is not yet wired up.
4. ``web/src/components/MapboxMap.tsx`` renders the selected rivers as a line
   layer and the selected basins as a fill + border layer, with hover
   highlighting and click popups.
5. ``web/src/components/maps/SwotFilterDrawer.tsx`` (the "Filtros" drawer for
   SWOT gauge stations) can restrict the visible stations to those near the
   currently visible rivers, or inside the currently visible basins, reusing
   the exact feature set selected in the Camadas drawer.

Overview
--------

The public map already rendered SWOT gauge stations and a forecast raster
overlay. This feature adds a third, independent drawer focused on the
underlying hydrographic reference layers:

- **Rivers** -- 22 major South American rivers (``rivers.geojson``,
  ``NAME`` property), rendered as blue lines.
- **Sub-basins** -- 76 Brazilian ANA sub-basins (``subbacias.geojson``,
  ``DNS_NM`` name / ``id`` unique key), rendered as a filled choropleth with
  a mock rainfall value per basin.

Both layers default to "select all" once their GeoJSON has loaded; basins
default to **hidden** (``basinsVisible: false``) so the map is not covered by
a large translucent fill on first load, while rivers default to **visible**.

Current Runtime Files
----------------------

Frontend files:

- ``web/src/app/map/page.tsx``
- ``web/src/components/maps/LayersDrawer.tsx``
- ``web/src/components/maps/useMockRainHeatmap.ts``
- ``web/src/components/maps/spatialFilter.ts``
- ``web/src/components/maps/SwotFilterDrawer.tsx``
- ``web/src/components/MapboxMap.tsx``

Static data:

- ``web/public/geojson/rivers.geojson``
- ``web/public/geojson/subbacias.geojson``

These files were moved out of ``web/src/components/maps/`` into
``web/public/geojson/`` so they are served as plain static assets and fetched
at runtime, instead of being bundled into the JS payload (they are ~220KB and
~830KB respectively).

LayersDrawer ("Camadas")
------------------------

``LayersDrawer.tsx`` is modeled directly on ``SwotFilterDrawer.tsx``: a
floating toggle button plus a mobile bottom-sheet / desktop side-panel drawer.

State shape (``LayersFilter``):

.. code-block:: ts

   interface LayersFilter {
     riversVisible: boolean;
     selectedRivers: string[];   // river NAME values
     basinsVisible: boolean;
     selectedBasins: number[];   // basin id values
   }

Key exports:

- ``DEFAULT_LAYERS_FILTER`` -- placeholder state before GeoJSON has loaded.
- ``buildDefaultLayersFilter(riverFeatures, basinFeatures)`` -- seeds
  ``selectedRivers`` / ``selectedBasins`` with every feature once both
  GeoJSON files have arrived.
- ``filterRiverFeatures(features, filter)`` / ``filterBasinFeatures(features, filter)``
  -- apply the on/off switch and selection to the raw feature list.

UI behavior:

- A master on/off switch per layer.
- "Todos/Nenhum" (rivers) and "Todas/Nenhuma" (basins) quick-select actions.
- A search box to filter the checkbox list by name (22 rivers, 76 basins).
- A gradient legend for the mock rainfall choropleth, shown whenever the
  basins layer is on.
- On desktop, the panel anchors to ``right-0`` and shifts left via
  ``translate-x`` (not by moving the anchor) whenever the Forecast
  ("Medições") drawer is open, so the two side panels sit next to each other
  without overlapping.

Positioning is intentionally decoupled from the anchor: the *closed* state
always uses ``translate-x-full`` from a constant ``right-0`` baseline, and
only the *open* state additionally translates left when the forecast drawer
is open. Coupling the hide/show translate to a variable anchor previously
caused the "closed" panel to render on top of the forecast drawer instead of
off-screen (see Known Issues Fixed below).

Mock Rain Heatmap
-----------------

``useMockRainHeatmap(basinFeatures)`` is a placeholder for a future real
rainfall-by-basin data source. It derives a stable mm value (0-300) per basin
``id`` using a seeded 32-bit PRNG (``mulberry32``), not ``Math.random``, so
the choropleth does not flicker on re-render.

Shared constants (also used by the Mapbox paint expression and the drawer
legend):

- ``MOCK_RAIN_MIN_MM`` / ``MOCK_RAIN_MAX_MM``
- ``RAIN_COLOR_STOPS`` -- an ``[mm, color][]`` ramp

Replacing the mock with real data means swapping this hook's implementation
for one that reads an actual per-basin rainfall dataset; the fill-color
expression and legend already key off the same ``rainMm`` property and
``RAIN_COLOR_STOPS`` ramp, so no other file needs to change.

MapboxMap Rendering
--------------------

``MapboxMap.tsx`` adds two additional GeoJSON sources/layers inside the
existing ``map.on('load', ...)`` handler, ordered so basins render below
rivers, which render below the stations layer:

- ``basins-source`` / ``basins-fill-layer`` / ``basins-line-layer``

  - ``promoteId: 'id'`` on the source enables ``feature-state`` hover
    highlighting.
  - ``fill-color`` is an ``interpolate`` expression over ``rainMm`` built
    from ``RAIN_COLOR_STOPS``.
  - Clicking a basin opens a popup with its name, ANA sub-basin code, and
    mock rainfall value.

- ``rivers-source`` / ``rivers-layer``

  - Simple blue line layer with a zoom-scaled width.
  - Clicking a river opens a popup with its name and length in km.

Props accepted by ``MapboxMap``:

- ``riverFeatures?: RiverFeature[]``
- ``basinFeatures?: BasinFeature[]``

Both are expected to already be filtered by the caller (``map/page.tsx``
passes ``filterRiverFeatures(...)`` / ``filterBasinFeatures(...)`` output, not
the raw GeoJSON).

A ``mapLoaded`` React state flag (set inside the ``load`` handler) gates the
effects that push river/basin data into their sources, replacing an earlier
``map.isStyleLoaded()`` imperative check that had no way to retry -- see
Known Issues Fixed below.

SWOT Spatial Filter
--------------------

``SwotFilterDrawer.tsx`` (the "Filtros" drawer for SWOT gauge stations) gained
two features on top of its existing trend/range/date/name filters:

1. **Visibility switch** -- ``SwotGaugeFilter.visible``. When off,
   ``filterSwotFeatures`` returns an empty array regardless of the other
   filters, hiding every gauge triangle from the map with one toggle.

2. **Spatial filter** -- ``SwotGaugeFilter.spatialMode``:

   - ``'none'`` -- no spatial restriction (default).
   - ``'nearRivers'`` -- only stations within ``riverProximityKm`` (a
     5-100km slider, default 20) of at least one *currently visible* river.
   - ``'insideBasins'`` -- only stations inside at least one *currently
     visible* basin polygon.

   Both modes match against whatever ``LayersDrawer`` currently has toggled
   on and selected -- there is no separate river/basin picker inside the SWOT
   drawer. ``map/page.tsx`` passes the same ``filterRiverFeatures`` /
   ``filterBasinFeatures`` output used to draw the map into
   ``SwotFilterDrawer`` as a ``SwotSpatialContext``. If a mode's required
   layer has zero visible features, its option grays out with a hint to
   enable that layer in the Camadas drawer.

Geometry math lives in ``spatialFilter.ts`` and intentionally avoids adding a
turf.js dependency:

- ``distanceToNearestRiverKm(point, riverFeatures)`` -- point-to-segment
  distance using an equirectangular approximation (accurate enough at the
  tens-of-km scale this filter needs; not geodesy-grade).
- ``isNearAnyRiver(point, riverFeatures, maxDistanceKm)``
- ``isInsideAnyBasin(point, basinFeatures)`` -- even-odd ray-casting
  point-in-polygon, including polygon holes.

Known Issues Fixed
-------------------

These bugs were found and fixed while building this feature; documented here
so the same class of mistake is easier to recognize in the future.

- **Basins stuck with zero selection.** The one-time effect that seeds
  ``LayersFilter`` with "select everything" only checked that *either*
  rivers or basins had loaded, not both. Since ``subbacias.geojson`` (830KB)
  resolves after ``rivers.geojson`` (220KB), it fired early with an empty
  basin list and never ran again. Fixed by waiting for both SWR responses.
- **First river/basin render silently dropped.** The effects pushing
  GeoJSON into their Mapbox sources gated on ``map.isStyleLoaded()`` with no
  retry -- if that check failed once and the prop never changed again, the
  data was lost. Replaced with a reactive ``mapLoaded`` state flag.
- **Toggle switch knob rendered outside its track.** The switch knob used
  ``position: absolute`` with only a ``translate-x`` and no explicit
  ``left``, leaving the resting position to the browser's ambiguous "static
  position" fallback. Fixed by anchoring with an explicit ``left-0.5``.
- **Camadas and Medições (forecast) drawers overlapping on desktop.** The
  Camadas panel's resting anchor changed between ``right-0`` and
  ``right-[26rem]`` depending on whether the forecast drawer was open, but
  its *closed* state used a flat ``translate-x-full`` sized for the
  ``right-0`` case only. When the anchor shifted, the "closed" panel body
  rendered on top of the forecast drawer instead of off-screen. Fixed by
  keeping the anchor constant and moving the open/closed logic entirely into
  ``translate-x``.

Development Checklist
----------------------

When changing this feature:

1. If the GeoJSON schema changes, update ``RiverFeatureProperties`` /
   ``BasinFeatureProperties`` in ``LayersDrawer.tsx``.
2. If replacing the mock rainfall with real data, change
   ``useMockRainHeatmap.ts`` only -- the paint expression and legend already
   key off ``rainMm`` / ``RAIN_COLOR_STOPS``.
3. Keep any new floating drawer's *closed*-state translate distance
   independent of a variable resting anchor (see Known Issues Fixed).
4. Run ``npx tsc --noEmit`` in ``web/`` after any change.
5. Manually verify in a browser: toggling rivers/basins, selecting
   individual features, the mock choropleth legend, and the SWOT spatial
   filter narrowing station counts.

Related Documentation
----------------------

- ``public-map.rst`` for the forecast overlay drawer sharing the same
  ``/map`` route.
- ``mapview.rst`` for the separate ``/mapview`` GeoJSON overlay route (not
  related to this feature).
- ``web/typedoc`` (generated) for the full type reference: ``LayersDrawer``,
  ``useMockRainHeatmap``, ``spatialFilter``, and ``SwotFilterDrawer``.
