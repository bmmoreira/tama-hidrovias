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

### Current analyst-only flow

The main protected flow implemented today is virtual station creation.

Frontend behavior:

- `src/app/dashboard/stations/page.tsx` shows the action button to everyone
- viewers see the button disabled with explanatory text
- only analysts can open the creation modal

Server-side enforcement:

- `src/app/api/stations/route.ts` rejects non-analyst `POST` requests with `403`

This means the restriction is enforced both in UI and in the server route.

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

## Related documentation

- Root project overview: `../README.rst`
- Sphinx auth docs: `../docs/source/authentication.rst`
- Sphinx dashboard docs: `../docs/source/dashboard.rst`