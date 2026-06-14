Dashboard Customization Report
==============================

Overview
--------

The dashboard now includes explicit role-aware behavior in both the interface
and the server routes that back write operations.

The implementation goal was to stop treating all authenticated users the same
and to make the operational distinction between read-only and write-capable
users visible in the product.

Current Role Levels
-------------------

The active role model used by the dashboard is:

- ``authenticated``
  Default Strapi role and fallback value when role data is unavailable.
  The dashboard should treat this role conservatively.
- ``viewer``
  Read-only profile. Can navigate and inspect data, but should not execute
  writes.
- ``analyst``
  Operational profile. Can execute approved write flows in addition to read
  operations.

Frontend Role Helpers
---------------------

Role normalization and checks are centralized in:

- ``web/src/lib/roles.ts``

This module provides:

- normalized role values
- display labels for the UI
- viewer and analyst checks
- compatibility checks for elevated roles already recognized by the sidebar

Read-only UX Additions
----------------------

To make restricted mode clearer for ``viewer`` users, the dashboard now exposes
several explicit cues:

- ``web/src/components/ReadOnlyBadge.tsx``
  Reusable badge used to label read-only state.
- ``web/src/app/dashboard/layout.tsx``
  Read-only banner rendered at the top of the dashboard content area.
- ``web/src/components/Navbar.tsx``
  Role label plus read-only badge for viewer sessions.
- ``web/src/components/Sidebar.tsx``
  Read-only badge in dashboard navigation context.
- ``web/src/app/dashboard/stations/page.tsx``
  Read-only badge beside the stations page title.

Protected Action Pattern
------------------------

The project now uses a reusable visible-but-disabled action pattern instead of
simply hiding restricted controls.

Reusable component:

- ``web/src/components/ProtectedActionButton.tsx``

Behavior:

- the control stays visible even when the user cannot execute it
- the button is disabled when access is denied
- tooltip text explains the restriction
- helper text can be rendered under the button

This makes the product behavior clearer for read-only users and reduces the
impression that features are missing.

Feedback Pattern
----------------

Station mutations now use toast-style feedback for non-blocking status updates.

- ``web/src/components/Toast.tsx`` provides reusable success and error notifications.
- create, update, and delete actions on the stations screen emit toast feedback.
- destructive delete now uses a custom dashboard confirmation modal before execution.
- ``web/src/components/ConfirmationModal.tsx`` now provides the reusable confirmation shell used directly by destructive dashboard flows.

Current Protected Flows
-----------------------

The current write-protected dashboard flows are station creation, station
editing, station deletion, and map feature collection editing.

UI implementation:

- ``web/src/app/dashboard/stations/page.tsx``
- ``web/src/app/dashboard/map-features/page.tsx``

Current behavior:

- the ``Nova Estacao Virtual`` action is always visible
- only ``analyst`` users can click it
- non-analyst users see the control disabled with explanatory text
- analysts can also edit stations directly from the list
- analysts can delete stations directly from the list
- the station form modal is reused for create and edit flows
- the delete flow uses the shared confirmation modal instead of the browser confirm dialog
- the row being mutated shows a loading label and disables both row actions until completion
- the map feature collection editor lists each GeoJSON feature as a dashboard row
- analysts and admin-capable roles can add a new feature, edit an existing feature, or remove one
- the feature editor modal validates Point coordinates and JSON properties before save
- each save writes the full updated ``featureCollection`` back through the protected internal Next.js route

At the moment, station deletion is the only destructive dashboard flow. Any
future destructive action should reuse ``web/src/components/ConfirmationModal.tsx``
directly to keep the interaction pattern consistent.

Server Enforcement
------------------

UI restrictions are not the only protection layer.

The routes:

- ``web/src/app/api/stations/route.ts``
- ``web/src/app/api/stations/[id]/route.ts``
- ``web/src/app/api/map-feature-collections/route.ts``

enforce the same rule on the server side:

- reads the session role from the NextAuth token
- returns ``403`` for non-analyst ``POST``, ``PATCH``, and ``DELETE`` requests
- returns ``403`` for map feature collection ``PUT`` requests when the caller lacks write access
- forwards authorized requests to Strapi only after that role check passes

This prevents direct browser calls from bypassing the UI restriction.

Strapi Customizations Supporting The Dashboard
----------------------------------------------

The dashboard changes depend on custom behavior in Strapi Users & Permissions:

- ``cms/src/extensions/users-permissions/strapi-server.js``

This extension currently does two things:

1. Bootstraps the ``viewer`` and ``analyst`` roles when they do not exist.
2. Overrides ``GET /api/users/me`` to return the populated role relation in a
   sanitized payload.

That second customization is what allows the Next.js app to resolve the real
role instead of collapsing custom users into ``authenticated``.

Implementation Summary
----------------------

The main custom pieces added to the platform are:

- centralized role helpers in ``web/src/lib/roles.ts``
- session role resolution helper in ``web/src/lib/auth-role.ts``
- unit test coverage for role resolution in ``web/src/lib/auth-role.test.ts``
- read-only badge component
- protected action button component
- toast notification component for mutation feedback
- generic confirmation modal component for reusable destructive-action UX
- reusable station form modal for create and edit
- reusable delete confirmation modal for destructive station actions
- dashboard viewer banner
- analyst-only server enforcement for station creation, update, and deletion
- Strapi Users & Permissions extension for role bootstrap and ``users/me`` role population
- unit coverage for station mutation helpers and analyst-only station route guards
- component-level interaction coverage for the custom delete confirmation modal

Operational Guidance
--------------------

When adding a new protected dashboard feature, follow this sequence:

1. Decide which role should execute the action.
2. Add or reuse a server-side guard in the matching Next.js API route.
3. Reflect the restriction in the UI using badges or protected buttons.
4. Configure the equivalent permission in Strapi Users & Permissions.
5. Restart Strapi if the plugin extension changed.

This keeps the role model consistent across product copy, interface behavior,
and actual authorization.

Preferences And Map Defaults
----------------------------

The dashboard now includes a dedicated user preferences page:

- ``web/src/app/dashboard/settings/page.tsx``
- ``web/src/components/ThemeSettingsPanel.tsx``

That page persists user-scoped settings for:

- appearance theme
- preferred language
- preferred time zone
- map base style
- default map zoom and center coordinates
- favorite stations
- alert behavior flags

The map route consumes those saved defaults through:

- ``web/src/app/map/page.tsx``
- ``web/src/components/MapboxMap.tsx``

Global Admin Settings
---------------------

The dashboard now also exposes a global admin settings page:

- ``web/src/app/dashboard/admin/page.tsx``
- ``web/src/components/AppSettingsPanel.tsx``

This page is intended for elevated operational users and currently controls:

- the default dashboard language used for guests and fallback sessions
- the public map base style for unauthenticated users
- the public map default zoom level
- the public map default center latitude and longitude

The admin page writes through the internal Next.js proxy route:

- ``web/src/app/api/app-settings/route.ts``

That route forwards changes to the Strapi app settings controller and keeps the
browser isolated from the Strapi bearer token.

Runtime I18n
------------

The dashboard and shared web surfaces now use a runtime i18next layer with
support for:

- ``pt-BR``
- ``en``
- ``es``
- ``fr``

Current implementation files:

- ``web/src/lib/i18n.ts``
- ``web/src/lib/use-app-translation.ts``
- ``web/src/components/AppI18nProvider.tsx``

The effective language is resolved from saved user preferences when available,
otherwise from the global app settings fallback for guests.

Dashboard Charts
----------------

The dashboard provides a visual overview of time-series data using dynamic charts.

- ``web/src/app/dashboard/DashboardCharts.tsx``
- ``web/src/components/SwotChart.tsx``

The ``DashboardCharts`` component is responsible for providing the station selection context. It dynamically fetches recent records from the ``/api/swot-measurements`` endpoint to extract a list of unique, active ``station_id``s, ensuring the user only selects from stations that have valid SWOT data.

Once a station is selected, the data is passed to the ``SwotChart`` component. This component utilizes ``recharts`` to plot the ``mean`` and ``median`` metrics over time. A key interactive feature of this chart is the inclusion of the Recharts ``Brush`` component, which is rendered as a complementary mini-chart below the main visualization. The brush allows users to perform discrete time-axis zooming and panning by dragging its edges or sliding the entire selection window left and right.

SWOT Measurements Data Table
----------------------------

The dashboard overview includes a sortable data table specifically designed to list SWOT measurements:

- ``web/src/components/SwotDataTable.tsx``
- ``web/src/components/ui/table.tsx`` (Shadcn UI table primitives)

This implementation uses ``@tanstack/react-table`` to provide an interactive, sortable client-side table. It fetches data dynamically via ``swr`` calling the ``/api/swot-measurements`` proxy route. The dashboard summary cards have also been updated to reflect the count of available SWOT records natively.

For the full technical flow, model details, and route behavior, see
``preferences.rst``.