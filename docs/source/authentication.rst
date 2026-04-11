Authentication
==============

Overview
--------

The project uses **NextAuth** in the ``web`` app and **Strapi Users &
Permissions** in the ``cms`` app.

The design goal is:

- Strapi remains the source of truth for users and roles.
- NextAuth manages the browser session for the Next.js app.
- The Strapi JWT is kept on the server side and is **not exposed to browser code**.
- Browser code talks to internal Next.js API routes, which proxy requests to
  Strapi when authentication is needed.

Authentication Flow
-------------------

Login works in this sequence:

1. The user submits e-mail and password on ``/login``.
2. NextAuth ``CredentialsProvider`` receives those credentials.
3. The ``web`` server calls Strapi ``POST /api/auth/local``.
4. Strapi returns a JWT and the authenticated user.
5. The ``web`` server calls ``GET /api/users/me?populate=role`` with that JWT.
6. NextAuth stores the Strapi JWT in its server-side JWT token.
7. The browser session receives only safe fields such as ``id``, ``email``,
   ``name``, and ``role``.

The important boundary is that the Strapi JWT stays inside the NextAuth token
on the server. Client components do not receive it.

Key Files
---------

The authentication system is centered in these files:

- ``web/src/lib/auth.ts``
  NextAuth configuration, credentials login, JWT/session callbacks.
- ``web/src/app/api/auth/[...nextauth]/route.ts``
  NextAuth route handler.
- ``web/src/types/next-auth.d.ts``
  Session and JWT type augmentation.
- ``web/src/lib/strapi-server.ts``
  Server-side helpers that read the NextAuth token and forward requests to Strapi.
- ``web/src/lib/strapi.ts``
  Shared frontend data layer. Browser requests go to internal Next.js API routes.
- ``web/src/app/api/stations/route.ts``
- ``web/src/app/api/stations/[id]/route.ts``
- ``web/src/app/api/measurements/route.ts``
- ``web/src/app/api/forecasts/route.ts``
- ``web/src/app/api/climate-layers/route.ts``
- ``web/src/app/api/users/me/preferences/route.ts``
  Internal proxy routes used by the app.
- ``web/src/app/dashboard/layout.tsx``
  Dashboard gate using ``getServerSession(authOptions)``.
- ``web/src/app/login/page.tsx``
  Login form that calls ``signIn('credentials')``.

Runtime Model
-------------

There are two Strapi URLs in the project:

- ``NEXT_PUBLIC_STRAPI_URL``
  Browser-facing URL. This is safe to expose to client code.
- ``STRAPI_INTERNAL_URL``
  Server-facing URL used by Next.js route handlers and NextAuth.

Typical values:

- local ``npm run dev``: both can be ``http://localhost:1337``
- Docker Compose ``web`` service:
  ``NEXT_PUBLIC_STRAPI_URL=http://localhost:1337``
  ``STRAPI_INTERNAL_URL=http://strapi:1337``

This split matters because browser code cannot resolve Docker-internal hostnames
such as ``strapi``, while server code inside the container can.

Session Shape
-------------

The browser-visible session currently contains:

- ``session.user.id``
- ``session.user.name``
- ``session.user.email``
- ``session.user.role``

The Strapi JWT is stored only in the NextAuth JWT token and is used by
``web/src/lib/strapi-server.ts`` when proxying authenticated requests.

Client vs Server Access
-----------------------

Use the following rule:

- **Client components** should call the internal Next.js API routes.
- **Server code** may call Strapi directly through server-only helpers.

Current behavior:

- Reads such as stations, forecasts, measurements, and climate layers are routed
  through ``web/src/lib/strapi.ts``.
- In the browser, those calls hit internal routes like ``/api/stations``.
- On the server, the same helper can call Strapi directly using
  ``STRAPI_INTERNAL_URL``.
- Protected writes, such as creating a virtual station, go to the internal
  Next.js route first and are then forwarded to Strapi with the server-held JWT.

This keeps the browser from ever handling the Strapi bearer token directly.

Current-User Preferences Route
------------------------------

The project now also exposes a current-user preferences route through the same
authenticated proxy pattern.

Web-facing route:

- ``GET /api/users/me/preferences``
- ``PUT /api/users/me/preferences``

Important implementation files:

- ``web/src/app/api/users/me/preferences/route.ts``
- ``cms/src/api/user-preference/controllers/user-preference.js``
- ``cms/src/api/user-preference/routes/custom-user-preference.js``

This route intentionally stays separate from ``/api/users/me`` so identity and
role bootstrap remain isolated from mutable UI preferences.

Roles and Authorization
-----------------------

Application users must be created in the **Strapi Users & Permissions plugin**,
not as Strapi admin-panel users.

The project already bootstraps custom roles in:

- ``cms/src/extensions/users-permissions/strapi-server.js``

Current custom roles:

- ``authenticated`` (fallback/default role)
- ``viewer``
- ``analyst``

Current UI assumptions:

- ``authenticated`` should be treated as a conservative fallback and should not
  receive dashboard write behavior.
- ``viewer`` has read-only access and receives explicit read-only indicators in
  the dashboard UI.
- ``analyst`` can create virtual stations and execute approved write flows.
- ``FAKE_AUTH=true`` bypasses the real login flow for local UI work.

The role response used by NextAuth depends on the Strapi extension in
``cms/src/extensions/users-permissions/strapi-server.js``, which both creates
the custom roles and overrides ``users/me`` so the role relation is returned in
the sanitized payload.

If you introduce new roles, update both:

- Strapi permissions in the Users & Permissions plugin
- role-dependent UI checks in the ``web`` app

Protected Dashboard Flow
------------------------

The dashboard is protected in ``web/src/app/dashboard/layout.tsx``.

- When ``FAKE_AUTH=true``, the layout injects a development-only fake session.
- Otherwise, it calls ``getServerSession(authOptions)``.
- If there is no session, the user is redirected to ``/login``.

This means dashboard protection happens on the server before the page renders.

Current Write Path Example
--------------------------

Station management is the clearest example of the current authenticated write path:

1. ``StationFormModal`` submits create or edit form data, or the stations table
   triggers delete.
2. The client calls one of the internal routes:

   - ``POST /api/stations``
   - ``PATCH /api/stations/[id]``
   - ``DELETE /api/stations/[id]``

3. The route reads the NextAuth token from the request cookies.
4. The route forwards the request to the corresponding Strapi station endpoint with
   ``Authorization: Bearer <strapi-jwt>``.
5. Strapi permissions decide whether that user can create the record.

In the current implementation there is an extra application-level guard before
the request is forwarded:

- ``web/src/app/api/stations/route.ts`` only allows ``analyst`` sessions to
  issue ``POST`` requests.

The stations screen keeps the create action visible through
``web/src/components/ProtectedActionButton.tsx`` and keeps list-level edit and
delete actions visible but disabled for non-analyst users.

This is the pattern to follow for future authenticated mutations.

How To Add Another Protected Endpoint
-------------------------------------

When adding a new authenticated write or restricted read:

1. Add a route under ``web/src/app/api/...``.
2. Use ``proxyStrapiRequest(..., { requireAuth: true })``.
3. Keep the Strapi JWT on the server side.
4. Call the internal route from client components.
5. Configure the matching Strapi permissions for the relevant role.

For server-rendered pages or server actions, prefer server-only calls over
client-side bearer-token handling.

Environment Variables
---------------------

Authentication depends on these variables:

- ``NEXTAUTH_URL``
- ``NEXTAUTH_SECRET``
- ``NEXT_PUBLIC_STRAPI_URL``
- ``STRAPI_INTERNAL_URL``
- ``FAKE_AUTH``

Operationally:

- ``NEXTAUTH_SECRET`` must be stable across restarts for session cookies to remain valid.
- ``FAKE_AUTH`` should stay ``false`` outside local UI development.

Developer Checklist
-------------------

When authentication stops working, check these in order:

1. ``NEXTAUTH_URL`` matches the web app origin.
2. ``NEXTAUTH_SECRET`` is set.
3. ``STRAPI_INTERNAL_URL`` points to a reachable Strapi instance.
4. The Strapi user exists in Users & Permissions.
5. The Strapi role has the required permissions.
6. The app is not accidentally running with stale env values.

If login succeeds but writes fail, the usual cause is missing Strapi role
permissions rather than a NextAuth problem.

If the preferences route fails while login still works, check these next:

1. The Strapi container was restarted after schema or controller changes.
2. ``web/src/app/api/users/me/preferences/route.ts`` is forwarding with
   ``requireAuth: true``.
3. The Strapi controller still validates the incoming bearer token correctly.
4. The request is made from an authenticated session and not an anonymous page.

