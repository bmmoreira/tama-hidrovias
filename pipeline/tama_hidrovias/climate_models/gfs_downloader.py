"""Downloader for GFS (Global Forecast System) GRIB2 files from NOMADS."""

from __future__ import annotations

import logging
import os
from datetime import date, datetime
from pathlib import Path
from typing import Optional

import requests

logger = logging.getLogger(__name__)

_NOMADS_BASE_URL = "https://nomads.ncep.noaa.gov/pub/data/nccf/com/gfs/prod"
_NOMADS_FILTER_BASE = "https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl"

# Standard GFS run hours
_GFS_RUN_HOURS = [0, 6, 12, 18]


class GFSDownloader:
    """Download GFS GRIB2 forecast files from the NOMADS server.

    Parameters
    ----------
    output_dir:
        Directory where downloaded GRIB2 files will be stored.
    timeout:
        HTTP request timeout in seconds.
    """

    def __init__(
        self,
        output_dir: str | os.PathLike = ".",
        timeout: int = 300,
    ) -> None:
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.timeout = timeout
        self._session = requests.Session()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def download_forecast(
        self,
        run_date: date | datetime | str,
        forecast_hour: int,
        bbox: Optional[tuple[float, float, float, float]] = None,
        run_hour: int = 0,
    ) -> Path:
        """Download a single GFS forecast GRIB2 file.

        Parameters
        ----------
        run_date:
            Model initialisation date (``date``, ``datetime``, or
            ``"YYYY-MM-DD"`` string).
        forecast_hour:
            Lead time in hours (e.g. ``24``, ``48``, ``120``).
        bbox:
            Optional bounding box ``(min_lon, min_lat, max_lon, max_lat)`` used
            when constructing a NOMADS filter request.
        run_hour:
            GFS cycle hour (0, 6, 12, or 18).  Defaults to 00 UTC.

        Returns
        -------
        pathlib.Path
            Path to the downloaded GRIB2 file.
        """
        run_date = self._coerce_date(run_date)
        date_str = run_date.strftime("%Y%m%d")
        cycle = f"{run_hour:02d}"
        fhour = f"f{forecast_hour:03d}"
        filename = f"gfs.t{cycle}z.pgrb2.0p25.{fhour}"
        local_path = self.output_dir / f"gfs_{date_str}_{cycle}_{fhour}.grb2"

        if local_path.exists():
            logger.info("GFS file already cached: %s", local_path)
            return local_path

        if bbox is not None:
            url = self._build_filter_url(date_str, cycle, forecast_hour, bbox)
        else:
            url = (
                f"{_NOMADS_BASE_URL}/gfs.{date_str}/{cycle}/atmos/{filename}"
            )

        logger.info("Downloading GFS forecast: %s", url)
        self._http_download(url, local_path)
        logger.info("GFS download complete: %s", local_path)
        return local_path

    def list_available_runs(self, run_date: date | datetime | str) -> list[int]:
        """Return the list of GFS cycle hours available on NOMADS for *run_date*.

        Parameters
        ----------
        run_date:
            Date to query (``date``, ``datetime``, or ``"YYYY-MM-DD"`` string).

        Returns
        -------
        list[int]
            Available run hours, e.g. ``[0, 6, 12, 18]``.
        """
        run_date = self._coerce_date(run_date)
        date_str = run_date.strftime("%Y%m%d")
        available: list[int] = []

        for hour in _GFS_RUN_HOURS:
            url = f"{_NOMADS_BASE_URL}/gfs.{date_str}/{hour:02d}/"
            try:
                resp = self._session.head(url, timeout=10)
                if resp.status_code == 200:
                    available.append(hour)
            except requests.exceptions.RequestException:
                pass

        logger.debug(
            "Available GFS runs for %s: %s", run_date.isoformat(), available
        )
        return available

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _coerce_date(value: date | datetime | str) -> date:
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        return datetime.strptime(value, "%Y-%m-%d").date()

    @staticmethod
    def _build_filter_url(
        date_str: str,
        cycle: str,
        forecast_hour: int,
        bbox: tuple[float, float, float, float],
    ) -> str:
        min_lon, min_lat, max_lon, max_lat = bbox
        params = (
            f"file=gfs.t{cycle}z.pgrb2.0p25.f{forecast_hour:03d}"
            f"&all_var=on&all_lev=on"
            f"&subregion=&leftlon={min_lon}&rightlon={max_lon}"
            f"&toplat={max_lat}&bottomlat={min_lat}"
            f"&dir=%2Fgfs.{date_str}%2F{cycle}%2Fatmos"
        )
        return f"{_NOMADS_FILTER_BASE}?{params}"

    def _http_download(self, url: str, dest: Path) -> None:
        try:
            with self._session.get(url, stream=True, timeout=self.timeout) as resp:
                resp.raise_for_status()
                with dest.open("wb") as fh:
                    for chunk in resp.iter_content(chunk_size=1 << 20):
                        fh.write(chunk)
        except requests.exceptions.HTTPError as exc:
            logger.error("HTTP error downloading GFS: %s", exc)
            raise
        except requests.exceptions.RequestException as exc:
            logger.error("Request error downloading GFS: %s", exc)
            raise
