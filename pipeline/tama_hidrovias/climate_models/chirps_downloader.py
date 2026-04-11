"""Downloader for CHIRPS (Climate Hazards Group InfraRed Precipitation with Station data)."""

from __future__ import annotations

import logging
import os
from pathlib import Path

import requests

logger = logging.getLogger(__name__)

_CHIRPS_BASE_URL = (
    "https://data.chc.ucsb.edu/products/CHIRPS-2.0/global_monthly/tifs"
)


class CHIRPSDownloader:
    """Download CHIRPS v2.0 monthly precipitation GeoTIFFs.

    Parameters
    ----------
    output_dir:
        Directory where downloaded GeoTIFF files will be stored.
    timeout:
        HTTP download timeout in seconds.
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

    def download_monthly(
        self,
        year: int,
        month: int,
        bbox: tuple[float, float, float, float] | None = None,
    ) -> Path:
        """Download the global CHIRPS monthly GeoTIFF and optionally clip to *bbox*.

        Parameters
        ----------
        year:
            Four-digit year.
        month:
            Month number (1–12).
        bbox:
            Optional bounding box ``(min_lon, min_lat, max_lon, max_lat)`` in
            decimal degrees (EPSG:4326).  When supplied, the raster is clipped
            with rioxarray before saving.

        Returns
        -------
        pathlib.Path
            Path to the (possibly clipped) GeoTIFF file.
        """
        filename = f"chirps-v2.0.{year}.{month:02d}.tif"
        gz_filename = filename + ".gz"
        url = f"{_CHIRPS_BASE_URL}/{gz_filename}"
        local_gz = self.output_dir / gz_filename
        local_tif = self.output_dir / filename

        if local_tif.exists():
            logger.info("CHIRPS file already exists, skipping download: %s", local_tif)
        else:
            self._http_download(url, local_gz)
            self._decompress_gz(local_gz, local_tif)
            local_gz.unlink(missing_ok=True)
            logger.info("CHIRPS download complete: %s", local_tif)

        if bbox is not None:
            clipped_path = self._clip_to_bbox(local_tif, bbox, year, month)
            return clipped_path

        return local_tif

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _http_download(self, url: str, dest: Path) -> None:
        """Stream-download *url* to *dest*."""
        logger.info("Downloading CHIRPS: %s", url)
        try:
            with self._session.get(url, stream=True, timeout=self.timeout) as resp:
                resp.raise_for_status()
                with dest.open("wb") as fh:
                    for chunk in resp.iter_content(chunk_size=1 << 20):
                        fh.write(chunk)
        except requests.exceptions.HTTPError as exc:
            logger.error("HTTP error downloading CHIRPS: %s", exc)
            raise
        except requests.exceptions.RequestException as exc:
            logger.error("Request error downloading CHIRPS: %s", exc)
            raise

    @staticmethod
    def _decompress_gz(gz_path: Path, out_path: Path) -> None:
        """Decompress a .gz file."""
        import gzip
        import shutil

        with gzip.open(gz_path, "rb") as f_in, out_path.open("wb") as f_out:
            shutil.copyfileobj(f_in, f_out)

    def _clip_to_bbox(
        self,
        tif_path: Path,
        bbox: tuple[float, float, float, float],
        year: int,
        month: int,
    ) -> Path:
        """Clip *tif_path* to *bbox* and return path of the clipped file."""
        import rioxarray  # noqa: F401 – registers .rio accessor
        import xarray as xr
        from shapely.geometry import box

        min_lon, min_lat, max_lon, max_lat = bbox
        clip_geom = [box(min_lon, min_lat, max_lon, max_lat)]

        ds = xr.open_dataset(tif_path, engine="rasterio")
        clipped = ds.rio.clip(clip_geom, crs="EPSG:4326", drop=True)

        clipped_filename = f"chirps-v2.0.{year}.{month:02d}_clipped.tif"
        clipped_path = self.output_dir / clipped_filename
        clipped.rio.to_raster(str(clipped_path))
        logger.info("Clipped CHIRPS saved: %s", clipped_path)
        return clipped_path
