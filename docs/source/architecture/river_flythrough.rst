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

3D riverbed wireframe (prototype)
------------------------------------

A first step toward a real 3D riverbed, rendered as actual sampled depth
data rather than a flat raster: when the flight starts, a single static
chunk of real bathymetry near the first node is rendered as a Three.js
wireframe (``riverFlythroughTerrain.ts``), layered into the same WebGL
context Mapbox GL itself uses via a ``CustomLayerInterface``. This is a
proof of mechanics, not a finished feature -- it doesn't follow the
camera along the flight path yet, see "Known limitations" below.

Why a wireframe, and why sampled data, not the rendered raster
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The rest of the forecast system (``/api/forecast-tiles/...``) serves
*rendered PNG tiles* -- pixel colors, with no numeric values a client
could turn into 3D vertices. A wireframe needs the actual depth numbers
at a grid of points, so this prototype adds a separate endpoint,
``GET /api/bathymetry/raster-grid?slug=&bbox=&size=``
(``web/src/app/api/bathymetry/raster-grid/route.ts``), which:

1. Proxies TiTiler's ``/cog/bbox/{minx},{miny},{maxx},{maxy}/{w}x{h}.tif``
   -- a small *cropped GeoTIFF*, not a full re-render -- for the
   requested area.
2. Decodes it server-side with the ``geotiff`` npm package (chosen over
   asking TiTiler for its ``.npy`` format: decoding an actual GeoTIFF,
   bands and nodata mask included, is a well-trodden path through an
   actively maintained library, versus hand-rolling a ``.npy`` header
   parser for a one-off feature).
3. Returns plain JSON (``{ width, height, bounds, values }``, row-major,
   ``null`` for nodata pixels) -- grid resolution is clamped to 128px
   per side server-side, since this is a prototype chunk, not a tile
   pipeline.

Positioning: Three.js inside a Mapbox custom layer
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

``addRiverDepthWireframe`` follows Mapbox's own documented recipe for
embedding Three.js (a ``CustomLayerInterface`` whose ``render`` callback
receives Mapbox's current projection matrix every frame, shared over the
same ``WebGL2RenderingContext``/canvas rather than a second one):

- Each sampled grid point's lng/lat is converted to **meters offset from
  a chosen origin** (an equirectangular approximation -- accurate enough
  for a chunk a couple km across, and avoids pulling in a geodesy
  library for this prototype) -- not directly into Mapbox's own Mercator
  coordinates. Mercator coordinates are tiny fractional numbers; placing
  Three.js ``BufferGeometry`` vertices directly in that space would lose
  precision in 32-bit floats. Keeping vertices in ordinary meter-scale
  numbers (roughly -1000 to 1000) avoids that entirely.
- A single **model transform** (translate to the origin's Mercator
  position + a uniform scale factor, from
  ``MercatorCoordinate.meterInMercatorCoordinateUnits()``) converts that
  local meter space into Mercator space once; multiplying it by Mapbox's
  own per-frame matrix in ``render()`` is what actually places the
  geometry correctly under the live camera.
- Depth becomes a **local, exaggerated Z offset** (``-depth *
  exaggeration``, default 12x) in that same meter space -- since the
  model transform scales X, Y, and Z uniformly, "12x exaggerated" stays
  physically meaningful instead of warping into some other axis's units.
- ``renderer.autoClear = false`` and an explicit ``renderer.resetState()``
  before every draw call are both required -- without them, Three.js's
  own WebGL state management conflicts with Mapbox's, and one renderer
  clobbers the other's frame.
- **No fixed 90° rotation in the model transform, deliberately.** Mapbox's
  own "add a 3D model with three.js" example applies a ``rotateX: PI/2``
  in its model transform -- but that exists to convert a *Y-up* authored
  glTF/OBJ model into Mapbox's Z-up world, not as a universal requirement
  for every Three.js layer. This geometry's local axes are already
  ``(X=east, Y=north, Z=up)`` by construction, so copying that rotation
  over tips an already-correct, flat, horizontal grid onto its side into
  a vertical wall facing the camera -- a real bug this prototype hit on
  its first pass, not a hypothetical one.

Verified visually via Playwright: the wireframe renders as a real,
camera-correct 3D quad over the actual river location (not a flat
on-screen rectangle -- its shape skews with the live pitch/bearing
exactly like the basemap itself does), coexists with the colored
bathymetry raster underneath it without either clobbering the other,
and correctly disappears once the camera has flown far enough away
(expected, since it's one fixed chunk, not a camera-following one).

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
- **The riverbed wireframe is one static chunk, not a camera-following
  one.** It's placed near the flight's starting node and stays there for
  the whole flight -- proving the Three.js/Mapbox/TiTiler mechanics work
  end to end, not yet the progressive, chunk-streaming version (fetch a
  window of chunks ahead of the camera, dispose ones behind it) that a
  real "3D riverbed the whole flight" feature would need.
- **``slug``/``bounds`` are hardcoded to one known Tapajós bathymetry
  frame and the flight's start node**, in ``MapboxMap.tsx``, not derived
  from whatever frame ``ForecastDrawer`` actually has active.
