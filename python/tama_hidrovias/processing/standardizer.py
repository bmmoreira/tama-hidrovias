"""Spatial and temporal standardisation utilities for hydro time-series."""

from __future__ import annotations

import logging
from typing import Callable, Union

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# Unit conversion factors relative to SI base unit (m³/s for flow, m for length)
_UNIT_CONVERSIONS: dict[tuple[str, str], float] = {
    # Flow
    ("m3/s", "l/s"): 1_000.0,
    ("l/s", "m3/s"): 1 / 1_000.0,
    ("m3/s", "mm/day"): 1.0,  # basin-area dependent – caller must handle separately
    # Length / level
    ("m", "cm"): 100.0,
    ("cm", "m"): 0.01,
    ("m", "mm"): 1_000.0,
    ("mm", "m"): 0.001,
    ("ft", "m"): 0.3048,
    ("m", "ft"): 1 / 0.3048,
    # Temperature
    ("degc", "degk"): None,  # offset conversion – handled separately
    ("degk", "degc"): None,
    # Precipitation
    ("mm/day", "m/day"): 0.001,
    ("m/day", "mm/day"): 1_000.0,
    ("mm/month", "mm/day"): None,  # month-length-dependent
}

_OFFSET_CONVERSIONS: dict[tuple[str, str], tuple[float, float]] = {
    # (scale, offset) such that result = value * scale + offset
    ("degc", "degk"): (1.0, 273.15),
    ("degk", "degc"): (1.0, -273.15),
}


class DataStandardizer:
    """Temporal resampling and unit standardisation for hydro time-series.

    All methods return new DataFrames and do not modify inputs in-place.
    """

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def resample_to_daily(
        self,
        df: pd.DataFrame,
        datetime_col: str,
        value_col: str,
        agg_func: Union[str, Callable] = "mean",
    ) -> pd.DataFrame:
        """Resample a time-series DataFrame to daily frequency.

        Parameters
        ----------
        df:
            Input DataFrame with at least *datetime_col* and *value_col*.
        datetime_col:
            Name of the datetime column.
        value_col:
            Name of the value column to aggregate.
        agg_func:
            Aggregation function accepted by ``pandas.Resample.aggregate``
            (e.g. ``"mean"``, ``"sum"``, ``"max"``).

        Returns
        -------
        pandas.DataFrame
            Daily DataFrame with columns ``[datetime, value_col]``.
        """
        work = df[[datetime_col, value_col]].copy()
        work[datetime_col] = pd.to_datetime(work[datetime_col])
        work = work.set_index(datetime_col).sort_index()

        daily = work.resample("D").agg(agg_func)
        daily = daily.reset_index().rename(columns={datetime_col: "datetime"})
        logger.debug(
            "Resampled %d rows → %d daily rows (agg=%s)",
            len(df),
            len(daily),
            agg_func,
        )
        return daily

    def align_time_series(
        self,
        dfs: list[pd.DataFrame],
        freq: str = "D",
        datetime_col: str = "datetime",
    ) -> list[pd.DataFrame]:
        """Align multiple DataFrames to a shared time index.

        Missing dates in each DataFrame are filled with ``NaN``.

        Parameters
        ----------
        dfs:
            List of DataFrames, each with a *datetime_col* column.
        freq:
            Pandas offset alias for the target frequency (e.g. ``"D"``,
            ``"h"``, ``"ME"``).
        datetime_col:
            Name of the datetime column.

        Returns
        -------
        list[pandas.DataFrame]
            Re-indexed DataFrames sharing the union time index.
        """
        if not dfs:
            return []

        # Build union index across all DataFrames
        all_dts: list[pd.DatetimeIndex] = []
        for df in dfs:
            idx = pd.DatetimeIndex(pd.to_datetime(df[datetime_col]))
            all_dts.append(idx)

        combined = pd.DatetimeIndex(
            [dt for idx in all_dts for dt in idx]
        )
        start, end = combined.min(), combined.max()
        common_index = pd.date_range(start=start, end=end, freq=freq)

        aligned: list[pd.DataFrame] = []
        for df in dfs:
            work = df.copy()
            work[datetime_col] = pd.to_datetime(work[datetime_col])
            work = work.set_index(datetime_col).sort_index()
            work = work.reindex(common_index)
            work.index.name = datetime_col
            work = work.reset_index()
            aligned.append(work)

        logger.debug(
            "Aligned %d DataFrames to %d time steps (%s)",
            len(dfs),
            len(common_index),
            freq,
        )
        return aligned

    def standardize_units(
        self,
        df: pd.DataFrame,
        col: str,
        from_unit: str,
        to_unit: str,
    ) -> pd.DataFrame:
        """Convert values in *col* from *from_unit* to *to_unit*.

        Parameters
        ----------
        df:
            Input DataFrame.
        col:
            Name of the column to convert.
        from_unit:
            Source unit string (case-insensitive).
        to_unit:
            Target unit string (case-insensitive).

        Returns
        -------
        pandas.DataFrame
            Copy of *df* with the converted column.

        Raises
        ------
        ValueError
            If the unit pair is not in the conversion table.
        """
        from_key = from_unit.lower().strip()
        to_key = to_unit.lower().strip()

        if from_key == to_key:
            return df.copy()

        key = (from_key, to_key)

        # Check offset conversions first (e.g. temperature)
        if key in _OFFSET_CONVERSIONS:
            scale, offset = _OFFSET_CONVERSIONS[key]
            out = df.copy()
            out[col] = out[col] * scale + offset
            logger.debug("Converted %s: %s → %s (offset conversion)", col, from_unit, to_unit)
            return out

        factor = _UNIT_CONVERSIONS.get(key)
        if factor is None:
            raise ValueError(
                f"No conversion defined for '{from_unit}' → '{to_unit}'. "
                "Extend _UNIT_CONVERSIONS or handle manually."
            )

        out = df.copy()
        out[col] = out[col] * factor
        logger.debug(
            "Converted %s: %s → %s (factor=%.6g)", col, from_unit, to_unit, factor
        )
        return out
