"""Unit tests for tama_hidrovias.bias_correction.methods."""

from __future__ import annotations

import math

import numpy as np
import pytest

from tama_hidrovias.bias_correction.methods import (
    delta_method,
    evaluate_bias,
    quantile_mapping,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def synthetic_data():
    """Deterministic obs, hindcast, and forecast arrays."""
    rng = np.random.default_rng(42)
    obs = rng.normal(loc=5.0, scale=1.5, size=200)
    hindcast = rng.normal(loc=7.0, scale=2.0, size=200)  # biased high
    forecast = rng.normal(loc=7.5, scale=2.0, size=50)
    return obs, hindcast, forecast


@pytest.fixture()
def precip_data():
    """Non-negative precipitation arrays."""
    rng = np.random.default_rng(7)
    obs = np.abs(rng.normal(loc=3.0, scale=1.0, size=120))
    hindcast = np.abs(rng.normal(loc=5.0, scale=1.5, size=120))
    forecast = np.abs(rng.normal(loc=5.5, scale=1.5, size=30))
    return obs, hindcast, forecast


# ---------------------------------------------------------------------------
# quantile_mapping tests
# ---------------------------------------------------------------------------

class TestQuantileMapping:
    def test_returns_same_shape_as_forecast(self, synthetic_data):
        obs, hindcast, forecast = synthetic_data
        corrected = quantile_mapping(obs, hindcast, forecast)
        assert corrected.shape == forecast.shape

    def test_output_is_numpy_array(self, synthetic_data):
        obs, hindcast, forecast = synthetic_data
        corrected = quantile_mapping(obs, hindcast, forecast)
        assert isinstance(corrected, np.ndarray)

    def test_reduces_mean_bias(self, synthetic_data):
        obs, hindcast, forecast = synthetic_data
        corrected = quantile_mapping(obs, hindcast, forecast)
        bias_before = abs(np.mean(forecast) - np.mean(obs))
        bias_after = abs(np.mean(corrected) - np.mean(obs))
        assert bias_after < bias_before

    def test_handles_nan_in_forecast(self, synthetic_data):
        obs, hindcast, forecast = synthetic_data
        forecast_with_nan = forecast.copy()
        forecast_with_nan[5] = np.nan
        corrected = quantile_mapping(obs, hindcast, forecast_with_nan)
        assert corrected.shape == forecast_with_nan.shape
        assert np.isnan(corrected[5])

    def test_single_element_forecast(self):
        obs = np.linspace(1, 10, 100)
        hindcast = obs + 2
        forecast = np.array([6.0])
        corrected = quantile_mapping(obs, hindcast, forecast)
        assert corrected.shape == (1,)

    def test_accepts_list_inputs(self):
        obs = list(range(1, 11))
        hindcast = [x + 1 for x in obs]
        forecast = [5.5, 6.5]
        corrected = quantile_mapping(obs, hindcast, forecast)
        assert len(corrected) == 2


# ---------------------------------------------------------------------------
# delta_method tests
# ---------------------------------------------------------------------------

class TestDeltaMethod:
    def test_returns_same_shape_as_forecast(self, precip_data):
        obs, hindcast, forecast = precip_data
        corrected = delta_method(obs, hindcast, forecast)
        assert corrected.shape == forecast.shape

    def test_all_values_non_negative(self, precip_data):
        obs, hindcast, forecast = precip_data
        corrected = delta_method(obs, hindcast, forecast)
        assert np.all(corrected >= 0.0)

    def test_non_negative_even_with_negative_inputs(self):
        """delta_method must clamp to 0 even if ratio produces negatives."""
        obs = np.array([1.0, 2.0, 3.0])
        hindcast = np.array([5.0, 5.0, 5.0])
        forecast = np.array([-1.0, -2.0, 0.5])
        corrected = delta_method(obs, hindcast, forecast)
        assert np.all(corrected >= 0.0)

    def test_zero_hindcast_mean_returns_unchanged(self, caplog):
        obs = np.array([1.0, 2.0, 3.0])
        hindcast = np.zeros(3)
        forecast = np.array([2.0, 3.0])
        import logging

        with caplog.at_level(logging.WARNING):
            corrected = delta_method(obs, hindcast, forecast)
        assert np.array_equal(corrected, forecast)
        assert "zero" in caplog.text.lower()

    def test_corrects_bias_direction(self, precip_data):
        """Mean of corrected forecast should be closer to obs mean."""
        obs, hindcast, forecast = precip_data
        corrected = delta_method(obs, hindcast, forecast)
        bias_before = abs(np.mean(forecast) - np.mean(obs))
        bias_after = abs(np.mean(corrected) - np.mean(obs))
        assert bias_after < bias_before


# ---------------------------------------------------------------------------
# evaluate_bias tests
# ---------------------------------------------------------------------------

class TestEvaluateBias:
    def test_returns_expected_keys(self, synthetic_data):
        obs, hindcast, _ = synthetic_data
        result = evaluate_bias(obs, hindcast)
        assert set(result.keys()) == {"mean_bias", "relative_bias_pct", "correlation"}

    def test_zero_bias_for_identical_arrays(self):
        arr = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
        result = evaluate_bias(arr, arr.copy())
        assert result["mean_bias"] == pytest.approx(0.0)
        assert result["relative_bias_pct"] == pytest.approx(0.0)
        assert result["correlation"] == pytest.approx(1.0)

    def test_positive_bias_when_hindcast_high(self):
        obs = np.array([2.0, 4.0, 6.0])
        hindcast = obs + 1.0
        result = evaluate_bias(obs, hindcast)
        assert result["mean_bias"] == pytest.approx(1.0)
        assert result["relative_bias_pct"] > 0

    def test_nan_values_are_excluded(self):
        obs = np.array([1.0, np.nan, 3.0, 4.0])
        hindcast = np.array([1.0, 99.0, 3.0, 4.0])
        result = evaluate_bias(obs, hindcast)
        # After masking, only indices 0, 2, 3 are used → zero bias
        assert result["mean_bias"] == pytest.approx(0.0)

    def test_zero_mean_obs_relative_bias_is_nan(self):
        obs = np.zeros(5)
        hindcast = np.ones(5)
        result = evaluate_bias(obs, hindcast)
        assert math.isnan(result["relative_bias_pct"])

    def test_correlation_value_range(self, synthetic_data):
        obs, hindcast, _ = synthetic_data
        result = evaluate_bias(obs, hindcast)
        r = result["correlation"]
        assert -1.0 <= r <= 1.0
