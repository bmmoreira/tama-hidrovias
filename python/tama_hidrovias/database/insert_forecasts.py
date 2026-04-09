"""Script to insert forecast data (NetCDF or CSV) into Strapi.

Usage
-----
    python -m tama_hidrovias.database.insert_forecasts \\
        --data-dir /path/to/forecast/files \\
        --strapi-url https://cms.example.com \\
        --strapi-token <TOKEN> \\
        --model GFS \\
        --variable precipitation
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path
from typing import Iterator

import pandas as pd

from tama_hidrovias.database.strapi_client import StrapiClient

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Insert forecast NetCDF/CSV data into Strapi"
    )
    parser.add_argument(
        "--data-dir",
        required=True,
        help="Directory containing forecast files",
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
    parser.add_argument("--model", default="GFS", help="Model identifier (e.g. GFS, ERA5)")
    parser.add_argument(
        "--variable", default="precipitation", help="Variable name (e.g. precipitation)"
    )
    parser.add_argument(
        "--station-id",
        type=int,
        default=None,
        help="Strapi station ID to associate records with",
    )
    parser.add_argument(
        "--glob",
        default="*.csv",
        help="Glob pattern for forecast files (default: *.csv)",
    )
    return parser.parse_args(argv)


def _iter_csv_records(path: Path, variable: str, model: str) -> Iterator[dict]:
    """Yield forecast record dicts from a CSV file."""
    df = pd.read_csv(path)
    for _, row in df.iterrows():
        yield {
            "issued_at": row.get("issued_at", row.get("datetime", "")),
            "lead_time_days": int(row.get("lead_time_days", 0)),
            "value": float(row.get("value", float("nan"))),
            "variable": row.get("variable", variable),
            "model": row.get("model", model),
        }


def _iter_netcdf_records(path: Path, variable: str, model: str) -> Iterator[dict]:
    """Yield forecast record dicts from a NetCDF file."""
    import xarray as xr

    ds = xr.open_dataset(path)
    var_name = variable if variable in ds.data_vars else list(ds.data_vars)[0]
    da = ds[var_name]

    time_dim = "time" if "time" in da.dims else da.dims[0]
    for time_val in da[time_dim].values:
        dt = pd.Timestamp(time_val).isoformat()
        spatial_mean = float(da.sel({time_dim: time_val}).mean(skipna=True).values)
        yield {
            "issued_at": dt,
            "lead_time_days": 0,
            "value": spatial_mean,
            "variable": var_name,
            "model": model,
        }


def insert_forecast_file(
    client: StrapiClient,
    path: Path,
    station_id: int | None,
    variable: str,
    model: str,
) -> int:
    """Insert all forecast records from *path* into Strapi.

    Returns the number of records inserted.
    """
    suffix = path.suffix.lower()
    logger.info("Processing forecast file: %s", path.name)

    if suffix == ".csv":
        record_iter = _iter_csv_records(path, variable, model)
    elif suffix in {".nc", ".nc4"}:
        record_iter = _iter_netcdf_records(path, variable, model)
    else:
        logger.warning("Unsupported file type: %s", path.suffix)
        return 0

    count = 0
    for record in record_iter:
        try:
            client.create_forecast(
                station_id=station_id or 0,
                issued_at=record["issued_at"],
                lead_time_days=record["lead_time_days"],
                value=record["value"],
                variable=record["variable"],
                model=record["model"],
            )
            count += 1
        except Exception as exc:
            logger.error("Failed to insert forecast record: %s  error: %s", record, exc)

    return count


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

    files = sorted(data_dir.glob(args.glob))
    if not files:
        logger.warning("No files matching '%s' found in %s", args.glob, data_dir)
        return

    logger.info("Found %d file(s) in %s", len(files), data_dir)
    client = StrapiClient(args.strapi_url, args.strapi_token)

    total = 0
    for fp in files:
        try:
            n = insert_forecast_file(client, fp, args.station_id, args.variable, args.model)
            total += n
            logger.info("  ✓ %s  (%d records)", fp.name, n)
        except Exception as exc:
            logger.error("  ✗ %s failed: %s", fp.name, exc)

    logger.info("Done. Total forecast records inserted: %d", total)


if __name__ == "__main__":
    main()
