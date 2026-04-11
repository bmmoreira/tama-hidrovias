"""Unit tests for tama_hidrovias.processing.standardizer."""

from __future__ import annotations

import math

import numpy as np
import pandas as pd
import pytest

from tama_hidrovias.processing.standardizer import DataStandardizer


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def standardizer() -> DataStandardizer:
    return DataStandardizer()


@pytest.fixture()
def six_hourly_df() -> pd.DataFrame:
    """DataFrame with 6-hourly observations over 3 days."""
    dts = pd.date_range("2023-01-01", periods=12, freq="6h")
    values = np.arange(1.0, 13.0)
    return pd.DataFrame({"datetime": dts, "flow": values})


# ---------------------------------------------------------------------------
# resample_to_daily
# ---------------------------------------------------------------------------

class TestResampleToDaily:
    def test_six_hourly_returns_daily_rows(self, standardizer, six_hourly_df):
        result = standardizer.resample_to_daily(six_hourly_df, "datetime", "flow")
        assert len(result) == 3  # 3 complete days

    def test_datetime_column_renamed(self, standardizer, six_hourly_df):
        result = standardizer.resample_to_daily(six_hourly_df, "datetime", "flow")
        assert "datetime" in result.columns

    def test_mean_aggregation_correct(self, standardizer, six_hourly_df):
        # Day 1: values 1,2,3,4 → mean=2.5
        result = standardizer.resample_to_daily(six_hourly_df, "datetime", "flow")
        assert result.iloc[0]["flow"] == pytest.approx(2.5)

    def test_sum_aggregation(self, standardizer, six_hourly_df):
        # Day 1: values 1+2+3+4=10
        result = standardizer.resample_to_daily(
            six_hourly_df, "datetime", "flow", agg_func="sum"
        )
        assert result.iloc[0]["flow"] == pytest.approx(10.0)

    def test_returns_dataframe(self, standardizer, six_hourly_df):
        result = standardizer.resample_to_daily(six_hourly_df, "datetime", "flow")
        assert isinstance(result, pd.DataFrame)

    def test_result_sorted_by_datetime(self, standardizer):
        # Build out-of-order input
        dts = pd.date_range("2023-03-01", periods=4, freq="6h")
        df = pd.DataFrame({"datetime": dts[::-1], "val": [4.0, 3.0, 2.0, 1.0]})
        result = standardizer.resample_to_daily(df, "datetime", "val")
        assert result["datetime"].is_monotonic_increasing

    def test_callable_aggregation(self, standardizer, six_hourly_df):
        result = standardizer.resample_to_daily(
            six_hourly_df, "datetime", "flow", agg_func=np.max
        )
        # Day 1: max of [1,2,3,4] = 4
        assert result.iloc[0]["flow"] == pytest.approx(4.0)


# ---------------------------------------------------------------------------
# align_time_series
# ---------------------------------------------------------------------------

class TestAlignTimeSeries:
    def _make_df(self, start: str, periods: int, freq: str = "D") -> pd.DataFrame:
        dts = pd.date_range(start, periods=periods, freq=freq)
        return pd.DataFrame({"datetime": dts, "value": range(periods)})

    def test_pads_missing_dates_with_nan(self, standardizer):
        df1 = self._make_df("2023-01-01", 5)  # Jan 1–5
        df2 = self._make_df("2023-01-03", 5)  # Jan 3–7
        aligned = standardizer.align_time_series([df1, df2])
        assert len(aligned) == 2
        # Both should now span Jan 1–7 (7 days)
        assert len(aligned[0]) == 7
        assert len(aligned[1]) == 7

    def test_missing_entries_are_nan(self, standardizer):
        df1 = self._make_df("2023-01-01", 3)  # Jan 1–3
        df2 = self._make_df("2023-01-05", 3)  # Jan 5–7 (gap at Jan 4)
        aligned = standardizer.align_time_series([df1, df2])
        # df1 should have NaN for Jan 5–7
        df1_aligned = aligned[0].set_index("datetime")
        jan5 = pd.Timestamp("2023-01-05")
        assert math.isnan(df1_aligned.loc[jan5, "value"])

    def test_single_dataframe_unchanged(self, standardizer):
        df = self._make_df("2023-06-01", 10)
        aligned = standardizer.align_time_series([df])
        assert len(aligned) == 1
        pd.testing.assert_frame_equal(
            aligned[0].reset_index(drop=True),
            df.reset_index(drop=True),
            check_dtype=False,
        )

    def test_empty_list_returns_empty_list(self, standardizer):
        assert standardizer.align_time_series([]) == []

    def test_common_index_covers_full_range(self, standardizer):
        df1 = self._make_df("2023-01-01", 10)
        df2 = self._make_df("2023-01-05", 10)
        aligned = standardizer.align_time_series([df1, df2])
        # Union range: Jan 1 – Jan 14
        for a in aligned:
            assert a["datetime"].min() == pd.Timestamp("2023-01-01")
            assert a["datetime"].max() == pd.Timestamp("2023-01-14")


# ---------------------------------------------------------------------------
# standardize_units
# ---------------------------------------------------------------------------

class TestStandardizeUnits:
    def _df(self, values: list[float]) -> pd.DataFrame:
        return pd.DataFrame({"value": values})

    def test_m3s_to_ls_conversion(self, standardizer):
        df = self._df([1.0, 2.0, 3.0])
        result = standardizer.standardize_units(df, "value", "m3/s", "l/s")
        expected = [1000.0, 2000.0, 3000.0]
        assert list(result["value"]) == pytest.approx(expected)

    def test_ls_to_m3s_conversion(self, standardizer):
        df = self._df([1000.0, 2000.0])
        result = standardizer.standardize_units(df, "value", "l/s", "m3/s")
        assert list(result["value"]) == pytest.approx([1.0, 2.0])

    def test_m_to_cm_conversion(self, standardizer):
        df = self._df([1.0, 0.5])
        result = standardizer.standardize_units(df, "value", "m", "cm")
        assert list(result["value"]) == pytest.approx([100.0, 50.0])

    def test_mm_to_m_conversion(self, standardizer):
        df = self._df([500.0, 1000.0])
        result = standardizer.standardize_units(df, "value", "mm", "m")
        assert list(result["value"]) == pytest.approx([0.5, 1.0])

    def test_degc_to_degk_conversion(self, standardizer):
        df = self._df([0.0, 100.0])
        result = standardizer.standardize_units(df, "value", "degC", "degK")
        assert list(result["value"]) == pytest.approx([273.15, 373.15])

    def test_degk_to_degc_conversion(self, standardizer):
        df = self._df([273.15])
        result = standardizer.standardize_units(df, "value", "degK", "degC")
        assert list(result["value"]) == pytest.approx([0.0])

    def test_same_unit_returns_unchanged(self, standardizer):
        df = self._df([5.0, 10.0])
        result = standardizer.standardize_units(df, "value", "m3/s", "m3/s")
        assert list(result["value"]) == pytest.approx([5.0, 10.0])

    def test_unknown_unit_pair_raises(self, standardizer):
        df = self._df([1.0])
        with pytest.raises(ValueError, match="No conversion defined"):
            standardizer.standardize_units(df, "value", "furlongs", "parsecs")

    def test_does_not_modify_original(self, standardizer):
        df = self._df([1.0, 2.0])
        original_values = list(df["value"])
        standardizer.standardize_units(df, "value", "m3/s", "l/s")
        assert list(df["value"]) == original_values

    def test_ft_to_m_conversion(self, standardizer):
        df = self._df([1.0])
        result = standardizer.standardize_units(df, "value", "ft", "m")
        assert list(result["value"]) == pytest.approx([0.3048])
