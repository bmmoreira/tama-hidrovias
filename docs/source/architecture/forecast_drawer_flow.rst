Forecast Drawer Architecture & Flow
===================================

The following diagrams illustrate the architecture and sequence flow for the ``ForecastDrawer`` component when aggregating and animating forecast GeoTIFF images over the map.

Architecture Diagram
--------------------

This diagram shows how the frontend, Next.js API proxy, and the TiTiler service interact.

.. mermaid::

    graph TD
        subgraph Frontend ["Frontend (Browser)"]
            MB[MapboxMap]
            FD[ForecastDrawer]
        end

        subgraph NextAPI ["Next.js Proxy API"]
            AL[List Tiles API<br/>/api/forecast-tiles]
            AM[Metadata API<br/>/api/forecast-tiles/:slug/metadata]
            AT[Tile Proxy API<br/>/api/forecast-tiles/:slug/z/x/y]
        end

        subgraph Backend ["Backend Services"]
            TT[TiTiler Service<br/>/cog/*]
            FS[(File System<br/>assets/tiles/)]
        end

        FD -->|1. Fetch grouped list| AL
        FD -->|2. Fetch metadata| AM
        MB -->|3. Fetch raster tiles| AT

        AL -->|Recursively reads| FS
        AM -->|Proxies info/stats| TT
        AT -->|Proxies tile renders| TT

        TT -->|Reads GeoTIFFs| FS

Sequence Diagram
----------------

This sequence diagram details the process from the user opening the forecast drawer to the tiles rendering on the map, including the subfolder grouping logic.

.. mermaid::

    sequenceDiagram
        autonumber
        actor User
        participant FD as ForecastDrawer (UI)
        participant MB as MapboxMap (UI)
        participant NAPI as Next.js API
        participant FS as File System
        participant TT as TiTiler

        User->>FD: Opens Forecast Drawer
        FD->>NAPI: GET /api/forecast-tiles
        Note over NAPI: Recursively scans assets/tiles
        NAPI->>FS: Reads directories & files
        FS-->>NAPI: Returns file list
        Note over NAPI: Extracts subfolder as "area" tag<br/>Sorts frames by timestamp
        NAPI-->>FD: Returns grouped frames
        
        FD->>FD: Selects active frame
        FD->>NAPI: GET .../:slug/metadata
        NAPI->>TT: GET /cog/info & /cog/statistics
        TT->>FS: Reads TIFF headers
        TT-->>NAPI: Returns bounds & stats
        NAPI-->>FD: Returns recommended min/max & bounds

        FD->>MB: onTileLayerChange(overlayConfig)
        Note over MB: Registers Mapbox raster source & layer
        
        MB->>NAPI: Requests map tiles (Z/X/Y)
        NAPI->>TT: GET /cog/tiles/WebMercatorQuad/...
        TT->>FS: Reads raster data
        TT-->>NAPI: Returns PNG tile
        NAPI-->>MB: Returns PNG tile
        MB-->>User: Renders forecast overlay on map
