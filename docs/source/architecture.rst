Architecture & Diagrams
=======================

This section contains architectural diagrams for the Tama Hidrovias platform,
detailing component interactions, state changes, and system flows.

Station Details Flow
--------------------

The following sequence diagram illustrates the React state transition flow when a user clicks the "View Details" button within a map popup marker. The interaction involves the ``StationPopup``, ``MapBase``, and ``StationDetailsModal`` components.

.. mermaid::

    sequenceDiagram
        autonumber
        actor User
        participant SP as StationPopup (Component)
        participant MB as MapBase (Parent Component)
        participant SDM as StationDetailsModal (Component)

        User->>SP: Clicks "View Details" button
        SP->>MB: Triggers onViewDetails(data) callback
        
        rect rgb(234, 242, 255)
            Note over MB: State Update in MapBase
            MB->>MB: 1. setDetailFeature(popupFeature)
            MB->>MB: 2. setPopupFeature(null)
        end
        
        MB-->>SP: Unmounts / Closes Popup
        MB-->>SDM: Renders & Opens Modal (passes data)
        
        Note over SDM: SDM reads the passed data and<br/>fetches historical & forecast<br/>series from the API
        SDM-->>User: Displays full screen Station Details

When the ``onViewDetails`` callback is triggered, the parent component (``MapBase``) shifts its state. It assigns the station's data to the detail modal while simultaneously clearing the popup state, causing React to immediately unmount the popup and display the detailed modal overlay.
