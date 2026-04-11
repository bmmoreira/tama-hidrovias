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

Current Protected Flow
----------------------

The current write-protected dashboard flow is virtual station creation.

UI implementation:

- ``web/src/app/dashboard/stations/page.tsx``

Current behavior:

- the ``Nova Estacao Virtual`` action is always visible
- only ``analyst`` users can click it
- non-analyst users see the control disabled with explanatory text
- the modal is only rendered for authorized users

Server Enforcement
------------------

UI restrictions are not the only protection layer.

The route:

- ``web/src/app/api/stations/route.ts``

enforces the same rule on the server side:

- reads the session role from the NextAuth token
- returns ``403`` for non-analyst ``POST`` requests
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
- dashboard viewer banner
- analyst-only server enforcement for station creation
- Strapi Users & Permissions extension for role bootstrap and ``users/me`` role population

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