"""End-to-end pipeline orchestration."""

from __future__ import annotations

import logging
import os
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)


class DataPipeline:
    """Orchestrate data collection, processing, evaluation, and storage.

    Parameters
    ----------
    config:
        Dictionary with keys:

        - ``output_dir`` – working directory for intermediate files
        - ``strapi_url`` – Strapi CMS base URL
        - ``strapi_token`` – Strapi API bearer token
        - ``basin_shapefile`` – path to the basin boundary vector file
    """

    def __init__(self, config: dict[str, Any]) -> None:
        self.config = config
        self.output_dir = Path(config.get("output_dir", "output"))
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self._strapi_url: str = config.get("strapi_url", os.environ.get("STRAPI_URL", ""))
        self._strapi_token: str = config.get(
            "strapi_token", os.environ.get("STRAPI_TOKEN", "")
        )
        self._basin_shapefile: Optional[str] = config.get("basin_shapefile")

        logger.info("DataPipeline initialised (output_dir=%s)", self.output_dir)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def run_collection(
        self,
        source: str,
        station_codes: list[str],
        start_date: str,
        end_date: str,
    ) -> list[Path]:
        """Collect data from *source* for the given station codes and date range.

        Parameters
        ----------
        source:
            One of ``"ana"``, ``"hydroweb"``, ``"snirh"``.
        station_codes:
            List of station identifiers.
        start_date:
            ISO-8601 start date (``"YYYY-MM-DD"``).
        end_date:
            ISO-8601 end date (``"YYYY-MM-DD"``).

        Returns
        -------
        list[pathlib.Path]
            Paths to the collected CSV files.
        """
        source_key = source.lower()
        collected_paths: list[Path] = []

        for code in station_codes:
            try:
                path = self._collect_one(source_key, code, start_date, end_date)
                collected_paths.append(path)
            except Exception as exc:
                logger.error(
                    "Collection failed for source=%s station=%s: %s",
                    source,
                    code,
                    exc,
                )

        logger.info(
            "Collection complete: %d / %d stations succeeded",
            len(collected_paths),
            len(station_codes),
        )
        return collected_paths

    def run_processing(
        self,
        input_path: str | os.PathLike,
        output_path: str | os.PathLike,
    ) -> Path:
        """Standardise and basin-clip a raw data file.

        Parameters
        ----------
        input_path:
            Path to the raw input file (CSV or NetCDF).
        output_path:
            Destination for the processed file.

        Returns
        -------
        pathlib.Path
            Path of the processed output file.
        """
        import pandas as pd

        from tama_hidrovias.processing.standardizer import DataStandardizer

        input_path = Path(input_path)
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        logger.info("Processing %s → %s", input_path, output_path)

        df = pd.read_csv(input_path)
        standardizer = DataStandardizer()

        value_col = [c for c in df.columns if c not in ("datetime", "station_code")][0]
        df_daily = standardizer.resample_to_daily(df, "datetime", value_col, agg_func="mean")
        df_daily.to_csv(output_path, index=False)
        logger.info("Processed file saved: %s  (%d rows)", output_path, len(df_daily))
        return output_path

    def run_evaluation(
        self,
        obs_path: str | os.PathLike,
        hindcast_path: str | os.PathLike,
        value_col: str = "value",
    ) -> dict[str, float]:
        """Compute skill scores between observed and hindcast CSV files.

        Parameters
        ----------
        obs_path:
            Path to the observed data CSV.
        hindcast_path:
            Path to the hindcast data CSV.
        value_col:
            Name of the value column in both files.

        Returns
        -------
        dict
            Metric results (nse, kge, rmse, pbias, correlation).
        """
        import pandas as pd

        from tama_hidrovias.evaluation.metrics import evaluate_hindcast_period

        obs_df = pd.read_csv(obs_path)
        hnd_df = pd.read_csv(hindcast_path)

        results = evaluate_hindcast_period(obs_df, hnd_df, value_col)
        logger.info("Evaluation results: %s", results)
        return results

    def run_full_pipeline(
        self,
        start_date: str,
        end_date: str,
        sources: Optional[list[str]] = None,
        station_codes: Optional[list[str]] = None,
    ) -> None:
        """Run the complete pipeline end-to-end.

        Parameters
        ----------
        start_date:
            ISO-8601 start date.
        end_date:
            ISO-8601 end date.
        sources:
            Data sources to collect from.  Defaults to ``["ana"]``.
        station_codes:
            Station identifiers.  Defaults to an empty list (no collection).
        """
        sources = sources or ["ana"]
        station_codes = station_codes or []

        logger.info(
            "Starting full pipeline: %s → %s  sources=%s  stations=%d",
            start_date,
            end_date,
            sources,
            len(station_codes),
        )

        for source in sources:
            raw_paths = self.run_collection(source, station_codes, start_date, end_date)
            for raw_path in raw_paths:
                processed_path = self.output_dir / "processed" / raw_path.name
                try:
                    self.run_processing(raw_path, processed_path)
                    self._insert_to_strapi(processed_path)
                except Exception as exc:
                    logger.error("Pipeline step failed for %s: %s", raw_path.name, exc)

        logger.info("Full pipeline complete.")

    def run_scheduled(self) -> None:
        """Entry-point called by the scheduler; collects the last 7 days."""
        today = date.today()
        end_date = today.isoformat()
        start_date = (today - timedelta(days=7)).isoformat()

        station_codes: list[str] = self.config.get("station_codes", [])
        sources: list[str] = self.config.get("sources", ["ana"])

        logger.info("Scheduled run: %s → %s", start_date, end_date)
        self.run_full_pipeline(start_date, end_date, sources, station_codes)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _collect_one(
        self, source: str, station_code: str, start_date: str, end_date: str
    ) -> Path:
        if source == "ana":
            from tama_hidrovias.data_collection.ana_collector import ANACollector

            collector = ANACollector(output_dir=self.output_dir / "raw")
            df = collector.fetch_flow_series(station_code, start_date, end_date)
            filename = f"ana_{station_code}_{start_date}_{end_date}.csv"
            return collector.save_to_csv(df, filename)

        elif source == "hydroweb":
            from tama_hidrovias.data_collection.hydroweb_collector import HydroWebCollector

            api_key = self.config.get("hydroweb_api_key", os.environ.get("HYDROWEB_API_KEY", ""))
            collector = HydroWebCollector(api_key=api_key, output_dir=self.output_dir / "raw")
            df = collector.fetch_virtual_station(station_code, start_date, end_date)
            filename = f"hydroweb_{station_code}_{start_date}_{end_date}.csv"
            return collector.save_to_csv(df, filename)

        elif source == "snirh":
            from tama_hidrovias.data_collection.snirh_collector import SNIRHCollector

            variable = self.config.get("snirh_variable", "flow")
            collector = SNIRHCollector(output_dir=self.output_dir / "raw")
            df = collector.fetch_station_data(station_code, variable, start_date, end_date)
            filename = f"snirh_{station_code}_{start_date}_{end_date}.csv"
            return collector.save_to_csv(df, filename)

        else:
            raise ValueError(f"Unknown source: '{source}'. Choose from ana, hydroweb, snirh.")

    def _insert_to_strapi(self, csv_path: Path) -> None:
        if not self._strapi_url or not self._strapi_token:
            logger.warning("Strapi URL or token not configured; skipping insertion.")
            return

        import pandas as pd

        from tama_hidrovias.database.strapi_client import StrapiClient

        client = StrapiClient(self._strapi_url, self._strapi_token)
        df = pd.read_csv(csv_path)
        records = df.to_dict(orient="records")
        client.batch_insert_measurements(records)
        logger.info("Inserted %d records from %s into Strapi", len(records), csv_path.name)


def main() -> None:
    """CLI entry-point for the pipeline."""
    import argparse

    from dotenv import load_dotenv

    load_dotenv()

    parser = argparse.ArgumentParser(description="tama-hidrovias data pipeline")
    today = date.today()
    parser.add_argument("--start-date", default=(today - timedelta(days=7)).isoformat())
    parser.add_argument("--end-date", default=today.isoformat())
    parser.add_argument("--source", default="ana")
    parser.add_argument("--stations", nargs="*", default=[])
    parser.add_argument("--output-dir", default="output")
    args = parser.parse_args()

    config: dict[str, Any] = {
        "output_dir": args.output_dir,
        "strapi_url": os.environ.get("STRAPI_URL", ""),
        "strapi_token": os.environ.get("STRAPI_TOKEN", ""),
    }
    pipeline = DataPipeline(config)
    pipeline.run_full_pipeline(
        start_date=args.start_date,
        end_date=args.end_date,
        sources=[args.source],
        station_codes=args.stations,
    )


if __name__ == "__main__":
    main()
