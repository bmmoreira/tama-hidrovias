River Cross-Section Flow
==========================

The following diagrams illustrate how ``crossSectionClusterLayer.ts``
clusters river transversal-section points (Madeira and Tapajós, as of
this writing) on the public map, and how clicking one leads to a
bathymetric profile chart in ``CrossSectionModal``.

Data
-----

Unlike SWOT gauges and stations (fetched from Strapi), this layer's data
is static reference data checked into the repo and served as plain files
under ``web/public/geojson/``, the same convention already used for
``rivers.geojson``/``subbacias.geojson``:

- ``output_points_water_level.geojson`` -- 476 SWORD-derived point
  features: 377 along the Madeira basin, 99 along the Tapajós. **One
  file for every river**, not one per river -- see `Adding Another
  River`_ below. Each feature's properties carry ``sword_node_id``,
  ``sword_reach_id``, ``sword_width``, ``sword_dist_out``, a ``file``
  name, ``water_level`` (the station's measured water-surface
  elevation, in meters), and the precomputed ``cota_leito_maxima``/
  ``cota_leito_media`` pair used for the map marker's own color/label
  -- see `Circle Styling: Size, Color, and the Metric Selector`_.
- ``secoes_transversais/<file>`` -- one profile per point, from either
  river, in the same flat directory: two tab-separated columns, no
  header (distance along the section in meters, then the elevation in
  meters at that point). ``nan`` marks a NoData pixel and becomes a gap
  in the chart rather than a false zero.

Source data lives in ``assets/output_points_water_level.geojson`` and
``assets/secoes_transversais/`` (see ``LEIA_ME.txt`` there for the exact
raster/processing provenance); the ``web/public/geojson/`` copies are
what the browser actually fetches.

Adding Another River
~~~~~~~~~~~~~~~~~~~~~~

``crossSectionClusterLayer.ts`` and ``CrossSectionModal`` have no notion
of "which river" a point belongs to -- they just cluster and plot
whatever ``CrossSectionFeatureProperties`` they're given (see `Endpoints
and Backend`_). That's why Tapajós was added by **merging** its 99
points into the existing ``output_points_water_level.geojson`` rather
than shipping a second geojson file and teaching the app to fetch both:
one source, one fetch, zero app code changes. A per-river source export
will rarely already match that shape exactly, though -- when adding
another river, check for the same two gotchas the Tapajós merge hit:

- **Property schema.** A fresh SWORD export tends to carry the *entire*
  raw join (``sword_x``, ``sword_wse``, ``sword_facc``, ``fid``, and
  two to three dozen more) rather than the clean shape
  ``CrossSectionFeatureProperties`` expects. Normalize down to exactly
  ``sword_node_id``, ``sword_reach_id``, ``sword_width``,
  ``sword_dist_out``, ``file``, ``water_level`` before merging --
  Tapajós's raw export didn't even have a ``file`` field, which was
  derived as ``f"{int(sword_node_id)}_{int(sword_dist_out)}.txt"``
  (confirmed against the actual ``.txt`` filenames already present, not
  assumed from the naming description alone). Afterward, re-run
  ``scripts/compute_cross_section_stats.py`` -- it fills in
  ``cota_leito_maxima``/``cota_leito_media`` for every point
  (idempotent, so it's safe to just always re-run after any point or
  profile change) and prints which ``file`` references, if any,
  couldn't be resolved to a real profile instead of failing silently.
- **Coordinate reference system.** GeoJSON's own spec assumes WGS84
  lon/lat, and Mapbox GL renders it that way unconditionally -- but a
  raw raster-processing export is frequently still in whatever
  projected CRS the raster itself used (Tapajós shipped in UTM 21S /
  EPSG:32721; Madeira's existing file was already WGS84). A top-level
  ``"crs"`` member naming something other than ``CRS84``/``EPSG:4326``,
  or coordinate values in the hundreds of thousands/millions instead of
  small lon/lat degrees, is the tell. Reproject with ``pyproj`` (already
  a ``pipeline/venv`` dependency) before merging -- getting this wrong
  doesn't error, it just silently plots every point for that river in
  the wrong place (or off the visible map entirely).

Endpoints and Backend
-----------------------

Unlike every other data flow catalogued in :doc:`../api`, this feature
has **no backend at all** -- no Next.js API route, no Strapi content
type, no database. Both requests the browser makes are plain static
file ``GET``\ s, served directly by Next.js from ``web/public/``:

.. list-table::
   :header-rows: 1
   :widths: 45 25 30

   * - URL
     - Method
     - Served from
   * - ``/geojson/output_points_water_level.geojson``
     - ``GET``
     - ``web/public/geojson/output_points_water_level.geojson``
   * - ``/geojson/secoes_transversais/<file>``
     - ``GET``
     - ``web/public/geojson/secoes_transversais/<file>``

Both are fetched with the browser's own ``fetch()`` (via SWR), not
through ``web/src/lib/strapi.ts`` or any ``proxyStrapiRequest`` call --
there's nothing to proxy, and nothing to authenticate. The point list is
fetched once, eagerly, when ``/map`` loads (``map/page.tsx``'s own SWR
hook, alongside rivers/basins). Each profile is fetched lazily, only when
its modal actually opens, keyed by the file path so SWR caches a
re-opened profile instead of re-fetching it (``CrossSectionModal``'s own
``useSWR`` call, gated on ``open && file``).

Because there's no backend, there's also no way to update this data at
runtime -- the whole feature reflects whatever's checked into the repo
under ``web/public/geojson/`` at build/deploy time. To ship revised
station coordinates, water levels, or profiles, replace those files (see
`Updating the Data`_) and redeploy the ``web`` app; no Strapi content
migration, database change, or CMS entry is involved.

Updating the Data
~~~~~~~~~~~~~~~~~~

1. Replace ``assets/output_points_water_level.geojson`` and/or the
   relevant files in ``assets/secoes_transversais/`` with the new
   source data.
2. Copy the same files into ``web/public/geojson/`` (this is a manual
   sync step, not an automated build step -- see `Data`_ above for why
   the two copies exist).
3. Run ``pipeline/venv/bin/python scripts/compute_cross_section_stats.py``
   to (re)fill ``cota_leito_maxima``/``cota_leito_media`` on every point
   in both copies -- the map marker styling described in `Circle
   Styling: Size, Color, and the Metric Selector`_ depends on these
   being present and up to date with whatever profile data is current.
4. If the point count or any ``CrossSectionFeatureProperties`` field
   changed shape, update the type in ``crossSectionClusterLayer.ts`` to
   match, and grep the codebase for any now-removed field (this
   happened when a prior data revision dropped ``fid`` and added
   ``water_level`` -- see the changelog entry for that swap).
5. Run ``npx tsc --noEmit`` in ``web/``, then manually verify in a
   browser: the layer still clusters, a popup opens with sane values,
   and the profile chart renders correctly for a station with terrain
   both above and below its water line (the most informative case to
   eyeball, since it exercises the water-fill band described in
   `Chart Rendering Details`_).

Architecture Diagram
---------------------

.. mermaid::

    graph TD
        subgraph Data ["Static files (web/public/geojson/)"]
            Points[output_points_water_level.geojson]
            Profiles[secoes_transversais/*.txt]
        end

        subgraph Page ["map/page.tsx"]
            SWR[SWR fetch]
        end

        subgraph Layer ["crossSectionClusterLayer.ts"]
            Source[[Mapbox GeoJSON Source<br/>cluster: true]]
        end

        subgraph MB ["MapboxMap.tsx"]
            Popup[Cross-section popup]
            Modal[CrossSectionModal]
        end

        Points --> SWR
        SWR -->|crossSectionFeatures prop| Source
        Source --> Clusters[Cluster circles + count]
        Source --> Unclustered[Individual points]
        Clusters -->|click| Zoom[getClusterExpansionZoom<br/>then map.easeTo]
        Unclustered -->|click| Popup
        Popup -->|Ver perfil da seção| Modal
        Modal -->|fetch on open, by feature.file| Profiles

Sequence Diagram
-----------------

.. mermaid::

    sequenceDiagram
        autonumber
        actor User
        participant Page as map/page.tsx
        participant MB as MapboxMap
        participant Layer as crossSectionClusterLayer
        participant Popup as Cross-section popup
        participant Modal as CrossSectionModal

        Page->>Page: SWR fetch output_points_water_level.geojson
        Page->>MB: crossSectionFeatures prop
        MB->>Layer: addCrossSectionLayers(map)
        MB->>Layer: attachCrossSectionLayerInteractions(map, handlers)
        MB->>Layer: updateCrossSectionLayerData(map, features)
        Layer-->>User: Renders amber cluster circles / points

        alt User clicks a cluster
            User->>Layer: click on cluster circle
            Layer->>Layer: source.getClusterExpansionZoom(clusterId)
            Layer->>MB: map.easeTo({center, zoom})
        else User clicks an individual point
            User->>Layer: click on point
            Layer->>MB: handlers.onSectionClick(feature)
            MB->>Popup: setCrossSectionPopup({feature})
            Popup-->>User: Shows node/water_level/width/distance card

            User->>Popup: Clicks "Ver perfil da seção"
            Popup->>MB: setCrossSectionModalFeature(feature)
            MB->>Modal: open=true, feature
            Modal->>Modal: SWR fetch secoes_transversais/<file>
            Modal->>Modal: parseProfile (distance, elevation pairs)
            Modal->>Modal: useLayoutEffect reads rendered y=water_level / x=deepest pixel
            Modal-->>User: Renders auto-scaled elevation chart + boat at the deepest point
        end

Chart Rendering Details
-------------------------

``CrossSectionModal``'s chart went through several rounds of fixes that
are easy to accidentally regress, since each one is invisible unless you
happen to test the specific data shape it addresses. This section exists
so a future change doesn't quietly undo one of them.

Axis domains -- ``dataMin``/``dataMax``, not left unset
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Both ``XAxis`` and ``YAxis`` set ``domain={['dataMin', 'dataMax']}``
explicitly. This is **not** the same as leaving ``domain`` unset:
Recharts' own implicit default for a numeric axis still pads/nices the
domain even with no ``domain`` prop at all, which caused two distinct,
separately-discovered bugs before this was in place:

- **Y axis**: without an explicit domain, Recharts padded downward to
  include 0, so every profile's chart started at an artificial "sea
  level" instead of the section's own lowest measured point -- visually
  fine for sections that never go near 0, actively wrong (extra blank
  space, wrong-looking scale) for ones that do.
- **X axis**: same padding, horizontally -- the profile's line/fill
  stopped short of the chart's right edge, and the last tick rounded up
  to a "nice" number (e.g. ``2200 m``) instead of the section's real
  measured width (``2183 m``).

``['dataMin', 'dataMax']`` are Recharts' special domain tokens for
"use the exact data extent, no padding."

Water-surface reference line and the boat's position
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The dashed water-surface line is a plain ``<ReferenceLine
y={feature.properties.water_level} .../>`` -- the station's own measured
value, not a constant. Because the Y domain auto-scales per profile (see
above), the same ``water_level`` number lands at a different pixel row
on every section, so the floating boat can't be positioned from a fixed
offset. A ``useLayoutEffect`` reads back Recharts' own rendered line
position after every render, via the stable
``recharts-reference-line-line`` CSS class Recharts attaches to the line
it draws (confirmed by inspecting the live DOM, not assumed from
documentation), and a ``ResizeObserver`` keeps that measurement correct
across window resizes.

The boat itself is a plain HTML ``<div>`` overlay, positioned with
``top: waterLineTop`` and centered/flipped above that anchor via
``translate(-50%, -100%)`` -- deliberately **not** nested inside the
chart's SVG. Earlier iterations tried rendering the boat as an SVG
``<g>`` inside the ``ReferenceLine``'s own ``label`` render prop, which
worked in automated Chromium testing but drifted visibly on real
Chrome/Brave: rotating an SVG element around its own center needs CSS
``transform-box: fill-box``, which has inconsistent cross-browser
support, so a browser that doesn't honor it rotates around the wrong
pivot (the chart's own SVG viewport origin) and can swing the icon well
past any fixed clearance buffer. A plain HTML element has no such
ambiguity -- CSS rotation around "center" just works everywhere -- which
is also why the welcome screen's identical boat animation never hit this
problem: it was already a plain ``<div>``.

Boat's horizontal position -- anchored at the deepest point
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The boat originally just sat at a fixed ``left: 50%`` -- the chart's
horizontal center, regardless of the profile's actual shape. That reads
fine for a roughly symmetric channel, but for a lopsided section (the
deep part of the channel well off to one side) it puts the boat floating
over a riverbank instead of over water. It now anchors horizontally at
the profile's own deepest point instead:

.. code-block:: ts

   const deepestDistance = useMemo(() => {
     let best: ChartPoint | null = null;
     for (const point of chartData) {
       if (point.depth !== null && (best === null || point.depth < best.depth!)) {
         best = point;
       }
     }
     return best?.distance ?? null;
   }, [chartData]);

"Deepest" means the **lowest** ``depth`` (bed elevation) value, not the
highest -- this data is raw elevation, not a positive-down depth, so (per
`Axis domains -- dataMin/dataMax, not left unset`_ above) the lowest
number is physically the deepest point of the channel, same as the Y
axis's own non-reversed reading. A plain linear scan finds it in one pass
over ``chartData``, skipping ``null`` (NoData) points -- there's no need
for anything fancier since a profile is at most a few hundred points.

Getting from that ``distance`` value to an actual pixel ``left`` offset
needs the same "read back Recharts' own rendered position" technique
already used for ``waterLineTop``, for the identical reason: the X domain
also auto-scales per profile (``dataMin``/``dataMax``), so the same
distance value lands at a different pixel column on every section. There
is no public prop that hands this back directly, so the component adds a
second, invisible ``<ReferenceLine x={deepestDistance} stroke="none"
.../>`` purely as a measurement hook -- Recharts still computes and
renders its ``x1``/``x2`` attributes via the ``recharts-reference-line-line``
class, they're just not stroked. The same ``useLayoutEffect`` that reads
``waterLineTop`` from the water line's ``y1`` also reads ``deepestLeft``
from this line's ``x1``.

With two ``ReferenceLine``\ s now in the chart, each gets its own
``className`` (``cross-section-water-line`` / ``cross-section-deepest-line``)
so the two queries scope to
``.cross-section-water-line .recharts-reference-line-line`` and
``.cross-section-deepest-line .recharts-reference-line-line`` respectively,
rather than both matching the same unscoped ``.recharts-reference-line-line``
selector and silently reading whichever line happens to come first in
DOM order. Recharts forwards a ``className`` prop onto the ``<g>``
wrapper it renders around the line (confirmed by reading
``ReferenceLine.js`` in ``node_modules``, not assumed), which is what
makes this scoping work.

The boat's wrapper ``<div>`` then reads ``style={{ top: waterLineTop,
left: deepestLeft }}``, falling back to ``CHART_TOP_MARGIN`` / ``'50%'``
respectively before the first measurement lands (avoiding a one-frame
flash at the SVG origin).

Two-color area fill (riverbed vs. water)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The chart renders two stacked ``Area`` series, not one:

- ``depth`` (amber/brown) -- the raw terrain profile, filled from the
  axis bottom up to the terrain line. This is the riverbed/bank
  material and is drawn the same way regardless of ``water_level``.
- ``waterBand`` (blue), rendered *after* ``depth`` so it layers on top --
  a derived field computed in the same ``useMemo`` as ``chartData``,
  from the raw profile plus ``water_level``:

  .. code-block:: ts

     waterBand:
       point.depth !== null && point.depth < waterLevel
         ? [point.depth, waterLevel]
         : null

  When a ``dataKey`` resolves to a 2-tuple ``[low, high]``, Recharts
  fills *between* those two values instead of from the axis baseline --
  this is what lets ``waterBand`` paint only the submerged part of the
  channel, not the whole area under the water line. ``null`` on exposed
  banks (terrain at or above ``water_level``) combined with
  ``connectNulls={false}`` keeps those stretches a real gap in the water
  fill, rather than bridging blue across dry land.

The ``Tooltip``'s ``formatter`` has to handle both series' different
value shapes (a plain number for ``depth``, a 2-tuple for
``waterBand``) -- naively calling ``.toFixed()`` on whichever value
Recharts happens to pass would throw for the array case the first time
a user hovered a submerged point.

Responsive layout: fullscreen on mobile
-----------------------------------------

Below Tailwind's ``sm`` breakpoint (640px), the modal and its chart
behave differently in three ways, all gated by the same
``useIsNarrowScreen`` hook (a ``window.matchMedia('(max-width: 639px)')``
check with a live ``change`` listener, not a CSS media query -- see
below for why):

- **The modal itself goes fullscreen.** ``DialogContent`` gets a
  responsive ``className`` (via ``cn(...)`` / ``tailwind-merge``) that's
  edge-to-edge, unrounded, and borderless below ``sm`` (``inset``-style
  positioning, ``h-[100dvh]``, ``w-screen``, ``rounded-none``,
  ``border-0``), and reverts to the original centered, rounded,
  max-width card at ``sm`` and up. ``100dvh`` (dynamic viewport height),
  not ``100vh``, so the modal doesn't get cut off under a mobile
  browser's collapsing address bar.
- **The chart card grows to fill the remaining space.** The content
  wrapper, the chart ``Card``, its ``CardContent``, and the chart's own
  wrapper ``<div>`` all become a ``flex flex-1 flex-col`` chain below
  ``sm`` (reverting to fixed heights at ``sm`` and up), so on a short
  profile's popup the chart genuinely fills whatever vertical space the
  header and stat cards don't use, instead of sitting at a fixed
  ``h-72`` regardless of how much room is actually available.
- **The Y-axis label is dropped, and the chart's own side margins tighten
  further.** Recharts' ``YAxis label`` prop is plain SVG, not a DOM
  element, so it can't be toggled with a ``hidden sm:block`` class --
  it's set to ``undefined`` outright when ``isNarrowScreen``. The
  ``CardTitle`` states both axes' units instead (``"... distância (m) ×
  cota do leito (m)"``) so that information isn't lost. The
  ``AreaChart``'s ``margin.left``/``margin.right`` also go more negative
  on narrow screens, reclaiming the horizontal space the now-hidden label
  would have reserved -- the chart is the entire point of the fullscreen
  mobile modal, so it should use all the width it can get.

Why a JS hook and not a CSS breakpoint for the Y-axis label: Recharts
renders ``label`` as SVG text as part of the chart's own render pass, not
as a DOM element you could separately show/hide with Tailwind's
responsive classes -- the chart has to actually be told not to render it
at all, which means a render-time boolean, which means knowing the
viewport width in JS.

Circle Styling: Size, Color, and the Metric Selector
-------------------------------------------------------

Individual (unclustered) cross-section points on the map aren't plain
dots -- each is a colored circle with a value label on top, both driven
by one of two precomputed, per-point metrics the visitor can switch
between live. Cluster circles are unaffected by any of this: they still
just show a point count via Mapbox's native ``step`` color/radius
expressions on ``point_count``, same as before (see the `Data`_ section
above's own note on why no per-cluster aggregate is computed here, same
reasoning as station clusters).

Precomputed metrics, not runtime aggregation
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The two selectable metrics -- ``cota_leito_maxima`` (max bed elevation)
and ``cota_leito_media`` (mean) -- are properties baked onto every
feature in ``output_points_water_level.geojson`` by
``scripts/compute_cross_section_stats.py``, **not** computed in the
browser. This has to happen ahead of time: computing either value
means reading a point's full ``secoes_transversais/<file>`` profile, and
``CrossSectionModal`` deliberately only fetches one profile at a time,
lazily, when its own modal opens (see `Endpoints and Backend`_) --
fetching all ~500 profile files just to color map markers would defeat
that design entirely. The script is idempotent and documented in
`Updating the Data`_ above; it needs re-running any time point or
profile data changes.

Color ramp: a data-driven Mapbox expression, not per-feature JS
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Unlike ``swotGaugeClusterLayer.ts`` (which bakes a computed color onto
each feature in JS before pushing it into the source, because its
cluster aggregates need an exact median that Mapbox's own clustering
can't compute), cross-section clusters don't need a value at all --
only individual points do, and Mapbox's native ``cluster: true`` source
already keeps every unclustered feature's raw properties intact. That
means the color can be a plain Mapbox ``interpolate`` style expression
evaluated directly against ``['get', metric]``, with no per-feature
JS computation required:

.. code-block:: ts

   ['interpolate', ['linear'], ['get', metric], min, COLOR_LOW, max, COLOR_HIGH]

``min``/``max`` are the selected metric's actual range across whatever
features are currently loaded (not a fixed domain -- Madeira and
Tapajós have very different elevation ranges, so a shared hardcoded
scale would wash one of them out; see `Adding Another River`_). Both
the color expression and the value-label text layer are rebuilt via
``map.setPaintProperty``/``setLayoutProperty`` inside
``updateCrossSectionLayerData`` every time the data *or* the selected
metric changes -- the function takes ``metric`` as a parameter precisely
so ``MapboxMap.tsx`` can re-run it from a single ``useEffect`` keyed on
both dependencies, rather than needing two different update paths.

Color defaults to the exact same green ``ForecastLegend.tsx`` already
uses for the SWOT gauge legend's positive-value ramp (``#bbf7d0`` →
``#15803d``) -- reused as-is, not reinvented, since "cota do leito" is a
plain, non-diverging elevation with no natural negative pole to ramp
toward SWOT's red the way a water-level anomaly has. Both stops, the
circle's radius, and the default metric are all tunable via
``.env`` (``NEXT_PUBLIC_CROSS_SECTION_COLOR_LOW``/``_HIGH``,
``NEXT_PUBLIC_CROSS_SECTION_CIRCLE_RADIUS``,
``NEXT_PUBLIC_CROSS_SECTION_DEFAULT_METRIC``).

The metric selector
~~~~~~~~~~~~~~~~~~~~~

The segmented "Cota do leito máxima / média" control lives in the
**Filtros** drawer (``SwotFilterDrawer.tsx``, despite the name -- see
below), mirroring the exact visual pattern of that same component's own
(currently feature-flagged off) SWOT metric selector: a small grid of
toggle buttons, the active one highlighted. Two differences from the
SWOT version are deliberate:

- It's **always visible** when any cross-section data is loaded, not
  gated behind an env flag the way ``SWOT_METRIC_SELECTOR_ENABLED``
  gates SWOT's -- this was a directly requested, finished feature, not
  an experimental one.
- It renders **outside** the ``opacity-40``-when-hidden wrapper that
  contains all the SWOT-specific filter controls, since cross-section
  circle styling has nothing to do with the "Exibir estações no mapa"
  (SWOT visibility) toggle and shouldn't dim along with it.

Putting a cross-section control inside a component literally named
``SwotFilterDrawer`` needed one real fix, not just a new section: that
component had a ``if (totalCount === 0) return null`` guard where
``totalCount`` only ever counted SWOT features -- on a map with
cross-section data but zero SWOT gauges, the whole drawer (and the
Filtros button that opens it) would have silently never rendered at
all. The guard now also checks a new ``hasCrossSection`` prop before
bailing out.

Legend
~~~~~~~

``ForecastLegend.tsx`` grew a third optional section (next to its
existing SWOT and forecast-colormap ones), shown whenever
``crossSectionFeatures`` is non-empty: the same two-stop gradient bar
style as the SWOT rows, labeled with the selected metric's actual
min/max (computed the same way the color expression's domain is, from
the currently loaded features) and its display name. All three legend
sections can coexist; the component's divider logic accounts for every
combination of which sections are present, not just the original
SWOT/forecast pair.
