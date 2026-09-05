SWOT Gauge Clustering Flow
===========================

The following diagrams illustrate how ``SwotGaugeClusterLayer`` turns SWOT
gauge features into clustered triangles on the map, how the "Métrica
visualizada" selector changes what's displayed, and how a click branches
into either a cluster zoom or the gauge details popup. See
:doc:`../station-clustering` for the full prose writeup this flow is drawn
from -- this page focuses on the diagrams.

Architecture Diagram
---------------------

This diagram shows how gauge data reaches the map, and how the
``supercluster`` index sits between the raw features and what Mapbox
actually renders.

.. mermaid::

    graph TD
        subgraph Data ["Data (React)"]
            SWR[SWR: swotGaugeFeatures]
            Filter[SwotFilterDrawer<br/>metric: Change / std / median]
        end

        subgraph Layer ["SwotGaugeClusterLayer plain class"]
            Idx[(supercluster Index)]
            Render[render]
        end

        subgraph MapboxLayer ["Mapbox GL"]
            Source[[GeoJSON Source<br/>swot-gauges-source]]
            SymLayer[Symbol Layer<br/>swot-gauges]
        end

        SWR -->|setFeatures| Idx
        Filter -->|setMetric| Render
        Idx -->|getClusters by bbox and zoom| Render
        Idx -->|getLeaves per cluster<br/>then median of values| Render
        Render -->|setData FeatureCollection| Source
        Source --> SymLayer
        SymLayer -->|click| Branch{is a cluster?}
        Branch -->|yes| Zoom[getClusterExpansionZoom<br/>then map.easeTo]
        Branch -->|no| Popup[onGaugeClick handler<br/>opens gauge popup]
        Zoom -.->|triggers| MoveEnd[map moveend event]
        MoveEnd --> Render

Sequence Diagram
-----------------

This sequence diagram covers the full lifecycle: initial mount, data
arriving, re-rendering on pan/zoom, switching the visualized metric, and
the two click outcomes (cluster vs. individual gauge).

.. mermaid::

    sequenceDiagram
        autonumber
        actor User
        participant Drawer as SwotFilterDrawer
        participant MB as MapboxMap
        participant Layer as SwotGaugeClusterLayer
        participant Idx as supercluster Index
        participant Map as Mapbox GL Map

        MB->>Map: map.on('load')
        Map-->>MB: fires
        MB->>Layer: new SwotGaugeClusterLayer(map, handlers)
        Layer->>Map: addImage(triangle-up/down, {sdf: true})
        Layer->>Map: addSource + addLayer (swot-gauges)
        Layer->>Map: on('moveend', render)

        Note over MB: swotGaugeFeatures resolves via SWR
        MB->>Layer: setFeatures(features)
        Layer->>Idx: new Supercluster().load(features)
        Layer->>Layer: render()
        Layer->>Idx: getClusters(bbox, zoom)
        loop each cluster feature
            Layer->>Idx: getLeaves(clusterId, Infinity)
            Layer->>Layer: median(leaf values for metric)
        end
        Layer->>Map: source.setData(FeatureCollection)
        Map-->>User: Renders triangles (color/shape/label per feature)

        User->>Map: Pans or zooms the map
        Map->>Layer: 'moveend' event
        Layer->>Layer: render() (recompute clusters + medians)
        Layer->>Map: source.setData(FeatureCollection)

        User->>Drawer: Selects a different metric (e.g. Mediana)
        Drawer->>MB: onFilterChange({ metric: 'median' })
        MB->>Layer: setMetric('median')
        Note over Layer: Index is NOT reloaded --<br/>only the displayed value changes
        Layer->>Layer: render()
        Layer->>Map: source.setData(FeatureCollection)

        alt User clicks a cluster
            User->>Map: click on cluster triangle
            Map->>Layer: click handler (feature.properties.cluster = true)
            Layer->>Idx: getClusterExpansionZoom(clusterId)
            Layer->>Map: map.easeTo({center, zoom})
            Map->>Layer: 'moveend' fires again
            Layer->>Layer: render()
        else User clicks an individual gauge
            User->>Map: click on gauge triangle
            Map->>Layer: click handler (feature.properties.cluster = false)
            Layer->>MB: handlers.onGaugeClick(feature)
            MB->>User: setGaugePopup({feature}) -- opens rich popup
        end
