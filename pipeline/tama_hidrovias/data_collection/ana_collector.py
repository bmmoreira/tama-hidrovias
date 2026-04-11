"""Collector for ANA (Agência Nacional de Águas) telemetry data."""

from __future__ import annotations

import logging
import os
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from typing import Optional

import pandas as pd
import requests

logger = logging.getLogger(__name__)

_DEFAULT_BASE_URL = "https://telemetriaws1.ana.gov.br/ServiceANA.asmx"


class ANACollector:
    """Fetch flow and level time-series data from the ANA telemetry web service.

    Parameters
    ----------
    base_url:
        Root URL of the ANA ASMX web service.
    output_dir:
        Directory where CSV files will be written.
    timeout:
        HTTP request timeout in seconds.
    """

    def __init__(
        self,
        base_url: str = _DEFAULT_BASE_URL,
        output_dir: str | os.PathLike = ".",
        timeout: int = 60,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.timeout = timeout
        self._session = requests.Session()
        self._session.headers.update({"Accept": "application/xml, text/xml"})

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def fetch_flow_series(
        self,
        station_code: str,
        start_date: str,
        end_date: str,
    ) -> pd.DataFrame:
        """Fetch discharge (flow) time-series for a station.

        Parameters
        ----------
        station_code:
            ANA station identifier (e.g. ``"60435000"``).
        start_date:
            ISO-8601 date string (``"YYYY-MM-DD"``).
        end_date:
            ISO-8601 date string (``"YYYY-MM-DD"``).

        Returns
        -------
        pandas.DataFrame
            Columns: ``datetime``, ``flow_m3s``, ``level_m``, ``station_code``.
        """
        logger.info(
            "Fetching ANA flow series – station=%s  %s → %s",
            station_code,
            start_date,
            end_date,
        )
        params = self._build_params(station_code, start_date, end_date, series_type=2)
        xml_root = self._request(
            "/DadosHidrometeorologicos", params, station_code
        )
        return self._parse_hydrometric_xml(xml_root, station_code, include_flow=True)

    def fetch_level_series(
        self,
        station_code: str,
        start_date: str,
        end_date: str,
    ) -> pd.DataFrame:
        """Fetch stage/level time-series for a station.

        Parameters
        ----------
        station_code:
            ANA station identifier.
        start_date:
            ISO-8601 date string (``"YYYY-MM-DD"``).
        end_date:
            ISO-8601 date string (``"YYYY-MM-DD"``).

        Returns
        -------
        pandas.DataFrame
            Columns: ``datetime``, ``flow_m3s``, ``level_m``, ``station_code``.
        """
        logger.info(
            "Fetching ANA level series – station=%s  %s → %s",
            station_code,
            start_date,
            end_date,
        )
        params = self._build_params(station_code, start_date, end_date, series_type=1)
        xml_root = self._request(
            "/DadosHidrometeorologicos", params, station_code
        )
        return self._parse_hydrometric_xml(xml_root, station_code, include_flow=False)

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
    def _build_params(
        station_code: str,
        start_date: str,
        end_date: str,
        series_type: int,
    ) -> dict:
        return {
            "codEstacao": station_code,
            "dataInicio": start_date,
            "dataFim": end_date,
            "tipo": series_type,
            "nivelConsistencia": "",
        }

    def _request(self, endpoint: str, params: dict, station_code: str) -> ET.Element:
        url = self.base_url + endpoint
        try:
            response = self._session.get(url, params=params, timeout=self.timeout)
            response.raise_for_status()
        except requests.exceptions.Timeout:
            logger.error("Timeout fetching ANA data for station %s", station_code)
            raise
        except requests.exceptions.HTTPError as exc:
            logger.error(
                "HTTP %s fetching ANA data for station %s: %s",
                exc.response.status_code,
                station_code,
                exc,
            )
            raise
        except requests.exceptions.RequestException as exc:
            logger.error("Request error for station %s: %s", station_code, exc)
            raise
        try:
            return ET.fromstring(response.content)
        except ET.ParseError as exc:
            logger.error("XML parse error for station %s: %s", station_code, exc)
            raise ValueError(f"Invalid XML response for station {station_code}") from exc

    @staticmethod
    def _parse_hydrometric_xml(
        root: ET.Element,
        station_code: str,
        *,
        include_flow: bool,
    ) -> pd.DataFrame:
        """Parse ANA XML response into a tidy DataFrame."""
        records: list[dict] = []

        # ANA wraps data inside DadosHidrometeorologicos > SerieHistorica > Table
        for table in root.iter("Table"):
            dt_text = (table.findtext("DataHora") or "").strip()
            flow_text = (table.findtext("Vazao") or "").strip()
            level_text = (table.findtext("Nivel") or "").strip()

            try:
                dt = pd.to_datetime(dt_text)
            except Exception:
                continue

            flow_val: Optional[float] = None
            level_val: Optional[float] = None

            if flow_text:
                try:
                    flow_val = float(flow_text.replace(",", "."))
                except ValueError:
                    pass
            if level_text:
                try:
                    level_val = float(level_text.replace(",", "."))
                except ValueError:
                    pass

            records.append(
                {
                    "datetime": dt,
                    "flow_m3s": flow_val,
                    "level_m": level_val,
                    "station_code": station_code,
                }
            )

        df = pd.DataFrame(records, columns=["datetime", "flow_m3s", "level_m", "station_code"])
        df["datetime"] = pd.to_datetime(df["datetime"])
        df.sort_values("datetime", inplace=True)
        df.reset_index(drop=True, inplace=True)
        logger.debug("Parsed %d records for station %s", len(df), station_code)
        return df
