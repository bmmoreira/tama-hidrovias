"""Basin-level spatial processing: clipping rasters and computing areal averages."""

from __future__ import annotations

import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)


class BasinProcessor:
    """Clip and aggregate raster data to a hydrological basin boundary.

    Parameters
    ----------
    basin_shapefile:
        Path to a vector file (Shapefile, GeoJSON, GPKG …) containing the
        basin polygon(s).  Loaded with :func:`geopandas.read_file`.
    crs:
        Coordinate reference system used for clipping operations.
        Defaults to EPSG:4326.
    """

    def __init__(
        self,
        basin_shapefile: str | os.PathLike,
        crs: str = "EPSG:4326",
    ) -> None:
        import geopandas as gpd

        self.crs = crs
        path = Path(basin_shapefile)
        if not path.exists():
            raise FileNotFoundError(f"Basin shapefile not found: {path}")

        self.basin_gdf = gpd.read_file(path)
        if self.basin_gdf.crs is None:
            self.basin_gdf = self.basin_gdf.set_crs(crs)
        elif str(self.basin_gdf.crs) != crs:
            self.basin_gdf = self.basin_gdf.to_crs(crs)

        logger.info(
            "Loaded basin shapefile: %s  (%d feature(s))",
            path,
            len(self.basin_gdf),
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def clip_raster(
        self,
        raster_path: str | os.PathLike,
        output_path: str | os.PathLike,
    ) -> Path:
        """Clip a NetCDF or GeoTIFF raster to the basin boundary.

        Parameters
        ----------
        raster_path:
            Path to the input raster (NetCDF or GeoTIFF).
        output_path:
            Destination path for the clipped raster.

        Returns
        -------
        pathlib.Path
            Path of the clipped output file.
        """
        import rioxarray  # noqa: F401 – registers .rio accessor
        import xarray as xr

        raster_path = Path(raster_path)
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        logger.info("Clipping raster %s to basin boundary", raster_path)

        ds = xr.open_dataset(raster_path)
        ds = ds.rio.write_crs(self.crs, inplace=False)

        geoms = [geom.__geo_interface__ for geom in self.basin_gdf.geometry]
        clipped = ds.rio.clip(geoms, crs=self.crs, drop=True, all_touched=True)

        # Detect output format from extension
        suffix = output_path.suffix.lower()
        if suffix in {".nc", ".nc4"}:
            clipped.to_netcdf(str(output_path))
        else:
            clipped.rio.to_raster(str(output_path))

        logger.info("Clipped raster saved: %s", output_path)
        return output_path

    def compute_areal_average(
        self,
        raster_path: str | os.PathLike,
    ) -> float:
        """Compute the area-weighted spatial average of a raster over the basin.

        Parameters
        ----------
        raster_path:
            Path to the raster clipped to (or containing) the basin.

        Returns
        -------
        float
            Area-weighted mean value across the basin pixels.
        """
        import numpy as np
        import rioxarray  # noqa: F401
        import xarray as xr

        raster_path = Path(raster_path)
        ds = xr.open_dataset(raster_path)

        # Use the first data variable if multiple exist
        var_name = list(ds.data_vars)[0]
        da = ds[var_name]

        # Clip to basin geometry to exclude nodata pixels
        geoms = [geom.__geo_interface__ for geom in self.basin_gdf.geometry]
        try:
            da = da.rio.write_crs(self.crs)
            da = da.rio.clip(geoms, crs=self.crs, drop=True, all_touched=True)
        except Exception as exc:
            logger.warning("Could not clip before averaging: %s", exc)

        # Compute cosine-latitude weights for geographic coordinates
        if "latitude" in da.coords or "lat" in da.coords:
            lat_name = "latitude" if "latitude" in da.coords else "lat"
            weights = np.cos(np.deg2rad(da[lat_name]))
            weighted = da.weighted(weights.fillna(0))
            mean_val = float(weighted.mean(skipna=True).values)
        else:
            mean_val = float(da.mean(skipna=True).values)

        logger.debug("Areal average for %s: %.4f", raster_path.name, mean_val)
        return mean_val
