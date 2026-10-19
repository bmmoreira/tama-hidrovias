River Cross-Section Flow
==========================

The following diagrams illustrate how ``crossSectionClusterLayer.ts``
clusters the Madeira river transversal-section points on the public map,
and how clicking one leads to a bathymetric profile chart in
``CrossSectionModal``.

Data
-----

Unlike SWOT gauges and stations (fetched from Strapi), this layer's data
is static reference data checked into the repo and served as plain files
under ``web/public/geojson/``, the same convention already used for
``rivers.geojson``/``subbacias.geojson``:

- ``output_points_water_level.geojson`` -- 377 SWORD-derived point
  features along the Madeira basin. Each feature's properties carry
  ``sword_node_id``, ``sword_reach_id``, ``sword_width``,
  ``sword_dist_out``, a ``file`` name, and ``water_level`` -- the
  station's measured water-surface elevation, in meters.
- ``secoes_transversais/<file>`` -- one profile per point: two
  tab-separated columns, no header (distance along the section in
  meters, then the elevation in meters at that point). ``nan`` marks a
  NoData pixel and becomes a gap in the chart rather than a false zero.

Source data lives in ``assets/output_points_water_level.geojson`` and
``assets/secoes_transversais/`` (see ``LEIA_ME.txt`` there for the exact
raster/processing provenance); the ``web/public/geojson/`` copies are
what the browser actually fetches.

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
3. If the point count or any ``CrossSectionFeatureProperties`` field
   changed shape, update the type in ``crossSectionClusterLayer.ts`` to
   match, and grep the codebase for any now-removed field (this
   happened when a prior data revision dropped ``fid`` and added
   ``water_level`` -- see the changelog entry for that swap).
4. Run ``npx tsc --noEmit`` in ``web/``, then manually verify in a
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
