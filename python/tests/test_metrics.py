"""Unit tests for tama_hidrovias.evaluation.metrics."""

from __future__ import annotations

import math
from unittest.mock import MagicMock

import numpy as np
import pandas as pd
import pytest

from tama_hidrovias.evaluation.metrics import (
    correlation,
    evaluate_hindcast_period,
    kge,
    nse,
    pbias,
    rmse,
    skill_score,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def perfect_pair() -> tuple[np.ndarray, np.ndarray]:
    """Observed == Simulated: perfect forecast."""
    obs = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
    return obs, obs.copy()


@pytest.fixture()
def mean_pair() -> tuple[np.ndarray, np.ndarray]:
    """Simulated is the mean of observed: NSE == 0."""
    obs = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
    sim = np.full_like(obs, obs.mean())
    return obs, sim


# ---------------------------------------------------------------------------
# NSE tests
# ---------------------------------------------------------------------------

class TestNSE:
    def test_perfect_forecast_returns_one(self, perfect_pair):
        obs, sim = perfect_pair
        assert nse(obs, sim) == pytest.approx(1.0)

    def test_mean_forecast_returns_zero(self, mean_pair):
        obs, sim = mean_pair
        assert nse(obs, sim) == pytest.approx(0.0)

    def test_bad_forecast_is_negative(self):
        obs = np.array([1.0, 2.0, 3.0])
        sim = np.array([10.0, 20.0, 30.0])
        assert nse(obs, sim) < 0

    def test_nan_inputs_skipped(self):
        obs = np.array([1.0, np.nan, 3.0])
        sim = np.array([1.0, np.nan, 3.0])
        result = nse(obs, sim)
        assert result == pytest.approx(1.0)

    def test_all_same_obs_returns_nan(self):
        obs = np.array([2.0, 2.0, 2.0])
        sim = np.array([2.0, 2.0, 2.0])
        result = nse(obs, sim)
        assert math.isnan(result)


# ---------------------------------------------------------------------------
# KGE tests
# ---------------------------------------------------------------------------

class TestKGE:
    def test_perfect_forecast_returns_one(self, perfect_pair):
        obs, sim = perfect_pair
        assert kge(obs, sim) == pytest.approx(1.0)

    def test_kge_range(self):
        obs = np.random.default_rng(42).normal(5, 1, 100)
        sim = obs + np.random.default_rng(7).normal(0, 0.5, 100)
        result = kge(obs, sim)
        assert result <= 1.0

    def test_kge_with_zero_mean_obs_returns_nan(self):
        obs = np.zeros(5)
        sim = np.ones(5)
        result = kge(obs, sim)
        assert math.isnan(result)


# ---------------------------------------------------------------------------
# RMSE tests
# ---------------------------------------------------------------------------

class TestRMSE:
    def test_perfect_forecast_is_zero(self, perfect_pair):
        obs, sim = perfect_pair
        assert rmse(obs, sim) == pytest.approx(0.0)

    def test_known_values(self):
        obs = np.array([0.0, 0.0, 0.0])
        sim = np.array([1.0, 2.0, 3.0])
        # RMSE = sqrt((1 + 4 + 9) / 3) = sqrt(14/3)
        expected = math.sqrt(14 / 3)
        assert rmse(obs, sim) == pytest.approx(expected, rel=1e-6)

    def test_rmse_non_negative(self):
        rng = np.random.default_rng(0)
        obs = rng.normal(5, 2, 50)
        sim = rng.normal(6, 2, 50)
        assert rmse(obs, sim) >= 0


# ---------------------------------------------------------------------------
# PBIAS tests
# ---------------------------------------------------------------------------

class TestPBIAS:
    def test_zero_bias_perfect_forecast(self, perfect_pair):
        obs, sim = perfect_pair
        assert pbias(obs, sim) == pytest.approx(0.0)

    def test_overestimation_positive(self):
        obs = np.array([10.0, 10.0])
        sim = np.array([12.0, 12.0])
        # PBIAS = 100 * (24 - 20) / 20 = 20%
        assert pbias(obs, sim) == pytest.approx(20.0)

    def test_underestimation_negative(self):
        obs = np.array([10.0, 10.0])
        sim = np.array([8.0, 8.0])
        assert pbias(obs, sim) == pytest.approx(-20.0)

    def test_zero_obs_returns_nan(self):
        obs = np.zeros(3)
        sim = np.ones(3)
        result = pbias(obs, sim)
        assert math.isnan(result)


# ---------------------------------------------------------------------------
# Correlation tests
# ---------------------------------------------------------------------------

class TestCorrelation:
    def test_perfect_positive_correlation(self, perfect_pair):
        obs, sim = perfect_pair
        assert correlation(obs, sim) == pytest.approx(1.0)

    def test_perfect_negative_correlation(self):
        obs = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
        sim = np.array([5.0, 4.0, 3.0, 2.0, 1.0])
        assert correlation(obs, sim) == pytest.approx(-1.0)

    def test_insufficient_data_returns_nan(self):
        obs = np.array([1.0])
        sim = np.array([1.0])
        assert math.isnan(correlation(obs, sim))


# ---------------------------------------------------------------------------
# skill_score tests
# ---------------------------------------------------------------------------

class TestSkillScore:
    def test_perfect_forecast_returns_one(self, perfect_pair):
        obs, sim = perfect_pair
        rng = np.random.default_rng(5)
        ref = obs + rng.normal(0, 2, len(obs))
        result = skill_score(rmse, obs, sim, ref)
        assert result == pytest.approx(1.0, abs=1e-6)

    def test_skill_score_with_mocked_metric(self):
        mock_metric = MagicMock()
        mock_metric.side_effect = [0.5, 1.0]  # forecast score, reference score
        obs = np.array([1.0, 2.0, 3.0])
        forecast = np.array([1.1, 2.1, 3.1])
        reference = np.array([2.0, 3.0, 4.0])
        result = skill_score(mock_metric, obs, forecast, reference)
        # 1 - 0.5/1.0 = 0.5
        assert result == pytest.approx(0.5)
        assert mock_metric.call_count == 2

    def test_zero_reference_score_returns_nan(self):
        obs = np.array([1.0, 2.0, 3.0])
        mock_metric = MagicMock(side_effect=[0.5, 0.0])
        result = skill_score(mock_metric, obs, obs.copy(), obs.copy())
        assert math.isnan(result)


# ---------------------------------------------------------------------------
# evaluate_hindcast_period tests
# ---------------------------------------------------------------------------

class TestEvaluateHindcastPeriod:
    def test_returns_all_keys(self):
        obs_df = pd.DataFrame({"value": [1.0, 2.0, 3.0, 4.0, 5.0]})
        hnd_df = pd.DataFrame({"value": [1.0, 2.0, 3.0, 4.0, 5.0]})
        results = evaluate_hindcast_period(obs_df, hnd_df, "value")
        assert set(results.keys()) == {"nse", "kge", "rmse", "pbias", "correlation"}

    def test_perfect_forecast_scores(self):
        values = [10.0, 20.0, 30.0, 40.0]
        obs_df = pd.DataFrame({"value": values})
        hnd_df = pd.DataFrame({"value": values})
        results = evaluate_hindcast_period(obs_df, hnd_df, "value")
        assert results["nse"] == pytest.approx(1.0)
        assert results["rmse"] == pytest.approx(0.0)
        assert results["pbias"] == pytest.approx(0.0)
        assert results["correlation"] == pytest.approx(1.0)
