"""Collector for SNIRH (Sistema Nacional de Informações sobre Recursos Hídricos) data."""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional

import pandas as pd
import requests

logger = logging.getLogger(__name__)

_SNIRH_BASE_URL = "https://snirh.apambiente.pt/snirh/_dadosnivel/boletimdiario/processador.php"

# Mapping of variable names to SNIRH parameter codes
_VARIABLE_CODES: dict[str, str] = {
    "flow": "1",
    "level": "2",
    "precipitation": "3",
    "temperature": "4",
    "evapotranspiration": "5",
}


class SNIRHCollector:
    """Fetch hydrological station data from the SNIRH REST endpoint.

    Parameters
    ----------
    output_dir:
        Directory where CSV files will be written.
    base_url:
        SNIRH endpoint base URL (override for testing).
    timeout:
        HTTP request timeout in seconds.
    """

    def __init__(
        self,
        output_dir: str | os.PathLike = ".",
        base_url: str = _SNIRH_BASE_URL,
        timeout: int = 60,
    ) -> None:
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.base_url = base_url
        self.timeout = timeout
        self._session = requests.Session()
        self._session.headers.update({"Accept": "application/json, text/html"})

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def fetch_station_data(
        self,
        station_code: str,
        variable: str,
        start_date: str,
        end_date: str,
    ) -> pd.DataFrame:
        """Fetch hydrological data for a SNIRH station.

        Parameters
        ----------
        station_code:
            SNIRH numeric station identifier.
        variable:
            One of ``"flow"``, ``"level"``, ``"precipitation"``,
            ``"temperature"``, or ``"evapotranspiration"``.
        start_date:
            ISO-8601 date string (``"YYYY-MM-DD"``).
        end_date:
            ISO-8601 date string (``"YYYY-MM-DD"``).

        Returns
        -------
        pandas.DataFrame
            Columns: ``datetime``, ``value``, ``variable``, ``station_code``.
        """
        logger.info(
            "Fetching SNIRH %s data – station=%s  %s → %s",
            variable,
            station_code,
            start_date,
            end_date,
        )
        var_code = _VARIABLE_CODES.get(variable.lower())
        if var_code is None:
            raise ValueError(
                f"Unknown variable '{variable}'. "
                f"Valid options: {list(_VARIABLE_CODES)}"
            )

        params = {
            "sites": station_code,
            "pars": var_code,
            "tvar": "D",  # daily
            "dtini": start_date,
            "dtfim": end_date,
            "formato": "json",
        }

        try:
            response = self._session.get(
                self.base_url, params=params, timeout=self.timeout
            )
            response.raise_for_status()
        except requests.exceptions.Timeout:
            logger.error("Timeout fetching SNIRH station %s", station_code)
            raise
        except requests.exceptions.HTTPError as exc:
            logger.error(
                "HTTP %s fetching SNIRH station %s: %s",
                exc.response.status_code,
                station_code,
                exc,
            )
            raise
        except requests.exceptions.RequestException as exc:
            logger.error("Request error for SNIRH station %s: %s", station_code, exc)
            raise

        return self._parse_response(response, station_code, variable)

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

    def _parse_response(
        self,
        response: requests.Response,
        station_code: str,
        variable: str,
    ) -> pd.DataFrame:
        """Parse SNIRH HTTP response (JSON or delimited text) into DataFrame."""
        records: list[dict] = []

        content_type = response.headers.get("Content-Type", "")
        if "json" in content_type:
            records = self._parse_json(response.json(), station_code, variable)
        else:
            records = self._parse_text(response.text, station_code, variable)

        df = pd.DataFrame(records, columns=["datetime", "value", "variable", "station_code"])
        df["datetime"] = pd.to_datetime(df["datetime"])
        df.sort_values("datetime", inplace=True)
        df.reset_index(drop=True, inplace=True)
        logger.debug(
            "Parsed %d SNIRH records for station %s (%s)",
            len(df),
            station_code,
            variable,
        )
        return df

    @staticmethod
    def _parse_json(
        payload: dict | list,
        station_code: str,
        variable: str,
    ) -> list[dict]:
        items = payload if isinstance(payload, list) else payload.get("data", [])
        records: list[dict] = []
        for item in items:
            date_str = item.get("date") or item.get("datetime")
            raw_val = item.get("value") or item.get("val")
            try:
                dt = pd.to_datetime(date_str)
                val: Optional[float] = float(raw_val) if raw_val is not None else None
            except Exception:
                continue
            records.append(
                {"datetime": dt, "value": val, "variable": variable, "station_code": station_code}
            )
        return records

    @staticmethod
    def _parse_text(text: str, station_code: str, variable: str) -> list[dict]:
        """Parse semicolon- or comma-delimited text response."""
        records: list[dict] = []
        for line in text.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.replace(";", ",").split(",")
            if len(parts) < 2:
                continue
            try:
                dt = pd.to_datetime(parts[0].strip())
                val: Optional[float] = float(parts[1].strip().replace(",", "."))
            except Exception:
                continue
            records.append(
                {"datetime": dt, "value": val, "variable": variable, "station_code": station_code}
            )
        return records
