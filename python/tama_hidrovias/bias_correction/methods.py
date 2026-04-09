"""Bias-correction methods for hydro-meteorological forecasts."""

from __future__ import annotations

import logging

import numpy as np

logger = logging.getLogger(__name__)


def quantile_mapping(
    obs: np.ndarray,
    hindcast: np.ndarray,
    forecast: np.ndarray,
) -> np.ndarray:
    """Empirical quantile mapping (EQM) bias correction.

    Maps each value in *forecast* through a transfer function derived from the
    cumulative distribution functions (CDFs) of *obs* and *hindcast*.

    Parameters
    ----------
    obs:
        1-D array of observed values used to build the reference CDF.
    hindcast:
        1-D array of modelled values over the training period (same variable
        and period as *obs*).
    forecast:
        1-D array of raw model values to be corrected.

    Returns
    -------
    numpy.ndarray
        Bias-corrected forecast array with the same shape as *forecast*.
    """
    obs = np.asarray(obs, dtype=float)
    hindcast = np.asarray(hindcast, dtype=float)
    forecast = np.asarray(forecast, dtype=float)

    # Build empirical quantile transfer function
    obs_sorted = np.sort(obs[~np.isnan(obs)])
    hnd_sorted = np.sort(hindcast[~np.isnan(hindcast)])

    n_obs = len(obs_sorted)
    n_hnd = len(hnd_sorted)

    # Quantile levels for observed and hindcast distributions
    obs_quantiles = np.linspace(0, 1, n_obs)
    hnd_quantiles = np.linspace(0, 1, n_hnd)

    corrected = np.empty_like(forecast)
    for i, val in enumerate(forecast):
        if np.isnan(val):
            corrected[i] = np.nan
            continue
        # Find what quantile *val* corresponds to in the hindcast CDF
        q = np.interp(val, hnd_sorted, hnd_quantiles)
        # Map that quantile to the observed CDF
        corrected[i] = np.interp(q, obs_quantiles, obs_sorted)

    logger.debug(
        "Quantile mapping applied: forecast shape=%s  corrected shape=%s",
        forecast.shape,
        corrected.shape,
    )
    return corrected


def delta_method(
    obs: np.ndarray,
    hindcast: np.ndarray,
    forecast: np.ndarray,
) -> np.ndarray:
    """Multiplicative (ratio-based) delta-method bias correction for precipitation.

    Computes the ratio between the climatological means of *obs* and *hindcast*
    and multiplies *forecast* by that ratio, clamping the result to be
    non-negative.

    Parameters
    ----------
    obs:
        1-D array of observed precipitation values.
    hindcast:
        1-D array of modelled precipitation values for the training period.
    forecast:
        1-D array of raw forecast precipitation to be corrected.

    Returns
    -------
    numpy.ndarray
        Bias-corrected, non-negative precipitation forecast.
    """
    obs = np.asarray(obs, dtype=float)
    hindcast = np.asarray(hindcast, dtype=float)
    forecast = np.asarray(forecast, dtype=float)

    mean_obs = np.nanmean(obs)
    mean_hnd = np.nanmean(hindcast)

    if mean_hnd == 0.0:
        logger.warning(
            "Hindcast mean is zero; delta method cannot compute ratio. "
            "Returning forecast unchanged."
        )
        return forecast.copy()

    # Multiplicative delta (ratio-based) is more appropriate for precipitation
    ratio = mean_obs / mean_hnd
    corrected = forecast * ratio
    corrected = np.maximum(corrected, 0.0)  # precipitation must be non-negative

    logger.debug(
        "Delta method applied: mean_obs=%.4f  mean_hnd=%.4f  ratio=%.4f",
        mean_obs,
        mean_hnd,
        ratio,
    )
    return corrected


def evaluate_bias(
    obs: np.ndarray,
    hindcast: np.ndarray,
) -> dict[str, float]:
    """Compute bias statistics between observations and hindcast.

    Parameters
    ----------
    obs:
        1-D array of observed values.
    hindcast:
        1-D array of hindcast (modelled) values, same length as *obs*.

    Returns
    -------
    dict
        Keys: ``mean_bias``, ``relative_bias_pct``, ``correlation``.
    """
    obs = np.asarray(obs, dtype=float)
    hindcast = np.asarray(hindcast, dtype=float)

    mask = ~(np.isnan(obs) | np.isnan(hindcast))
    obs_v = obs[mask]
    hnd_v = hindcast[mask]

    mean_bias = float(np.mean(hnd_v - obs_v))

    mean_obs = float(np.mean(obs_v))
    relative_bias_pct = (mean_bias / mean_obs * 100.0) if mean_obs != 0.0 else float("nan")

    if len(obs_v) < 2 or np.std(obs_v) == 0 or np.std(hnd_v) == 0:
        corr = float("nan")
    else:
        corr = float(np.corrcoef(obs_v, hnd_v)[0, 1])

    result = {
        "mean_bias": mean_bias,
        "relative_bias_pct": relative_bias_pct,
        "correlation": corr,
    }
    logger.debug("Bias evaluation: %s", result)
    return result
