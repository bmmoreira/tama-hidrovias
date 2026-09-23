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
            Modal->>Modal: useLayoutEffect reads rendered y=water_level pixel
            Modal-->>User: Renders auto-scaled elevation chart + boat on the water line
