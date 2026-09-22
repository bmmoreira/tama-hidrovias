Station and SWOT Gauge Clustering
==================================

Quick Summary
-------------

The public ``/map`` route clusters both of its point layers so the
initial, zoomed-out view isn't crowded with hundreds of overlapping
markers:

1. ``web/src/components/maps/stationClusterLayer.ts`` groups nearby
   hydrometric station points into Mapbox clusters instead of drawing one
   circle per station.
2. ``web/src/components/maps/swotGaugeClusterLayer.ts`` does the same for
   SWOT gauges, replacing the earlier approach of hiding every gauge
   triangle below a fixed zoom level with real clustering: partial
   clusters as you zoom, individual triangles once isolated or fully
   zoomed in.

The station layer uses standard Mapbox GL clustering (``cluster: true`` on
a GeoJSON source). The SWOT gauge layer does **not** -- it drives a
``supercluster`` index directly so cluster aggregates can be an exact
**median** rather than a mean; see `SWOT Gauge Clustering`_ for why.

.. important::
   Station point circles/clusters are **off by default**
   (``NEXT_PUBLIC_SHOW_STATION_MARKERS=false``) -- the underlying
   ``Station`` records are currently mock/placeholder data, unlike SWOT
   gauges, which are real data and always render. See
   `Toggling Station Markers On/Off`_.

Current Runtime Files
----------------------

- ``web/src/components/maps/stationClusterLayer.ts`` -- station clustering
  module (source/layers/interactions/data updates).
- ``web/src/components/maps/swotGaugeClusterLayer.ts`` -- exports
  ``SwotGaugeClusterLayer``, a plain class wrapping a ``supercluster``
  index (see `SWOT Gauge Clustering`_).
- ``web/src/components/maps/SwotFilterDrawer.tsx`` -- also exports the
  ``SwotMetric`` type and ``SWOT_METRIC_OPTIONS``, and renders the
  "Métrica visualizada" dropdown that picks which property drives both
  gauges and cluster aggregates.
- ``web/src/components/MapboxMap.tsx`` -- mounts the map; calls
  ``addStationLayers``/``attachStationLayerInteractions`` and
  instantiates ``new SwotGaugeClusterLayer(map, handlers)`` from the map's
  ``'load'`` handler, and forwards the ``stations`` / ``swotGaugeFeatures``
  / ``swotMetric`` props into their respective update calls.

Station Point Clustering
-------------------------

With hundreds of stations loaded on first visit, drawing one circle per
point was the single biggest paint cost on initial map load. Clustering
collapses nearby stations into a single aggregated circle labeled with a
count, expanding into individual points as the user zooms in past
``STATION_CLUSTER_MAX_ZOOM`` (14) or clicks a cluster to zoom in on it
directly.

``addStationLayers(map)`` registers one source and three layers, all keyed
off ``STATION_SOURCE_ID``:

- ``STATION_CLUSTERS_LAYER_ID`` -- circle layer, filtered to
  ``['has', 'point_count']``. Radius and color both scale with
  ``point_count`` via ``step`` expressions (bigger/darker for bigger
  clusters).
- ``STATION_CLUSTER_COUNT_LAYER_ID`` -- symbol layer showing
  ``point_count_abbreviated`` as text on top of each cluster circle.
- ``STATION_UNCLUSTERED_LAYER_ID`` -- circle layer, filtered to
  ``['!', ['has', 'point_count']]``. This is the original per-station
  circle (colored by ``source``: ANA/HydroWeb/SNIRH/Virtual), unchanged
  from before clustering was introduced.

``attachStationLayerInteractions(map, handlers)`` wires up:

- **Click a cluster** -- looks up the cluster's expansion zoom via
  ``source.getClusterExpansionZoom()`` and eases the camera to it, so the
  cluster breaks apart under the cursor.
  ``getClusterExpansionZoom`` uses mapbox-gl-js's callback API (not a
  Promise) in the installed ``mapbox-gl`` v3.x.
- **Click an individual station** -- shows the same popup (name, code,
  source, basin) that existed before clustering.
- **Double-click an individual station** -- calls
  ``handlers.onStationDoubleClick(stationId)``. The id-based callback
  signature keeps the module free of any dependency on the full
  ``Station`` list; ``MapboxMap.tsx`` does the id -> ``Station`` lookup
  itself (via ``stationsRef``, see below) and invokes the
  ``onStationDoubleClick`` prop.
- **Hover** -- pointer cursor on both the cluster and unclustered layers.

``updateStationLayerData(map, stations)`` converts the ``Station[]`` prop
into the source's ``FeatureCollection`` on every change.

SWOT Gauge Clustering
----------------------

SWOT gauges used to render as one ``mapboxgl.Marker`` DOM element per
feature (a custom SVG triangle, colored by the ``Change`` value, with the
value as a text label), all hidden below a fixed zoom level to avoid
crowding the initial view. DOM markers can't be clustered by Mapbox at all
(clustering is a GeoJSON-source feature), so hundreds of gauges always
visually dominated the map the instant they were revealed.
``swotGaugeClusterLayer.ts`` replaces that with real clustering, so the
view degrades gracefully as you zoom instead of an all-or-nothing reveal.

A first version of this clustering used Mapbox's native ``cluster: true``
GeoJSON source (the same mechanism the station layer still uses), with
``clusterProperties`` computing a running sum/count so the cluster's
**average** ``Change`` could be derived. That was replaced because an
average lets a couple of extreme outlier gauges dominate a cluster's
displayed value -- and, more fundamentally, because Mapbox's
``clusterProperties`` can only express *incrementally combinable*
aggregates (sum, max, min, applied pairwise as points merge). A median is
not incrementally combinable: computing it exactly requires the full set
of raw values, not a running total. So ``SwotGaugeClusterLayer`` drives a
``supercluster`` index directly instead (the same clustering library
Mapbox GL JS uses internally for ``cluster: true``, just called by hand),
using its ``getLeaves()`` API to pull every raw point out of a cluster and
compute an exact median in plain JS.

Selectable metric
~~~~~~~~~~~~~~~~~

``SwotFilterDrawer.tsx`` exposes a "Métrica visualizada" control (three
buttons, matching the drawer's existing "Tendência" button-group style)
backed by the ``SwotMetric`` union type (``'Change' | 'std' | 'median'``,
default ``'Change'``) and the ``SWOT_METRIC_OPTIONS`` label list. The
choice applies globally -- to individual gauges *and* to cluster
aggregates alike:

- **Individual gauge** -- renders that property's own value directly.
- **Cluster** -- renders the **median of that property** across every
  point the cluster contains (never an average, regardless of which
  metric is selected).

The same signed color/shape scale (orange → red for negative, light →
dark green for positive, gray for no data, up/down triangle by sign)
applies no matter which metric is selected, even though ``std`` and
``median`` are typically non-negative magnitudes -- in practice they
mostly render as green upward triangles varying only in saturation/size
by magnitude. This was a deliberate simplification over building a second
color scale for magnitude-only metrics.

The selector itself is gated behind
``NEXT_PUBLIC_SWOT_METRIC_SELECTOR_ENABLED`` (off/``false`` by default) --
see `Toggling the Metric Selector On/Off`_.

Rendering pipeline
~~~~~~~~~~~~~~~~~~

``SwotGaugeClusterLayer`` is a plain class (not a React hook), constructed
once via a ``useRef`` in ``MapboxMap.tsx``'s mount effect, mirroring how
the map instance itself is held in a ref:

- ``addLayers()`` (called once, from the constructor) registers two SDF
  triangle icons (pointing up / pointing down, drawn once onto an
  offscreen ``<canvas>`` via ``map.addImage(id, imageData, { sdf: true
  })`` -- SDF images can be recolored per-feature via the ``icon-color``
  paint property), a **plain, non-clustering** GeoJSON source
  (``SWOT_SOURCE_ID``), and a single symbol layer (``SWOT_GAUGES_LAYER_ID``)
  whose layout/paint properties are all simple ``['get', propName]``
  lookups -- ``iconImage``, ``iconColor``, ``iconSize``, ``textLabel``,
  ``textOffset`` are precomputed in JS per feature (see below), not
  expressed as Mapbox style expressions. This sidesteps a real limitation
  of the previous, expression-based implementation: Mapbox's expression
  type-checker statically rejects a ``number | null``-typed value in a
  numeric operator even when the ``null`` branch is unreachable at that
  point in the tree, which had forced the old code to encode "no data" as
  a sentinel number instead of ``null``. Precomputing color/shape/label in
  plain JS makes that workaround unnecessary.
- ``setFeatures(features)`` rebuilds the ``supercluster`` index from
  scratch (spatial grouping only depends on point coordinates, radius, and
  max zoom -- never on the selected metric) and re-renders.
- ``setMetric(metric)`` swaps which property drives the display and
  re-renders **without** reloading the index -- switching metrics is cheap
  because the spatial clustering itself doesn't change.
- ``render()`` (called on ``moveend``, not continuous ``move``/``zoom``,
  to avoid recomputing potentially-expensive per-cluster medians on every
  animation frame during a pan/zoom gesture) calls
  ``index.getClusters(bbox, zoom)`` for the current viewport, then for
  each result:

  - **Cluster** -- calls ``index.getLeaves(clusterId, Infinity)`` to get
    every raw point inside it, extracts the selected metric's value from
    each, and computes their median.
  - **Individual point** -- reads the selected metric's value directly.

  Either way the result feeds through the same ``buildRenderProperties()``
  helper (color, icon, size, label, text offset), and the whole
  ``FeatureCollection`` is pushed into the source via ``setData()``.

``attachInteractions()`` registers a single click handler on
``SWOT_GAUGES_LAYER_ID`` that branches on ``feature.properties.cluster`` (a
boolean ``supercluster`` sets on synthetic cluster features):

- **Cluster** -- calls ``index.getClusterExpansionZoom(clusterId)``
  (synchronous in ``supercluster`` -- unlike Mapbox's own
  ``GeoJSONSource.getClusterExpansionZoom``, which is callback-based) and
  eases the camera to it, so the cluster breaks apart under the cursor.
- **Individual gauge** -- reconstructs a full ``SwotGaugeFeature`` from the
  clicked Mapbox feature's properties/geometry and calls
  ``handlers.onGaugeClick(feature)``. ``MapboxMap.tsx`` passes this
  straight into the existing ``setGaugePopup({ feature })`` call, so the
  rich popup (name, id, variação, mediana, desvio padrão, etc.) is
  unchanged.

``destroy()`` removes the ``moveend`` listener; layers/source/images are
left on the map, matching how the rest of ``MapboxMap.tsx`` doesn't tear
down its other layers on prop changes either -- only on full unmount.

Configuration
-------------

``NEXT_PUBLIC_STATION_CLUSTER_RADIUS`` and ``NEXT_PUBLIC_SWOT_CLUSTER_RADIUS``
(both default ``65``) control each layer's cluster radius in pixels --
roughly how close two points need to be on screen before they merge into
one cluster circle. Since these are ``NEXT_PUBLIC_`` variables they are
inlined into the client bundle at build time (see the project's deployment
docs for why that means they must be passed as Docker build args, not only
a runtime environment variable, in the Docker-based deployments). Both are
wired through the same four places:

- ``.env`` / ``web/.env.example`` -- local defaults (``65``).
- ``web/Dockerfile`` -- ``ARG``/``ENV`` so they reach the built client
  bundle.
- ``docker-compose.yml`` -- ``web.build.args``, falling back to ``65`` if
  unset.
- ``scripts/google-env-production.template`` -- the google host's Next.js
  deployment reads ``.env.production`` directly (no Docker build-arg step
  needed there).

If either variable is missing entirely, the corresponding constant falls
back to ``65`` in code, so a misconfigured deployment degrades gracefully
rather than breaking.

Toggling the Metric Selector On/Off
------------------------------------

``NEXT_PUBLIC_SWOT_METRIC_SELECTOR_ENABLED`` (default ``false``/off) gates
the "Métrica visualizada" selector described in `Selectable metric`_
entirely. While off:

- ``SwotFilterDrawer.tsx`` doesn't render the selector section at all --
  there's no UI to change the metric.
- ``filter.metric`` stays at ``DEFAULT_SWOT_FILTER``'s value (``'Change'``)
  for every session, so gauges and cluster medians always visualize
  Change, matching the pre-selector behavior.

``SwotFilterDrawer.tsx`` exports ``SWOT_METRIC_SELECTOR_ENABLED =
process.env.NEXT_PUBLIC_SWOT_METRIC_SELECTOR_ENABLED === 'true'`` -- the
same "boolean flag as a plain exported const, checked at the top of the
component" pattern used for ``SHOW_STATION_MARKERS`` below, just without a
second read site (no fetch to gate here, only a render). It's wired
through the same three places as the cluster-radius variables above
(``web/.env.example``, ``web/Dockerfile``, ``docker-compose.yml``'s
``web.build.args``, plus ``scripts/google-env-production.template`` for
the google host) since it's also a ``NEXT_PUBLIC_`` build-time variable.

To enable: set ``NEXT_PUBLIC_SWOT_METRIC_SELECTOR_ENABLED=true`` in the
relevant env file and redeploy. No code changes are needed.

Toggling Station Markers On/Off
--------------------------------

``NEXT_PUBLIC_SHOW_STATION_MARKERS`` (default ``false``) is a boolean flag
gating the station points feature entirely. It's off by default because
the ``Station`` records currently come from mock/placeholder data, unlike
SWOT gauges (real data, always on -- there is no equivalent flag for
them).

Unlike the numeric config above, this flag is read from **two** places for
a reason:

- ``web/src/components/maps/stationClusterLayer.ts`` exports
  ``SHOW_STATION_MARKERS = process.env.NEXT_PUBLIC_SHOW_STATION_MARKERS ===
  'true'`` -- the single source of truth for "is this feature on."
- ``web/src/app/map/page.tsx`` imports that constant and uses it to gate the
  SWR key for the stations fetch itself (``SHOW_STATION_MARKERS ?
  'map-stations' : null``), the same conditional-fetch pattern already used
  for ``user-preferences``. When the flag is off, the app never even
  requests station data from Strapi -- it doesn't fetch data it isn't going
  to render.

To re-enable once real station data is available: set
``NEXT_PUBLIC_SHOW_STATION_MARKERS=true`` in the relevant env file (see the
four locations in `Configuration`_) and redeploy. No code changes are
needed -- the clustering module itself is unaffected by this flag; it just
stops receiving data to render when the fetch is skipped.

Note this flag governs the station circles/clusters *only*. It has no
effect on SWOT gauge clustering or the station search overlay
(``StationExplorerOverlay``), which gets its data independently of the
``stations`` fetch this flag gates.

Known Issues Fixed
-------------------

- **Stations never rendering at all.** The effect that pushes
  ``stations`` into the Mapbox source checked ``map.isStyleLoaded()``
  imperatively with no reactive retry -- the same bug class already fixed
  for rivers/basins/the raster overlay elsewhere in ``MapboxMap.tsx``, just
  never applied here. If ``stations`` resolved before the map's ``'load'``
  event fired, the source's data silently stayed an empty
  ``FeatureCollection`` forever: zero station circles at *any* zoom, not
  just a clustering problem. Fixed by depending on the reactive
  ``mapLoaded`` state instead. Confirmed fixed via an actual headless
  browser render (Playwright) rather than just reasoning about the code,
  since this class of race condition doesn't show up from reading the
  diff alone.
- **Stale station list in the double-click handler.** The double-click
  listener is registered once, inside the map's ``'load'`` handler, so a
  handler that closed directly over the ``stations`` prop would always see
  whatever ``stations`` was at mount time, not later updates. Fixed by
  reading from a ``stationsRef`` kept in sync via a ``useEffect`` (the same
  pattern already used for the ``onStationDoubleClick`` callback itself).
  This bug predates clustering but was easiest to fix while this code was
  already being extracted into its own module.

River Cross-Section Points
----------------------------

A third clustered point layer, added for the Madeira basin's river
cross-section (transversal section) data: 377 SWORD-derived points, each
with an associated bathymetric depth profile. See
:doc:`architecture/cross_section_flow` for the full diagrams; this
section covers just what differs from the station/SWOT layers above.

Unlike stations and SWOT gauges, this layer's source data is **not**
fetched from Strapi -- it's static reference data checked into the repo
and served as plain files under ``web/public/geojson/`` (the same
convention already used for ``rivers.geojson``/``subbacias.geojson``):

- ``secoes_madeira_ponto.geojson`` -- the point ``FeatureCollection``,
  copied from ``assets/secoes_madeira_ponto.geojson``.
- ``secoes_transversais/<file>`` -- one profile per point (distance,
  depth pairs), copied from ``assets/secoes_transversais/``.

``crossSectionClusterLayer.ts`` mirrors ``stationClusterLayer.ts``
exactly (plain Mapbox-native ``cluster: true``, not the ``supercluster``
approach SWOT gauges use) since no per-cluster aggregate value is
displayed -- clusters just show a point count, same as stations.
``NEXT_PUBLIC_CROSS_SECTION_CLUSTER_RADIUS`` (default ``50``) tunes the
cluster radius, following the same pattern as
``NEXT_PUBLIC_STATION_CLUSTER_RADIUS``/``NEXT_PUBLIC_SWOT_CLUSTER_RADIUS``
-- but it's not yet wired through the Docker build-arg plumbing those two
are (``web/Dockerfile``, ``docker-compose.yml``), since the default has
been sufficient so far; add it there the same way if that changes.

Clicking an individual (unclustered) point shows a popup styled like the
SWOT gauge popup (name/id header, a few data rows, a call-to-action
button) instead of the plain HTML ``mapboxgl.Popup`` stations/rivers/
basins use. Its "Ver perfil da seção" button opens ``CrossSectionModal``,
which lazily fetches that point's specific ``secoes_transversais/<file>``
profile only when opened (via SWR, keyed by the file path so repeat opens
are cached) and renders it as a Recharts ``AreaChart`` with a **reversed**
Y axis -- depth increases downward, matching how a cross-section profile
reads visually, with the water surface at the top and the channel bed
dipping below it.

Development Checklist
----------------------

When changing this feature:

1. Keep ``stationClusterLayer.ts``, ``swotGaugeClusterLayer.ts``, and
   ``crossSectionClusterLayer.ts`` free of React/Next.js-specific concerns
   (hooks, props) -- they should stay plain Mapbox GL modules that any
   component could call into, mirroring ``useMockRainHeatmap.ts`` and
   ``spatialFilter.ts``'s existing separation of concerns.
2. If the station, gauge, or cross-section popup content changes, update
   it in ``attachStationLayerInteractions`` / the ``MapboxMap.tsx`` gauge
   popup JSX / the ``MapboxMap.tsx`` cross-section popup JSX respectively
   -- there is a single builder for each, not one per call site.
3. If you add a new point layer, insert it with an explicit ``beforeId``
   if it needs to render below/above the existing station or SWOT layers
   (see the raster overlay layer in ``MapboxMap.tsx`` for the existing
   pattern of rendering below the station layers). Layers added with no
   ``beforeId`` render on top of everything added before them.
4. If the SWOT triangle icon's shape or size changes, update
   ``createTriangleImage`` in ``swotGaugeClusterLayer.ts`` -- both icons
   are generated once (per map instance) from the same function with an
   ``inverted`` flag, not from separate hand-drawn assets.
5. If you add another selectable SWOT metric, extend the ``SwotMetric``
   union and ``SWOT_METRIC_OPTIONS`` in ``SwotFilterDrawer.tsx`` -- no
   change is needed in ``swotGaugeClusterLayer.ts`` itself, since
   ``render()`` already reads whichever property name ``metric`` holds
   generically (both for individual gauges and for the per-cluster
   median).
6. Run ``npx tsc --noEmit`` in ``web/`` after any change.
7. Manually verify in a browser: station cluster circles show a count;
   clicking a cluster (station or SWOT) zooms in and it breaks apart;
   isolated points render as individual shapes even at a wide zoom
   (nothing nearby to cluster with); switching the SWOT "Métrica
   visualizada" control changes both individual gauge values and cluster
   values, and cluster values are a median, not an average, of the
   underlying points; individual SWOT gauge click opens the full popup
   with correct data; individual station click/double-click/hover behave
   as before clustering was introduced.

Related Documentation
----------------------

- ``map-layers.rst`` for the rivers/basins drawer sharing the same
  ``MapboxMap.tsx`` component.
- ``public-map.rst`` for the forecast overlay drawer on the same ``/map``
  route.
- ``web/typedoc`` (generated) for the full type reference:
  ``stationClusterLayer``, ``swotGaugeClusterLayer``,
  ``crossSectionClusterLayer``.
