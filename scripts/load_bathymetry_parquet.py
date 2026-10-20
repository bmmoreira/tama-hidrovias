#!/usr/bin/env python3
"""Loads a bathymetry depth-grid parquet file into Postgres/PostGIS.

Each row of a `madeira_depth_<ISO datetime>_UTM.parquet` file (see
assets/parquet/) is one raster cell's center point from a HEC-RAS-style
hydraulic model run: a projected (UTM) geometry plus depth_m/wse_m at one
fixed point in time. This script reprojects every point to WGS84 and loads
it into a `bathymetry_points` table, so the public map's depth-lookup
endpoint (web/src/app/api/bathymetry/depth/route.ts) can answer "how deep
is the river here" with a single indexed nearest-neighbor query instead of
reading a parquet/raster file on every request.

Idempotent: re-running for the same `reference_date` deletes that date's
existing rows first, so it's safe to re-run after fixing bad source data.
Loading a second file (a different reference_date) does not touch rows
from other dates -- see the table's own comment for why reference_date is
a column instead of one table per date.

Usage:
    pipeline/venv/bin/python scripts/load_bathymetry_parquet.py \\
        assets/parquet/madeira_depth_2022-10-01T00h00_UTM.parquet

Connects to Postgres via PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD env
vars (falling back to the repo's .env DATABASE_* values, with PGHOST/PGPORT
overridden to localhost/POSTGRES_HOST_PORT -- this runs from the host, not
inside the Docker network, so the `postgres` service hostname .env uses
for Strapi doesn't resolve here; see docker-compose.dev.yml's
POSTGRES_HOST_PORT mapping).
"""
import argparse
import os
import sys
from pathlib import Path

import geopandas as gpd
import psycopg2
import psycopg2.extras
from dotenv import dotenv_values

REPO_ROOT = Path(__file__).resolve().parent.parent

TABLE_NAME = "bathymetry_points"

# Half the 100m grid spacing (see the parquet's own linha/coluna columns)
# plus slack -- anything closer than this to a query point counts as "this
# is that cell's reading," anything further means the click landed outside
# the modeled extent. Mirrored in the API route; keep both in sync.
MAX_MATCH_DISTANCE_M = 150


def load_db_config() -> dict:
    env = dotenv_values(REPO_ROOT / ".env")
    return {
        "host": os.environ.get("PGHOST", "localhost"),
        "port": os.environ.get("PGPORT", os.environ.get("POSTGRES_HOST_PORT", "5432")),
        "dbname": os.environ.get("PGDATABASE", env.get("DATABASE_NAME", "tama_hidrovias")),
        "user": os.environ.get("PGUSER", env.get("DATABASE_USERNAME", "strapi")),
        "password": os.environ.get("PGPASSWORD", env.get("DATABASE_PASSWORD", "")),
    }


def ensure_schema(cur) -> None:
    cur.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
    cur.execute(f"""
        CREATE TABLE IF NOT EXISTS {TABLE_NAME} (
            id SERIAL PRIMARY KEY,
            -- One hydraulic-model snapshot per reference_date, all in the
            -- same table (not one table per date) -- lets the depth-lookup
            -- endpoint grow into real date-matching later (today it just
            -- always queries the one date that's loaded) without a schema
            -- change, and keeps one shared spatial index across all dates.
            reference_date TIMESTAMPTZ NOT NULL,
            cell_row INTEGER NOT NULL,
            cell_col INTEGER NOT NULL,
            cell_id INTEGER NOT NULL,
            depth_m REAL NOT NULL,
            wse_m REAL NOT NULL,
            -- geography, not geometry: queries hand this a plain lng/lat
            -- from a map click and want true great-circle nearest-neighbor
            -- distance in meters, not degrees -- geography gives that
            -- directly off the same GiST index geometry would use.
            geom GEOGRAPHY(Point, 4326) NOT NULL
        );
    """)
    cur.execute(f"""
        CREATE INDEX IF NOT EXISTS {TABLE_NAME}_geom_idx
        ON {TABLE_NAME} USING GIST (geom);
    """)
    cur.execute(f"""
        CREATE INDEX IF NOT EXISTS {TABLE_NAME}_reference_date_idx
        ON {TABLE_NAME} (reference_date);
    """)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("parquet_path", type=Path)
    args = parser.parse_args()

    if not args.parquet_path.exists():
        print(f"File not found: {args.parquet_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Reading {args.parquet_path} ...")
    gdf = gpd.read_parquet(args.parquet_path)
    gdf = gdf.to_crs(4326)

    reference_dates = gdf["data_hora"].unique()
    if len(reference_dates) != 1:
        print(
            f"Expected exactly one reference_date per file, found {len(reference_dates)}: "
            f"{reference_dates}. Split the file or extend this script before loading it.",
            file=sys.stderr,
        )
        sys.exit(1)
    reference_date = reference_dates[0]

    rows = [
        (
            reference_date,
            int(row.linha),
            int(row.coluna),
            int(row.cell_id),
            float(row.depth_m),
            float(row.wse_m),
            row.geometry.x,
            row.geometry.y,
        )
        for row in gdf.itertuples()
    ]
    print(f"{len(rows)} points, reference_date={reference_date}")

    conn = psycopg2.connect(**load_db_config())
    try:
        with conn, conn.cursor() as cur:
            ensure_schema(cur)

            cur.execute(f"DELETE FROM {TABLE_NAME} WHERE reference_date = %s;", (reference_date,))
            deleted = cur.rowcount
            if deleted:
                print(f"Replaced {deleted} existing rows for this reference_date.")

            psycopg2.extras.execute_values(
                cur,
                f"""
                INSERT INTO {TABLE_NAME}
                    (reference_date, cell_row, cell_col, cell_id, depth_m, wse_m, geom)
                VALUES %s
                """,
                rows,
                template="(%s, %s, %s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography)",
                page_size=2000,
            )
        print(f"Loaded {len(rows)} rows into {TABLE_NAME}.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
