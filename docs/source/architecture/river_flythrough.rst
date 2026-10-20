River Navigation Flythrough
==============================

A simulated camera flight along a river, as a demo/test of what a
boat-navigation-style map experience could feel like: the camera flies
from a river's first cross-section node (near its mouth) to its last
(farthest upstream), tilted and zoomed close to the water like it's
following the current. There are two **separate** demos, not one
feature with a river switch, triggered by two different buttons in the
Camadas de Previsão drawer:

- **Tapajós** (node ``62241500070411`` is its last node) -- flies with
  the Tapajós bathymetry *raster* active underneath, and its riverbed
  wireframe samples that GeoTIFF via TiTiler (see `3D riverbed wireframe
  (prototype)`_).
- **Madeira** -- no raster involved at all; its riverbed wireframe is
  built directly from real, loaded PostGIS depth data
  (``bathymetry_points``, see :doc:`bathymetry_depth_lookup`), which is
  both cheaper to query and more accurate than resampling a raster (see
  `Madeira flythrough: real PostGIS data, not a raster`_).

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

The Madeira demo's "Iniciar navegação pelo rio (Madeira)" button works the
same way but simpler -- there's no forecast area/frame to activate first
(Madeira has no bathymetry GeoTIFF), so ``startMadeiraFlythrough`` just
closes the drawer and bumps a separate ``madeiraFlythroughRequestId``.
Both requestId props share the *same* cancellation refs in ``MapboxMap``
(``cancelFlythroughRef``/``removeDepthWireframeRef``), not one pair each --
starting either demo cancels whichever one (if any) was already running,
so only one flight/wireframe is ever active regardless of which button
was clicked.

The path
---------

``riverFlythrough.ts``'s ``buildTapajosPath()``/``buildMadeiraPath()``
filter the already-loaded ``crossSectionFeatures`` (the same data driving
the map's cross-section circles -- no separate fetch) down to one river's
points by matching ``sword_node_id`` against a prefix (``622411``-
``622415`` for Tapajós, ``6226`` for Madeira), the same convention used
elsewhere (``scripts/load_bathymetry_parquet.py``, the cross-section
merge). There's no dedicated "river" field on
``CrossSectionFeatureProperties`` to filter on directly yet. Points are
then sorted ascending by ``sword_dist_out`` (distance from the river
outlet), so each path runs mouth → farthest upstream -- "first node to
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

Madeira flythrough: real PostGIS data, not a raster
-------------------------------------------------------

A second, separate demo/test, triggered by its own "Iniciar navegação
pelo rio (Madeira)" button (amber-themed in the drawer, to visually
distinguish it from the Tapajós one's cyan) -- same camera mechanism
(``startRiverFlythrough``, just given ``buildMadeiraPath()``'s path
instead), but the riverbed wireframe's data source is entirely
different, and was requested specifically because Madeira already has
real bathymetry data loaded in Postgres (:doc:`bathymetry_depth_lookup`),
not just a rendered GeoTIFF.

One indexed query instead of a raster crop + decode
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

``GET /api/bathymetry/point-grid?bbox=&date=`` (``fetchDepthChunkFromPoints``
in ``riverFlythroughTerrain.ts``) replaces the Tapajós path's TiTiler
crop + ``geotiff`` decode with a single query against
``bathymetry_points``:

.. code-block:: text

   SELECT cell_row, cell_col, depth_m,
          ST_X(geom::geometry) AS lng, ST_Y(geom::geometry) AS lat
   FROM bathymetry_points
   WHERE reference_date = $1
     AND geom && ST_MakeEnvelope($2, $3, $4, $5, 4326)::geography

The ``&&`` bbox check uses the same ``bathymetry_points_geom_idx`` GiST
index the depth-lookup endpoint's nearest-neighbor query relies on --
confirmed via ``EXPLAIN ANALYZE`` to use a Bitmap Index Scan, a few
milliseconds for a chunk-sized bbox even at 168k total rows. This is
both cheaper (no network hop to TiTiler, no raster decode) and more
accurate (the real measured value at each point, not one resampled
through a reprojection) than the Tapajós path -- the data just has to
actually be loaded in Postgres for a river for this to be an option at
all, which is why this is Madeira-specific rather than replacing the
Tapajós path.

Why grid positions can't be interpolated from bounds here
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

``buildWireframeGeometry`` (in ``riverFlythroughTerrain.ts``) originally
computed each vertex's lng/lat by interpolating evenly across a chunk's
``bounds`` -- correct for a TiTiler raster crop, which really is an
evenly-spaced grid in lng/lat by construction (TiTiler reprojects and
resamples to exactly the requested bbox). It is **not** correct for
``bathymetry_points``: its ``cell_row``/``cell_col`` describe a grid
that's regular in the *source UTM projection's* meters, not in lng/lat
degrees, and a 700km-long, winding river accumulates real drift between
those two (UTM grid north vs. true north -- the projection's convergence
angle -- varies along the river's length). Reconstructing positions from
``bounds`` alone would have quietly warped the mesh's shape, worse in
some stretches than others, as a result.

The fix: ``DepthChunk`` gained an optional ``lngLats`` field -- real,
per-point coordinates, parallel to ``values`` -- which
``fetchDepthChunkFromPoints`` always populates (straight from the SQL
query's own ``ST_X``/``ST_Y``) and ``fetchDepthChunkFromRaster`` leaves
unset (interpolating from ``bounds`` is still correct there).
``buildWireframeGeometry`` prefers ``lngLats[i]`` when present, falling
back to the bounds interpolation otherwise -- one function, correct for
either data source, rather than two separate geometry builders.
``cell_row``/``cell_col`` are still what decides which vertices are
*adjacent* (i.e., which pairs get a wireframe line drawn between them) --
that part of the original UTM grid's topology is still exactly right
regardless of how it reprojects, only the vertex *positions* needed the
fix.

A real gap pattern, not a clipped rectangle
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Unlike a raster crop (always a filled rectangle), a bbox query against
``bathymetry_points`` only returns points where the original hydraulic
model actually had a river cell -- a bbox straddling the riverbank comes
back with real, irregular gaps matching the channel's own shape. No
special handling was needed for this: the existing nodata-as-``null``
convention (a missing/``null`` depth skips the line segments touching
that vertex, see ``buildWireframeGeometry``'s ``pushSegment``) already
covers it, since a grid cell with no matching row in the query result
is exactly as "missing" as a raster pixel with a ``0`` mask value.

Verified visually via Playwright: the wireframe renders flat (not the
Tapajós prototype's one-time rotation bug), amber-colored, following
the Madeira channel's real, irregular shape (not a clean rectangle), and
the camera itself correctly flies along the real Rio Madeira (confirmed
against on-map place labels passed during the flight) rather than
Tapajós.

Progressive chunk streaming (Madeira)
-----------------------------------------

Madeira's wireframe no longer stops at one static chunk near the start
-- it streams a sliding window of chunks as the camera advances, via
``createDepthWireframeStreamer`` in ``riverFlythroughTerrain.ts``. This
was practical to build for Madeira specifically, and not attempted for
Tapajós yet, because each chunk fetch there is one indexed Postgres
query (a few ms, see "One indexed query instead of a raster crop +
decode" above) -- cheap enough to do live, repeatedly, for the whole
flight, unlike Tapajós's TiTiler-crop-plus-``geotiff``-decode round trip.

How it's driven
~~~~~~~~~~~~~~~~~

``startRiverFlythrough`` gained an ``onProgress`` callback (part of
``FlythroughOptions``), fired every animation frame with the camera's
current position and distance traveled along the path -- not throttled
inside the camera loop itself, since different consumers might want
different thresholds. The Madeira effect in ``MapboxMap.tsx`` feeds this
straight into a ``DepthWireframeStreamer``'s own ``onProgress``, which
does its own throttling:

- A new chunk is only fetched once the camera has traveled at least
  ``stepDistanceM`` (default 2000m) past the position the last chunk was
  centered on -- not every frame, which would mean hundreds of requests
  per second.
- Each chunk still spans ``2 * chunkHalfSpanDeg`` (default 0.03°, ~3km)
  across, same as the original static chunk -- stepping by less than a
  full chunk's width means consecutive chunks overlap, so there's
  continuous coverage with no visible gap while the next one is still
  loading.
- At most ``maxChunks`` (default 4) stay loaded at once -- a sliding
  window, not an ever-growing pile. Once a new chunk is added past that
  limit, the oldest one is disposed (layer removed, geometry disposed).
  Chunks are added in the order the camera -- which never backtracks
  along the path -- visits them, so "oldest added" and "furthest behind
  the camera" are always the same chunk; a plain FIFO queue is enough,
  no distance bookkeeping needed to decide what to drop.
- A single in-flight ``pending`` flag prevents overlapping fetches --
  deliberately simple for a first version (see "Known limitations"
  below for what real prefetching would add).

Pacing: Madeira needed its own duration, not Tapajós's
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Both flights originally shared ``FLYTHROUGH_DURATION_MS``. Madeira's
path (~1014km) is about 3.5x longer than Tapajós's (~292km), so the same
total duration meant Madeira's camera moved roughly 3.5x faster -- this
is what "going a little too fast" actually was, confirmed by computing
both paths' real cumulative distance. Fixed with a separate
``MADEIRA_FLYTHROUGH_DURATION_MS`` /
``NEXT_PUBLIC_MADEIRA_FLYTHROUGH_DURATION_MS`` (default 150 seconds,
versus Tapajós's 45) -- a deliberately independent pacing knob rather
than deriving one duration from the other's speed, since literally
matching speeds would stretch Madeira's flight to several minutes,
which may not suit every use of this demo either.

Known limitations
-------------------

This is explicitly a demo/test of the concept, not a finished feature:

- **Two rivers, both hardcoded, no river picker.** Tapajós and Madeira
  are each a dedicated button/path/data-source wired by hand, not one
  flexible "pick a river" feature. A third river would mean repeating
  that wiring again (and ideally a real ``river`` field on cross-section
  features instead of the node-id-prefix convention this and other code
  already lean on).
- **No visual progress indicator.** Either flight can be started again
  (restarting cleanly) but there's no on-screen "flying... 40%" state or
  a way to pause/stop it early beyond re-triggering or navigating away.
- **No terrain/3D buildings.** The pitch tilt is real (confirmed by
  reading back ``map.getPitch()`` during the flight) and visible as a
  horizon once zoomed in or over open water, but the base map style has
  no elevation data, so the "flying over terrain" feel is mostly carried
  by the raster/water content in view, not true 3D relief.
- **Tapajós's riverbed wireframe is still one static chunk, not a
  camera-following one.** It's placed near the flight's starting node and
  stays there for the whole flight -- Madeira's is the one that streams
  (see `Madeira flythrough: real PostGIS data, not a raster`_ and
  `Progressive chunk streaming (Madeira)`_ below); porting that to
  Tapajós would mean the same streaming manager driven by
  ``fetchDepthChunkFromRaster`` instead, which is possible but hasn't
  been done -- each raster-crop fetch costs a TiTiler round trip plus a
  server-side GeoTIFF decode, materially more expensive per chunk than
  Madeira's single indexed Postgres query, so it needs its own
  pacing/step-size tuning rather than reusing Madeira's defaults as-is.
- **Madeira's streaming is fetch-as-you-go, not prefetched ahead of the
  camera.** A new chunk is only requested once the camera has already
  traveled far enough past the last one's center -- there's no attempt
  to anticipate the camera's direction and start fetching early, and no
  de-duplication beyond a single in-flight-request flag (a slow fetch
  just means that progress tick's check is skipped, not queued). Fine
  at the current pacing/step-size; would need real prefetching to stay
  smooth at a much faster flight speed or a much coarser step size.
- **Tapajós's ``slug``/bounds, and Madeira's bounds, are hardcoded** to
  one known bathymetry frame and each flight's start node, in
  ``MapboxMap.tsx`` -- Tapajós's isn't derived from whatever frame
  ``ForecastDrawer`` actually has active.
