# tama-hidrovias Strapi CMS

Strapi v4 headless CMS for the tama-hidrovias hydrology platform.

- **Port:** 1337
- **Purpose:** Serves the hydro data API (stations, measurements, forecasts, climate layers)

## Quick start

```bash
cp .env.example .env   # edit secrets before use
npm install
npm run develop        # development (SQLite)
npm run start          # production (PostgreSQL)
```
