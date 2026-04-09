"""Downloader for ERA5 reanalysis data via the Copernicus CDS API."""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

_DEFAULT_VARIABLES_PRECIP = ["total_precipitation"]
_DEFAULT_VARIABLES_TEMP = ["2m_temperature"]


class ERA5Downloader:
    """Download ERA5 reanalysis fields from the Copernicus Climate Data Store.

    Parameters
    ----------
    output_dir:
        Directory where downloaded NetCDF files will be stored.
    cds_api_key:
        CDS API key.  Falls back to the ``CDS_API_KEY`` environment variable
        when not supplied.
    """

    def __init__(
        self,
        output_dir: str | os.PathLike = ".",
        cds_api_key: Optional[str] = None,
    ) -> None:
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self._api_key: str = cds_api_key or os.environ.get("CDS_API_KEY", "")
        if not self._api_key:
            logger.warning(
                "No CDS API key provided and CDS_API_KEY env var is not set. "
                "Downloads will fail unless a key is configured in ~/.cdsapirc."
            )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def download_precipitation(
        self,
        year: int,
        month: int,
        bbox: tuple[float, float, float, float],
        variables: Optional[list[str]] = None,
    ) -> Path:
        """Download ERA5 monthly total precipitation for a bounding box.

        Parameters
        ----------
        year:
            Four-digit year.
        month:
            Month number (1–12).
        bbox:
            Bounding box as ``(north, west, south, east)`` in decimal degrees.
        variables:
            CDS short names of ERA5 variables to download.
            Defaults to ``["total_precipitation"]``.

        Returns
        -------
        pathlib.Path
            Path to the downloaded NetCDF file.
        """
        variables = variables or _DEFAULT_VARIABLES_PRECIP
        filename = f"era5_precip_{year}_{month:02d}.nc"
        return self._download(
            dataset="reanalysis-era5-single-levels-monthly-means",
            variables=variables,
            year=year,
            month=month,
            bbox=bbox,
            output_filename=filename,
        )

    def download_temperature(
        self,
        year: int,
        month: int,
        bbox: tuple[float, float, float, float],
    ) -> Path:
        """Download ERA5 monthly 2-m temperature for a bounding box.

        Parameters
        ----------
        year:
            Four-digit year.
        month:
            Month number (1–12).
        bbox:
            Bounding box as ``(north, west, south, east)`` in decimal degrees.

        Returns
        -------
        pathlib.Path
            Path to the downloaded NetCDF file.
        """
        filename = f"era5_temp_{year}_{month:02d}.nc"
        return self._download(
            dataset="reanalysis-era5-single-levels-monthly-means",
            variables=_DEFAULT_VARIABLES_TEMP,
            year=year,
            month=month,
            bbox=bbox,
            output_filename=filename,
        )

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _download(
        self,
        dataset: str,
        variables: list[str],
        year: int,
        month: int,
        bbox: tuple[float, float, float, float],
        output_filename: str,
    ) -> Path:
        """Submit a CDS API request and wait for the file to be ready."""
        import cdsapi  # imported lazily to allow unit-testing without the package

        output_path = self.output_dir / output_filename
        if output_path.exists():
            logger.info("ERA5 file already exists, skipping download: %s", output_path)
            return output_path

        north, west, south, east = bbox
        request_body = {
            "product_type": "monthly_averaged_reanalysis",
            "variable": variables,
            "year": str(year),
            "month": f"{month:02d}",
            "time": "00:00",
            "area": [north, west, south, east],
            "format": "netcdf",
        }

        logger.info(
            "Submitting ERA5 CDS request: dataset=%s  year=%d  month=%02d",
            dataset,
            year,
            month,
        )
        client = cdsapi.Client(key=self._api_key, quiet=True)
        client.retrieve(dataset, request_body, str(output_path))
        logger.info("ERA5 download complete: %s", output_path)
        return output_path
