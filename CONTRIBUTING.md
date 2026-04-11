# Contributing

This repository is a multi-service platform. The repository root is the orchestration layer; the runnable applications live in the service directories.

## Project Layout

```text
web/         Frontend application
cms/         CMS and API
pipeline/    Data pipeline and tests
pgadmin/     pgAdmin bootstrap configuration
tileserver/  Raster tile service
data/        Local raw and processed data
docs/        Sphinx documentation
```

## Common Workflows

### Full stack with Docker

```bash
cp .env.example .env
docker compose up --build
```

Then open `http://localhost:5050` to manage PostgreSQL in pgAdmin.

### Frontend

```bash
cd web
npm install
npm run dev
```

### Strapi

```bash
cd cms
npm install
npm run develop
```

### Python pipeline and tests

```bash
cd pipeline
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install -e .
pytest
```

## Environment Files

- Use `/.env.example` as the template for shared Docker Compose variables.
- Use `web/.env.example` for frontend-only variables in local development.
- Use `cms/.env.example` for Strapi-only variables in local development.
- Do not commit `.env`, `.env.local`, or other machine-specific env files.
- For authentication, keep `NEXT_PUBLIC_STRAPI_URL` browser-facing and `STRAPI_INTERNAL_URL` server-facing.

## Authentication

The project authentication system is documented separately in
`docs/source/authentication.rst`.

- `web` uses NextAuth for the app session.
- `cms` remains the source of truth for users and roles.
- The Strapi JWT must stay on the server side and should not be exposed to browser code.

## Contribution Notes

- Keep dependencies scoped to the service that uses them.
- The repository root is not an npm package or workspace. Run `npm install` only inside `web/` or `cms/`.
- Avoid adding standalone app metadata at the repository root unless the root is intentionally acting as a workspace.
- Do not commit generated runtime folders such as `.next/`, `node_modules/`, or Strapi build/cache artifacts.
- Keep shared branding assets in `assets/` as the canonical source. Only add a copy to `web/public/` when the frontend must serve that file directly.
