"""Script to insert historical CSV data into Strapi.

Usage
-----
    python -m tama_hidrovias.database.insert_historical \\
        --data-dir /path/to/csv/files \\
        --strapi-url https://cms.example.com \\
        --strapi-token <TOKEN>
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path

import pandas as pd

from tama_hidrovias.database.strapi_client import StrapiClient

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Insert historical CSV measurements into Strapi"
    )
    parser.add_argument(
        "--data-dir",
        required=True,
        help="Directory containing CSV files to insert",
    )
    parser.add_argument(
        "--strapi-url",
        default=os.environ.get("STRAPI_URL", ""),
        help="Strapi base URL (default: $STRAPI_URL)",
    )
    parser.add_argument(
        "--strapi-token",
        default=os.environ.get("STRAPI_TOKEN", ""),
        help="Strapi API bearer token (default: $STRAPI_TOKEN)",
    )
    parser.add_argument(
        "--glob",
        default="*.csv",
        help="Glob pattern for CSV files (default: *.csv)",
    )
    return parser.parse_args(argv)


def insert_csv(client: StrapiClient, csv_path: Path) -> int:
    """Read *csv_path* and insert all rows into Strapi.

    Returns the number of successfully queued records.
    """
    logger.info("Reading %s …", csv_path)
    df = pd.read_csv(csv_path)
    records = df.to_dict(orient="records")
    client.batch_insert_measurements(records)
    return len(records)


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)

    if not args.strapi_url or not args.strapi_token:
        logger.error(
            "Both --strapi-url and --strapi-token are required "
            "(or set STRAPI_URL / STRAPI_TOKEN environment variables)."
        )
        sys.exit(1)

    data_dir = Path(args.data_dir)
    if not data_dir.is_dir():
        logger.error("Data directory does not exist: %s", data_dir)
        sys.exit(1)

    csv_files = sorted(data_dir.glob(args.glob))
    if not csv_files:
        logger.warning("No files matching '%s' found in %s", args.glob, data_dir)
        return

    logger.info("Found %d file(s) to process in %s", len(csv_files), data_dir)
    client = StrapiClient(args.strapi_url, args.strapi_token)

    total_inserted = 0
    for csv_path in csv_files:
        try:
            n = insert_csv(client, csv_path)
            total_inserted += n
            logger.info("  ✓ %s  (%d records)", csv_path.name, n)
        except Exception as exc:
            logger.error("  ✗ %s failed: %s", csv_path.name, exc)

    logger.info("Done. Total records queued: %d", total_inserted)


if __name__ == "__main__":
    main()
