"""Collector for HydroWeb virtual station data (THEIA / CNES)."""

from __future__ import annotations

import logging
import os
from pathlib import Path

import pandas as pd
import requests

logger = logging.getLogger(__name__)

_HYDROWEB_BASE_URL = "https://hydroweb.next.theia-land.fr/api/v1"


class HydroWebCollector:
    """Fetch water-surface elevation time-series from HydroWeb Next.

    Parameters
    ----------
    api_key:
        HydroWeb API authentication key.
    output_dir:
        Directory where CSV files will be written.
    timeout:
        HTTP request timeout in seconds.
    """

    def __init__(
        self,
        api_key: str,
        output_dir: str | os.PathLike = ".",
        timeout: int = 60,
    ) -> None:
        self.api_key = api_key
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.timeout = timeout
        self._session = requests.Session()
        self._session.headers.update(
            {
                "Authorization": f"Bearer {self.api_key}",
                "Accept": "application/json",
            }
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def fetch_virtual_station(
        self,
        station_id: str,
        start_date: str,
        end_date: str,
    ) -> pd.DataFrame:
        """Fetch water-surface elevation for a virtual station.

        Parameters
        ----------
        station_id:
            HydroWeb station identifier (e.g. ``"R_AmazonMouth_RE_NN_0001"``).
        start_date:
            ISO-8601 date string (``"YYYY-MM-DD"``).
        end_date:
            ISO-8601 date string (``"YYYY-MM-DD"``).

        Returns
        -------
        pandas.DataFrame
            Columns: ``datetime``, ``water_surface_elevation_m``, ``station_id``.
        """
        logger.info(
            "Fetching HydroWeb virtual station %s  %s → %s",
            station_id,
            start_date,
            end_date,
        )
        url = f"{_HYDROWEB_BASE_URL}/timeseries/{station_id}"
        params = {
            "start_date": start_date,
            "end_date": end_date,
            "format": "json",
        }

        try:
            response = self._session.get(url, params=params, timeout=self.timeout)
            response.raise_for_status()
        except requests.exceptions.Timeout:
            logger.error("Timeout fetching HydroWeb station %s", station_id)
            raise
        except requests.exceptions.HTTPError as exc:
            logger.error(
                "HTTP %s fetching HydroWeb station %s: %s",
                exc.response.status_code,
                station_id,
                exc,
            )
            raise
        except requests.exceptions.RequestException as exc:
            logger.error("Request error for HydroWeb station %s: %s", station_id, exc)
            raise

        return self._parse_response(response.json(), station_id)

    def save_to_csv(self, df: pd.DataFrame, filename: str) -> Path:
        """Persist a DataFrame to a CSV file inside *output_dir*.

        Parameters
        ----------
        df:
            DataFrame to persist.
        filename:
            Target file name (basename only).

        Returns
        -------
        pathlib.Path
            Full path of the written file.
        """
        dest = self.output_dir / filename
        df.to_csv(dest, index=False)
        logger.info("Saved %d rows → %s", len(df), dest)
        return dest

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_response(payload: dict, station_id: str) -> pd.DataFrame:
        """Convert JSON API response to tidy DataFrame.

        The HydroWeb v1 API returns a structure like::

            {
                "results": [
                    {"date": "2020-01-01", "wse": 12.34, ...},
                    ...
                ]
            }
        """
        results = payload.get("results") or payload.get("data") or []
        records: list[dict] = []

        for item in results:
            date_str = item.get("date") or item.get("datetime") or item.get("time")
            wse = item.get("wse") or item.get("water_surface_elevation")

            try:
                dt = pd.to_datetime(date_str)
            except Exception:
                logger.warning("Skipping unparseable date: %s", date_str)
                continue

            try:
                elev = float(wse) if wse is not None else None
            except (TypeError, ValueError):
                elev = None

            records.append(
                {
                    "datetime": dt,
                    "water_surface_elevation_m": elev,
                    "station_id": station_id,
                }
            )

        df = pd.DataFrame(
            records,
            columns=["datetime", "water_surface_elevation_m", "station_id"],
        )
        df["datetime"] = pd.to_datetime(df["datetime"])
        df.sort_values("datetime", inplace=True)
        df.reset_index(drop=True, inplace=True)
        logger.debug("Parsed %d records for HydroWeb station %s", len(df), station_id)
        return df
