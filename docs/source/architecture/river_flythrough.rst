River Navigation Flythrough
==============================

A simulated camera flight along the Tapajós river, as a demo/test of what
a boat-navigation-style map experience could feel like: the camera flies
from the river's first cross-section node (near its mouth) to its last
(farthest upstream, node ``62241500070411``), tilted and zoomed close to
the water like it's following the current, with the Tapajós bathymetry
raster active underneath the whole flight.

Trigger
--------

A "Navegação simulada" section in the Camadas de Previsão drawer
(``ForecastDrawer.tsx``), shown whenever the ``PROFUNDIDADE`` (bathymetry)
forecast area has any frames -- today that means the two Tapajós depth
GeoTIFFs under ``assets/tiff/profundidade/``. Clicking "Iniciar navegação
pelo rio":

1. Activates the bathymetry overlay if it isn't already the active layer
   (``selectArea('PROFUNDIDADE')``) -- checked against both
   ``selectedGroup.area`` *and* ``isEnabled``, since the area can already
   be the default-selected one (``groups[0]``) without any frame actually
   being enabled/displayed yet. One click should be enough to both show
   the raster and start the flight, not a two-step "pick a layer, then
   separately start navigating."
2. Closes the drawer, so the canvas is unobstructed for the flight.
3. Calls ``onStartFlythrough``, which bumps a ``flythroughRequestId``
   state value (``Date.now()``) in ``map/page.tsx`` -- the actual trigger
   signal passed down to ``MapboxMap``.

``MapboxMap`` watches ``flythroughRequestId`` in a ``useEffect`` keyed on
``[flythroughRequestId, mapLoaded]`` (deliberately *not* on
``crossSectionFeatures`` -- see that effect's own comment for why) and
starts the flight whenever it changes to a new, defined value, cancelling
any flight already in progress first so re-clicking the button restarts
cleanly rather than running two animations at once.

The path
---------

``riverFlythrough.ts``'s ``buildTapajosPath()`` filters the already-loaded
``crossSectionFeatures`` (the same data driving the map's cross-section
circles -- no separate fetch) down to Tapajós points by matching
``sword_node_id`` against the ``622411``-``622415`` prefix range, the same
convention used elsewhere (``scripts/load_bathymetry_parquet.py``, the
cross-section merge). There's no dedicated "river" field on
``CrossSectionFeatureProperties`` to filter on directly yet. Points are
then sorted ascending by ``sword_dist_out`` (distance from the river
outlet), so the path runs mouth → farthest upstream -- "first node to
last node," matching the request this implements.

The camera
-----------

Driven by ``startRiverFlythrough(map, path, options)``:

- **Distance-weighted interpolation, not equal-time-per-node.** Nodes
  aren't evenly spaced along the river, so advancing one node per fixed
  time slice would visibly speed up and slow down crossing uneven gaps.
  Instead, the path's cumulative haversine distance is precomputed once
  (``buildPathTable``), and at every animation frame the camera's
  position is the point at ``easedProgress * totalDistance`` along that
  table (``pointAlongPath``) -- constant real-world speed for the whole
  flight regardless of how nodes happen to be spaced.
- **Look-ahead bearing, not per-vertex snapping.** The camera's bearing
  at any point is the initial bearing toward a point slightly further
  down the path (1.5% of total distance ahead), not just the next raw
  vertex -- this keeps the camera's heading drifting smoothly around the
  river's bends instead of visibly snapping at every node.
- **``map.jumpTo`` inside a ``requestAnimationFrame`` loop, not
  ``flyTo``/``easeTo``.** Those methods own their own internal animation
  and would fight a per-frame external driver computing its own
  position/bearing every tick; ``jumpTo`` just sets the camera state
  immediately, which is what a hand-rolled animation loop needs.
- **Ease-in-out (cosine), not linear.** So the flight accelerates away
  from the first node and decelerates into the last one instead of
  starting/stopping at a sudden constant speed.
- **User interaction handlers are disabled for the flight's duration**
  (``dragPan``, ``scrollZoom``, ``boxZoom``, ``dragRotate``,
  ``keyboard``, ``doubleClickZoom``, ``touchZoomRotate``) and restored
  -- to whatever their prior enabled/disabled state actually was, not
  unconditionally re-enabled -- when the flight ends or is cancelled.
  Without this, a user scrolling/dragging mid-flight would fight the
  forced camera updates every frame.

Configuration
--------------

Three ``.env`` variables, read as module-level constants in
``riverFlythrough.ts`` (same pattern as every other tunable layer
setting in this codebase, e.g. ``NEXT_PUBLIC_CROSS_SECTION_CIRCLE_RADIUS``):

.. list-table::
   :header-rows: 1
   :widths: 40 30 30

   * - Variable
     - Meaning
     - Default
   * - ``NEXT_PUBLIC_FLYTHROUGH_PITCH``
     - Camera tilt, degrees (0 = straight down)
     - ``65``
   * - ``NEXT_PUBLIC_FLYTHROUGH_ZOOM``
     - "Height" above the river -- a Mapbox zoom level, not a real
       altitude (there's no true 3D camera height in a 2D vector/raster
       style); higher means closer to the water
     - ``13.5``
   * - ``NEXT_PUBLIC_FLYTHROUGH_DURATION_MS``
     - Total time, ms, to fly the whole Tapajós reach end to end
     - ``45000``

Like the cross-section circle env vars before them, these aren't yet
wired through ``web/Dockerfile``/``docker-compose.yml``'s build-arg
plumbing (``NEXT_PUBLIC_*`` vars need to be passed as Docker build args
to be inlined into a *production* build, not just present in ``.env`` --
see ``docker-compose.yml``'s ``web.build.args``) -- only dev mode (which
reads ``.env`` directly at runtime) has been exercised so far. Add them
there the same way if/when this needs to work in a production build with
non-default values.

Known limitations
-------------------

This is explicitly a demo/test of the concept, not a finished feature:

- **Tapajós only, hardcoded.** The button, the path-building logic, and
  the "PROFUNDIDADE" area gate are all specific to this one river. A
  second river would need at minimum a way to pick which river's path to
  fly (and ideally a real ``river`` field on cross-section features
  instead of the node-id-prefix convention this and other code already
  lean on).
- **No visual progress indicator.** The flight can be started again
  (restarting cleanly) but there's no on-screen "flying... 40%" state or
  a way to pause/stop it early beyond re-triggering or navigating away.
- **No terrain/3D buildings.** The pitch tilt is real (confirmed by
  reading back ``map.getPitch()`` during the flight) and visible as a
  horizon once zoomed in or over open water, but the base map style has
  no elevation data, so the "flying over terrain" feel is mostly carried
  by the raster/water content in view, not true 3D relief.
