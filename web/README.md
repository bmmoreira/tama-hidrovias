# tama-hidrovias Web

Next.js frontend for the Tama Hidrovias platform.

- **Port:** 3000
- **Framework:** Next.js 15 + NextAuth
- **Purpose:** Interactive dashboard, map access, protected operational flows

## Local development

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Authentication and role model

The frontend authenticates users through NextAuth Credentials against Strapi.

Login sequence:

1. The login page submits e-mail and password to NextAuth.
2. NextAuth calls Strapi `POST /api/auth/local`.
3. The server then calls `GET /api/users/me?populate=role`.
4. The resolved role is stored in the NextAuth token and exposed to the client as `session.user.role`.

The frontend currently recognizes these role levels:

- `authenticated`: fallback value when Strapi does not return a role; treated conservatively
- `viewer`: read-only dashboard mode
- `analyst`: operational mode with access to approved write actions

Role normalization and checks live in `src/lib/roles.ts`.

## Dashboard customizations

The dashboard contains project-specific permission UI and server-side guards.

### Read-only mode for viewers

Viewer sessions receive visual guidance across the dashboard:

- top-level read-only banner in `src/app/dashboard/layout.tsx`
- `ReadOnlyBadge` component in `src/components/ReadOnlyBadge.tsx`
- badge usage in navbar, sidebar, and stations screen

### Protected actions

Write actions should remain visible when possible, but disabled for users who
cannot execute them. The reusable component for this behavior is:

- `src/components/ProtectedActionButton.tsx`

This component:

- disables the button when the current role is not allowed
- keeps the call-to-action visible
- shows a tooltip and helper text explaining why the action is blocked

### Feedback and notifications

Station create, update, and delete flows now emit toast-style feedback instead
of relying on blocking browser alerts for result messaging.

- `src/components/Toast.tsx` provides the reusable notification UI
- the stations page shows success toasts for create, update, and delete
- the stations page shows error toasts when a mutation fails
- the delete flow uses a custom confirmation modal before destructive actions

Reusable confirmation pattern:

- `src/components/ConfirmationModal.tsx` is the shared confirmation shell used directly by destructive dashboard flows

### Current analyst-only flow

The main protected flows implemented today are station creation, station edit,
and station deletion.

Frontend behavior:

- `src/app/dashboard/stations/page.tsx` shows station actions in the list itself
- viewers see write controls disabled with explanatory text via button titles
- analysts can open the station form modal for both create and edit flows
- analysts can trigger station deletion from the table actions column
- the row being edited or deleted is temporarily disabled while its mutation is in flight

Reusable station form UI:

- `src/app/dashboard/stations/StationFormModal.tsx`

Reusable delete confirmation UI:

- `src/components/ConfirmationModal.tsx`

This modal is currently used for:

- confirming station deletion

If another destructive dashboard action is added later, it should use the same
shared confirmation shell instead of introducing a flow-specific modal.

Server-side enforcement:

- `src/app/api/stations/route.ts` rejects non-analyst `POST` requests with `403`
- `src/app/api/stations/[id]/route.ts` rejects non-analyst `PATCH` and `DELETE` requests with `403`

This means the restriction is enforced both in UI and in the server route.

## Shared Strapi data layer

The frontend data layer lives in `src/lib/strapi.ts`.

Important design notes for future development:

- reads can resolve against Strapi directly on the server, or through internal routes in the browser
- writes must continue to go through internal Next.js API routes
- station create, update, and delete helpers are intentionally routed that way so role checks stay server-side
- the file is now commented by section to explain how URL resolution, shared fetch behavior, and resource-specific builders work

## User and map preferences

User-scoped dashboard preferences are persisted separately from identity and
role bootstrap.

Important frontend files:

- `src/app/dashboard/settings/page.tsx`
- `src/components/ThemeSettingsPanel.tsx`
- `src/app/api/users/me/preferences/route.ts`
- `src/app/providers.tsx`
- `src/app/map/page.tsx`
- `src/components/MapboxMap.tsx`
- `src/lib/strapi.ts`

Current implementation notes:

- `GET /api/users/me` remains focused on identity and role bootstrap only
- `GET/PUT /api/users/me/preferences` is the current-user settings route used by the web app
- the settings panel saves theme, language, time zone, map defaults, favorite stations, and alert preferences
- the web app uses runtime i18next localization for `pt-BR`, `en`, `es`, and `fr`
- the map page consumes saved map defaults and remounts the map when the saved base style changes
- the current session theme is updated immediately after save and does not require logout/login

## Global app settings and admin page

Guest-facing defaults are configured separately from per-user preferences.

Important frontend files:

- `src/app/dashboard/admin/page.tsx`
- `src/components/AppSettingsPanel.tsx`
- `src/app/api/app-settings/route.ts`
- `src/lib/server-language.ts`

Current implementation notes:

- the admin page controls the default dashboard language and guest map defaults
- unauthenticated map sessions fall back to the app settings model instead of user preferences
- the root app shell resolves language on the server before hydration, so the initial HTML and loading UI no longer default blindly to Portuguese

For the deeper architecture and route behavior, prefer the Sphinx page:

- `../docs/source/preferences.rst`

## MapView GeoJSON route

The separate `mapview` route is implemented as an experimental or expandable
map surface that consumes a Strapi-backed GeoJSON overlay.

Important files:

- `src/app/mapview/page.tsx`
- `src/app/mapview/mapview-state.ts`
- `src/components/maps/MapBase.tsx`
- `src/app/api/map-feature-collections/route.ts`
- `src/lib/strapi.ts`

Current route flow:

1. The browser opens `/mapview`.
2. The page loads guest or user map defaults from app settings or preferences.
3. The page fetches the GeoJSON overlay through `/api/map-feature-collections`.
4. The Next route proxies to Strapi `GET /api/map-feature-collections/public`.
5. `MapBase.tsx` renders the returned `featureCollection` as a Mapbox GeoJSON source and circle layer.

Current rendering behavior:

- station markers still come from `/api/stations`
- the GeoJSON overlay is rendered separately from station markers
- clicking a GeoJSON point opens a popup from feature properties
- the current popup supports `name`, `sat`, `river`, `basin`, `value`, `change`, `anomalia`, `s_date`, and `e_date`

Development notes:

- keep browser-side reads on the internal Next route instead of calling Strapi directly
- if the GeoJSON contract changes, update both `src/lib/strapi.ts` types and `src/components/maps/MapBase.tsx`
- if the popup or style rules depend on new properties, keep those transformations local to `MapBase.tsx`

For the full technical flow and Strapi upload process, see:

- `../docs/source/mapview.rst`

## Fake auth for UI work

When `FAKE_AUTH=true`, the dashboard layout injects a development session for
local UI work. The fake session uses role `analyst` by default.

Use this mode only for isolated UI development. Keep it disabled for normal
integration testing.

## Testing

The frontend includes a unit test around role resolution:

```bash
npm run test:unit
```

Current coverage includes the pure helper in `src/lib/auth-role.ts`, which
verifies that Strapi role payloads resolve to the expected session role.

Additional coverage now includes:

- `src/lib/strapi.test.ts` for station update/delete mutation helpers
- `src/app/api/stations/[id]/route.test.ts` for analyst-only PATCH/DELETE guard behavior
- `src/app/dashboard/stations/page.test.tsx` for row busy-state behavior across edit and delete flows

## Related documentation

- Root project overview: `../README.rst`
- Sphinx auth docs: `../docs/source/authentication.rst`
- Sphinx dashboard docs: `../docs/source/dashboard.rst`