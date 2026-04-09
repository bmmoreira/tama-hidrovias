# tama-hidrovias Python Data Pipeline

A production-grade Python data pipeline for the **tama-hidrovias** Brazilian hydrology platform.

## Overview

This package provides end-to-end automation for collecting, processing, bias-correcting, evaluating, and storing hydrological and climate data relevant to Brazilian inland waterways.

## Package structure

```
python/
├── tama_hidrovias/
│   ├── data_collection/   # ANA, HydroWeb, SNIRH collectors
│   ├── climate_models/    # ERA5, CHIRPS, GFS downloaders
│   ├── processing/        # Spatial/temporal standardisation & basin masking
│   ├── bias_correction/   # Quantile-mapping & delta-method correction
│   ├── evaluation/        # NSE, KGE, RMSE and other skill scores
│   ├── automation/        # APScheduler-based pipeline orchestration
│   └── database/          # Strapi REST API client & insertion scripts
└── tests/                 # pytest unit tests (mocked; no network calls)
```

## Quick start

```bash
pip install -e python/
cp .env.example .env   # fill in API keys and Strapi credentials
python -m tama_hidrovias.automation.pipeline
```

## Environment variables

| Variable | Description |
|---|---|
| `CDS_API_KEY` | Copernicus Climate Data Store API key for ERA5 |
| `STRAPI_URL` | Base URL of the Strapi CMS instance |
| `STRAPI_TOKEN` | Strapi API bearer token |
| `ANA_BASE_URL` | Override for ANA telemetry service URL |

## Running tests

```bash
cd python
pytest tests/ -v
```
