# tama-hidrovias Platform

A multi-service platform for the **tama-hidrovias** Brazilian hydrology platform, providing data collection, processing, and a web-based dashboard.

## Project Services

This repository is a monorepo containing the source code for the entire tama-hidrovias stack. Each service is located in a top-level directory:

-   **[`/web`](./web):** A Next.js dashboard for data visualization.
-   **`/cms`:** A Strapi-based headless CMS serving the data API.
-   **`/pipeline`:** A Python pipeline for collecting and processing hydrological data.
-   **`/docs`:** Project and architecture documentation (Sphinx).
-   **`/tileserver`:** Raster tile service.
-   **`/pgadmin`:** pgAdmin bootstrap configuration.

> **Note:** Each service directory contains its own detailed `README.md` and configuration.

## Getting Started

To set up the full stack for local development, please see the **Contributing Guide** for instructions on using Docker Compose and running individual services.