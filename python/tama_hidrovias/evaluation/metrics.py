"""Hydrological skill-score metrics."""

from __future__ import annotations

import logging
from typing import Callable

import numpy as np
import pandas as pd
from scipy import stats

logger = logging.getLogger(__name__)


def _clean_pair(observed: np.ndarray, simulated: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Return co-valid (non-NaN) pairs from *observed* and *simulated*."""
    obs = np.asarray(observed, dtype=float)
    sim = np.asarray(simulated, dtype=float)
    if obs.shape != sim.shape:
        raise ValueError(
            f"observed and simulated must have the same shape, "
            f"got {obs.shape} vs {sim.shape}"
        )
    mask = ~(np.isnan(obs) | np.isnan(sim))
    return obs[mask], sim[mask]


def nse(observed: np.ndarray, simulated: np.ndarray) -> float:
    """Nash-Sutcliffe Efficiency (NSE).

    Perfect score: 1.0.  A score of 0 means the model is no better than
    predicting the mean.  Negative values indicate worse than mean prediction.

    Parameters
    ----------
    observed:
        Array of observed values.
    simulated:
        Array of simulated values.

    Returns
    -------
    float
        NSE value in (−∞, 1].
    """
    obs, sim = _clean_pair(observed, simulated)
    if len(obs) == 0:
        return float("nan")
    numerator = np.sum((obs - sim) ** 2)
    denominator = np.sum((obs - np.mean(obs)) ** 2)
    if denominator == 0.0:
        return float("nan")
    return float(1.0 - numerator / denominator)


def kge(observed: np.ndarray, simulated: np.ndarray) -> float:
    """Kling-Gupta Efficiency (KGE).

    Decomposes performance into correlation (r), bias ratio (β), and
    variability ratio (α).  Perfect score: 1.0.

    Parameters
    ----------
    observed:
        Array of observed values.
    simulated:
        Array of simulated values.

    Returns
    -------
    float
        KGE value in (−∞, 1].
    """
    obs, sim = _clean_pair(observed, simulated)
    if len(obs) < 2:
        return float("nan")

    std_obs = np.std(obs, ddof=1)
    std_sim = np.std(sim, ddof=1)
    mean_obs = np.mean(obs)
    mean_sim = np.mean(sim)

    if std_obs == 0 or mean_obs == 0:
        return float("nan")

    r = float(np.corrcoef(obs, sim)[0, 1])
    alpha = std_sim / std_obs  # variability ratio
    beta = mean_sim / mean_obs  # bias ratio

    kge_val = 1.0 - np.sqrt((r - 1) ** 2 + (alpha - 1) ** 2 + (beta - 1) ** 2)
    return float(kge_val)


def rmse(observed: np.ndarray, simulated: np.ndarray) -> float:
    """Root Mean Squared Error (RMSE).

    Parameters
    ----------
    observed:
        Array of observed values.
    simulated:
        Array of simulated values.

    Returns
    -------
    float
        RMSE ≥ 0.
    """
    obs, sim = _clean_pair(observed, simulated)
    if len(obs) == 0:
        return float("nan")
    return float(np.sqrt(np.mean((obs - sim) ** 2)))


def pbias(observed: np.ndarray, simulated: np.ndarray) -> float:
    """Percent Bias (PBIAS).

    Positive values indicate model over-estimation; negative values indicate
    under-estimation.

    Parameters
    ----------
    observed:
        Array of observed values.
    simulated:
        Array of simulated values.

    Returns
    -------
    float
        Percent bias (%).
    """
    obs, sim = _clean_pair(observed, simulated)
    total_obs = np.sum(obs)
    if total_obs == 0.0:
        return float("nan")
    return float(100.0 * np.sum(sim - obs) / total_obs)


def correlation(observed: np.ndarray, simulated: np.ndarray) -> float:
    """Pearson correlation coefficient.

    Parameters
    ----------
    observed:
        Array of observed values.
    simulated:
        Array of simulated values.

    Returns
    -------
    float
        Pearson r in [−1, 1].
    """
    obs, sim = _clean_pair(observed, simulated)
    if len(obs) < 2:
        return float("nan")
    r, _ = stats.pearsonr(obs, sim)
    return float(r)


def skill_score(
    metric_func: Callable[[np.ndarray, np.ndarray], float],
    observed: np.ndarray,
    forecast: np.ndarray,
    reference: np.ndarray,
) -> float:
    """Generic skill score relative to a reference forecast.

    Skill score = 1 − (metric_forecast / metric_reference)

    A positive skill score means the forecast outperforms the reference.
    A score of 1.0 represents a perfect forecast.

    Parameters
    ----------
    metric_func:
        Function with signature ``metric_func(observed, predicted) → float``
        where *lower values are better* (e.g. RMSE).
    observed:
        Array of observed values.
    forecast:
        Array of forecast values to evaluate.
    reference:
        Array of reference forecast values (e.g. climatology or persistence).

    Returns
    -------
    float
        Skill score.
    """
    score_forecast = metric_func(observed, forecast)
    score_reference = metric_func(observed, reference)

    if score_reference == 0.0:
        return float("nan")

    return float(1.0 - score_forecast / score_reference)


def evaluate_hindcast_period(
    obs_df: pd.DataFrame,
    hindcast_df: pd.DataFrame,
    value_col: str,
) -> dict[str, float]:
    """Run all skill-score metrics over an aligned observation/hindcast pair.

    Parameters
    ----------
    obs_df:
        DataFrame with at least a *value_col* column.
    hindcast_df:
        DataFrame with at least a *value_col* column, same length as *obs_df*.
    value_col:
        Name of the value column in both DataFrames.

    Returns
    -------
    dict
        Keys: ``nse``, ``kge``, ``rmse``, ``pbias``, ``correlation``.
    """
    obs_arr = obs_df[value_col].to_numpy(dtype=float)
    hnd_arr = hindcast_df[value_col].to_numpy(dtype=float)

    results = {
        "nse": nse(obs_arr, hnd_arr),
        "kge": kge(obs_arr, hnd_arr),
        "rmse": rmse(obs_arr, hnd_arr),
        "pbias": pbias(obs_arr, hnd_arr),
        "correlation": correlation(obs_arr, hnd_arr),
    }
    logger.info("Hindcast evaluation results: %s", results)
    return results
