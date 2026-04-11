Changelog
=========

Upcoming
--------

Authentication and dashboard authorization
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

- Added explicit application role handling for ``viewer`` and ``analyst``.
- Fixed NextAuth session role resolution so the web app reads the populated
  Strapi role instead of collapsing custom users into ``authenticated``.
- Added a Strapi Users & Permissions extension that bootstraps custom roles and
  returns role data from ``GET /api/users/me``.
- Added unit coverage for pure session-role resolution logic in the web app.

Dashboard customization
~~~~~~~~~~~~~~~~~~~~~~~

- Added reusable ``ProtectedActionButton`` for visible-but-disabled protected
  actions.
- Added reusable ``ReadOnlyBadge`` and viewer-mode messaging across the
  dashboard.
- Added a read-only banner for viewer sessions in the dashboard layout.
- Kept restricted actions visible for unauthorized users while enforcing
  analyst-only execution where required.

Protected write flow
~~~~~~~~~~~~~~~~~~~~

- Enforced analyst-only station creation in the internal Next.js API route.
- Kept UI restrictions aligned with server-side authorization for the virtual
  station flow.

Documentation
~~~~~~~~~~~~~

- Added project documentation for role levels, dashboard customization, and
  Strapi-specific authorization behavior.
- Added frontend and CMS project notes describing the custom auth and role
  model.