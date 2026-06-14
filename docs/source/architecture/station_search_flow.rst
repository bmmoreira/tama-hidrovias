Station Search and Details Flow
===============================

This page documents how the shared station explorer opens the station search
panel, renders the feature-backed station list, moves the map camera to a
selected feature, and loads SWOT measurements for that feature. The flow begins
on a map route and involves the
``StationExplorerOverlay`` component, the ``useStationExplorer`` controller
hook, the ``StationSearchPanel`` list, and API helpers in ``web/src/lib/strapi.ts``.

Runtime Files
-------------

The current implementation is split across these frontend files:

- ``web/src/components/maps/StationExplorerOverlay.tsx``
- ``web/src/components/maps/useStationExplorer.ts``
- ``web/src/components/StationSearchPanel.tsx``
- ``web/src/components/StationChart.tsx``
- ``web/src/lib/strapi.ts``

Map routes create one station explorer controller with ``useStationExplorer()``
and pass it into ``StationExplorerOverlay``. The search panel uses the Strapi
``Map Feature Collection`` single type as the searchable station catalog. The
time-series match is made against the Strapi ``SWOT Measurement`` collection,
where the GeoJSON feature ``Codigo`` value is used as
``swot-measurement.station_id``.

Mounting Model
--------------

The station search panel is mounted as part of the overlay, not only after the
user clicks the search button.

``StationExplorerOverlay`` always renders:

.. code-block:: tsx

   <StationSearchPanel
     isOpen={controller.panelOpen}
     onClose={controller.closePanel}
     onFeatureSelect={controller.selectFeature}
   />

The search button only calls ``controller.openPanel``:

.. code-block:: tsx

   <button onClick={controller.openPanel}>
     ...
   </button>

Inside ``useStationExplorer``, ``openPanel`` sets ``panelOpen`` to ``true``.
That boolean is then passed back into ``StationSearchPanel`` as ``isOpen``.
The panel uses ``isOpen`` to choose Tailwind transform classes:

- open: ``translate-y-0 md:translate-x-0``
- closed: ``translate-y-full md:translate-y-0 md:-translate-x-full``

So the React component is already mounted while closed; it is hidden off-screen
and slides into view when ``panelOpen`` becomes ``true``.

Feature-Backed Station List Data
--------------------------------

``StationSearchPanel`` owns the list data request. It uses SWR with a stable
cache key:

.. code-block:: ts

   const { data, isLoading } = useSWR(
     'map-feature-collection-search',
     () => getMapFeatureCollection(),
     { revalidateOnFocus: false },
   );

Because the panel is mounted with the overlay, this request can start when the
overlay mounts, before the user opens the panel. Opening the panel reveals the
already-mounted UI and either shows loading placeholders, an empty state, or the
filtered feature buttons.

``getMapFeatureCollection()`` is defined in ``web/src/lib/strapi.ts``. In the
browser it calls the internal Next.js route ``/api/map-feature-collections``,
which proxies to the Strapi public route for the current Map Feature Collection
single type.

The panel normalizes each point feature into a small search target:

- ``name`` from ``name``, ``Name``, ``nome``, or ``Nome``
- ``fid`` from ``fid``, ``FID``, ``id``, or ``ID``
- ``code`` from ``codigo``, ``Codigo``, ``code``, or ``Code``; this is the value
  used to match ``SWOT Measurement.station_id``
- ``longitude`` and ``latitude`` from the GeoJSON point coordinates
- optional ``source``, ``satellite``, ``river``, ``basin``, date, value, change,
  and anomaly metadata when present

Filtering is currently client-side:

- the text query matches feature ``name``, ``code``, or ``fid``
- source and variable filters are intentionally not shown in this panel because
  the source data is a free-form GeoJSON feature collection rather than the
  Strapi station collection

Selecting A Feature
-------------------

When a feature button is clicked in the search panel, the panel calls both:

- ``onFeatureSelect(feature)``, provided by the overlay as
  ``controller.selectFeature``
- ``onClose()``, provided by the overlay as ``controller.closePanel``

``controller.selectFeature`` reuses the hook's ``focusFeature`` behavior and
then closes the search panel. ``focusFeature`` calls the optional
``onFeatureFocus`` callback supplied by the map route, stores the selected
feature, and opens the details modal.

Map pages use ``onFeatureFocus`` to move the map camera to the feature's
longitude and latitude.

SWOT Details And Chart
----------------------

``StationExplorerOverlay`` renders ``StationDetailsModal`` when
``controller.selectedFeature`` is set and ``controller.detailOpen`` is true. The
modal receives the feature target as ``StationPopupData``. Its ``code`` field is
the normalized GeoJSON ``Codigo``.

``StationDetailsModal`` uses that code to request SWOT data:

.. code-block:: text

   GET /api/swot-measurements?filters[station_id][$eq]={Codigo}&sort[0]=datetime:asc&pagination[pageSize]=1000

The Next.js route ``/api/swot-measurements`` proxies the request to the Strapi
public read-only route ``/api/swot-measurements/public``. The matching Strapi
collection is ``SWOT Measurement`` and the matching field is ``station_id``.

How SWOT Chart Data Is Built
----------------------------

The selected chart in ``web/src/components/maps/StationDetailsModal.tsx`` is
rendered from the local ``swotChartData`` array. This array is derived from the
Strapi ``SWOT Measurement`` response and is shaped specifically for Recharts.

The selected feature reaches the modal through this path:

1. ``StationSearchPanel`` reads the Map Feature Collection GeoJSON.
2. Each feature is normalized into a ``StationExplorerFeatureTarget``.
3. The GeoJSON ``Codigo`` property becomes ``feature.code``.
4. ``StationExplorerOverlay`` passes the selected feature into
   ``StationDetailsModal`` as ``StationPopupData``.
5. Inside the modal, ``const code = data?.code`` stores that ``Codigo`` value.

The modal uses SWR for the request:

.. code-block:: ts

   const code = data?.code;
   const { data: swotResponse } = useSWR(
     open && code
       ? `/api/swot-measurements?filters[station_id][$eq]=${code}&sort[0]=datetime:asc&pagination[pageSize]=1000`
       : null,
     (url: string) => fetch(url).then(r => r.json())
   );

Important details:

- SWR receives ``null`` while the modal is closed or while no ``Codigo`` exists,
  so no request is sent in those states.
- When the modal is open and ``code`` exists, the request filters
  ``SWOT Measurement.station_id`` by the selected GeoJSON ``Codigo``.
- ``sort[0]=datetime:asc`` makes the returned measurements chronological, which
  is the order expected by the chart x-axis.
- ``pagination[pageSize]=1000`` allows the modal to draw a long station series
  without making a second request for ordinary station histories.

The Strapi ``SWOT Measurement`` content type currently exposes these relevant
fields:

- ``station_id``: string key matched against GeoJSON ``Codigo``
- ``datetime``: timestamp used for the chart date label and x-axis order
- ``median``: main water-surface value drawn as the primary line
- ``std``: standard deviation used to draw the upper and lower band lines
- ``mean``, ``count``, ``min``, ``max``, and distance fields are returned by the
  API and remain available for future chart/table additions, but the current
  chart does not plot them

``swotChartData`` is memoized so the mapping only reruns when
``swotResponse`` changes:

.. code-block:: ts

   const swotChartData = useMemo(() => {
     if (!swotResponse?.data) return [];
     return swotResponse.data.map((item: any) => {
       const attrs = item.attributes;
       return {
         label: new Date(attrs.datetime).toLocaleDateString(),
         median: attrs.median,
         stdBandTop: attrs.median !== null && attrs.std !== null
           ? attrs.median + attrs.std
           : null,
         stdBandBottom: attrs.median !== null && attrs.std !== null
           ? attrs.median - attrs.std
           : null,
         std: attrs.std
       };
     });
   }, [swotResponse]);

Each returned chart point contains:

- ``label``: localized date string generated from ``attrs.datetime``; this is
  used by ``<XAxis dataKey="label" />``
- ``median``: the central SWOT value; this is drawn by the purple
  ``<Line dataKey="median" />``
- ``stdBandTop``: ``median + std``; this is drawn as the upper dashed standard
  deviation line
- ``stdBandBottom``: ``median - std``; this is drawn as the lower dashed
  standard deviation line
- ``std``: preserved in the chart data for inspection or future tooltip/table
  use

The chart card only renders when there is data:

.. code-block:: tsx

   {swotChartData.length > 0 ? (
     <LineChart data={swotChartData}>
       <XAxis dataKey="label" />
       <YAxis domain={['auto', 'auto']} />
       <Line dataKey="median" />
       <Line dataKey="stdBandTop" />
       <Line dataKey="stdBandBottom" />
     </LineChart>
   ) : null}

This means a feature can still open the details modal even when no matching
SWOT rows exist, but the ``SWOT Measurements`` chart section is hidden until the
API returns at least one matching row.

Legacy Station Chart Path
-------------------------

The old station chart sheet is still rendered only when
``controller.selectedStation`` is set. That path is for code paths that pass a
real Strapi station into ``controller.focusStation`` or ``controller.selectStation``.

The sheet renders ``StationChart`` with:

- ``stationId`` from ``controller.selectedStation.id``
- ``variable`` from ``controller.activeVariable``
- a 30-day ``from`` / ``to`` time window computed by the overlay

Changing one of the variable buttons calls ``controller.setActiveVariable`` and
causes the chart to request the selected variable.

Sequence Diagram
----------------

This diagram illustrates the sequence of events when a user searches for a
feature-backed station, jumps to it on the map, and loads SWOT measurements by
matching ``Codigo`` to ``SWOT Measurement.station_id``.

.. mermaid::

   sequenceDiagram
       actor User
       participant Overlay as StationExplorerOverlay
       participant Hook as useStationExplorer Hook
       participant SearchPanel as StationSearchPanel
       participant DetailsModal as StationDetailsModal
       participant NextAPI as API Server (Next.js)
       participant Strapi as Strapi CMS

       Overlay->>SearchPanel: Mounts with isOpen=controller.panelOpen
       SearchPanel->>NextAPI: GET /api/map-feature-collections
       NextAPI->>Strapi: Fetch Map Feature Collection single type
       Strapi-->>NextAPI: FeatureCollection GeoJSON
       NextAPI-->>SearchPanel: Cached SWR response

       User->>Overlay: Clicks 'Search Stations'
       Overlay->>Hook: controller.openPanel()
       Hook-->>Overlay: Updates state (panelOpen=true)

       activate SearchPanel
       Note over SearchPanel: Mounted panel slides into view

       User->>SearchPanel: Types search query
       SearchPanel->>SearchPanel: Filters cached features by name/fid/codigo
       SearchPanel->>User: Displays filtered results

       User->>SearchPanel: Selects a feature-backed station
       SearchPanel->>Overlay: onFeatureSelect(feature)
       Overlay->>Hook: controller.selectFeature(feature)
       Hook-->>Overlay: Updates state (panelOpen=false, detailOpen=true, selectedFeature=feature)
       Hook-->>Overlay: Calls onFeatureFocus(feature) when configured
       Overlay-->>User: Map route flies to feature longitude/latitude
       deactivate SearchPanel
       Note over SearchPanel: Panel is hidden

       activate DetailsModal
       Overlay->>DetailsModal: Opens with code=feature.Codigo
       DetailsModal->>NextAPI: GET /api/swot-measurements?filters[station_id][$eq]=Codigo
       NextAPI->>Strapi: Fetch SWOT Measurement rows
       Strapi-->>NextAPI: Matching records
       NextAPI-->>DetailsModal: SWOT measurement data
       DetailsModal-->>User: Renders SWOT chart when records exist
       deactivate DetailsModal
