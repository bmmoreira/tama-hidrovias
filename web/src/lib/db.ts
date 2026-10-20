import { Pool } from 'pg';

/**
 * Server-only Postgres pool for querying tables that have no Strapi
 * content type -- e.g. `bathymetry_points` (see
 * scripts/load_bathymetry_parquet.py), which is loaded directly and never
 * goes through Strapi at all. Never import this from a client component;
 * it only works inside a Next.js route handler / server component, same
 * as `STRAPI_INTERNAL_URL`-based helpers elsewhere in `lib/`.
 *
 * Reuses the exact same DATABASE_* env vars Strapi already connects with
 * (see .env) -- both the `web` and `strapi` containers reach the same
 * Postgres instance over the same Docker network hostname.
 */
const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT) || 5432,
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  max: 5,
});

export default pool;
