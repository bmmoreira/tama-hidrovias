"""Strapi v4 REST API client with retry logic."""

from __future__ import annotations

import logging
import time
from typing import Any, Optional

import requests

logger = logging.getLogger(__name__)

_MAX_RETRIES = 3
_RETRY_BACKOFF_BASE = 2  # seconds; actual wait = base ** attempt


class StrapiClient:
    """Interact with a Strapi v4 CMS instance via its REST API.

    Parameters
    ----------
    base_url:
        Root URL of the Strapi instance (e.g. ``"https://cms.example.com"``).
    api_token:
        Strapi API token used in the ``Authorization: Bearer`` header.
    timeout:
        Per-request timeout in seconds.
    """

    def __init__(
        self,
        base_url: str,
        api_token: str,
        timeout: int = 30,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._session = requests.Session()
        self._session.headers.update(
            {
                "Authorization": f"Bearer {api_token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            }
        )

    # ------------------------------------------------------------------
    # Stations
    # ------------------------------------------------------------------

    def get_stations(self, page_size: int = 100) -> list[dict]:
        """Retrieve all stations with automatic pagination.

        Parameters
        ----------
        page_size:
            Number of records per page.

        Returns
        -------
        list[dict]
            All station records from Strapi.
        """
        stations: list[dict] = []
        page = 1
        while True:
            params = {"pagination[page]": page, "pagination[pageSize]": page_size}
            data = self._request("GET", "/api/stations", params=params)
            results = (data.get("data") or []) if isinstance(data, dict) else []
            stations.extend(results)
            meta = data.get("meta", {}) if isinstance(data, dict) else {}
            total_pages = meta.get("pagination", {}).get("pageCount", 1)
            if page >= total_pages:
                break
            page += 1
        logger.info("Retrieved %d station(s) from Strapi", len(stations))
        return stations

    def create_station(self, data: dict[str, Any]) -> dict:
        """Create a new station record in Strapi.

        Parameters
        ----------
        data:
            Field values for the new station.

        Returns
        -------
        dict
            The created Strapi record.
        """
        payload = {"data": data}
        result = self._request("POST", "/api/stations", json=payload)
        logger.info("Created station: %s", data.get("code", data))
        return result

    # ------------------------------------------------------------------
    # Measurements
    # ------------------------------------------------------------------

    def upsert_measurement(
        self,
        station_id: int,
        datetime_val: str,
        value: float,
        variable: str,
    ) -> dict:
        """Insert a measurement, updating it if one already exists.

        Strapi v4 does not natively support upsert; this method checks for
        an existing record first and PATCHes it if found, otherwise POSTs.

        Parameters
        ----------
        station_id:
            Strapi station record ID.
        datetime_val:
            ISO-8601 datetime string.
        value:
            Measured value.
        variable:
            Variable name (e.g. ``"flow_m3s"``).

        Returns
        -------
        dict
            Created or updated Strapi record.
        """
        filters = {
            "filters[station][id][$eq]": station_id,
            "filters[datetime][$eq]": datetime_val,
            "filters[variable][$eq]": variable,
        }
        existing = self._request("GET", "/api/measurements", params=filters)
        existing_data = existing.get("data", []) if isinstance(existing, dict) else []

        payload = {
            "data": {
                "station": station_id,
                "datetime": datetime_val,
                "value": value,
                "variable": variable,
            }
        }
        if existing_data:
            record_id = existing_data[0]["id"]
            result = self._request("PUT", f"/api/measurements/{record_id}", json=payload)
            logger.debug("Updated measurement id=%s", record_id)
        else:
            result = self._request("POST", "/api/measurements", json=payload)
            logger.debug("Created measurement: station=%s  %s  %s", station_id, datetime_val, variable)

        return result

    def batch_insert_measurements(self, records: list[dict[str, Any]]) -> None:
        """Insert a list of measurement dictionaries.

        Each dict should contain the field names expected by Strapi's
        ``/api/measurements`` endpoint.

        Parameters
        ----------
        records:
            List of measurement dicts.
        """
        logger.info("Batch inserting %d measurement(s)", len(records))
        for i, record in enumerate(records):
            try:
                self._request("POST", "/api/measurements", json={"data": record})
            except Exception as exc:
                logger.error("Failed to insert record %d: %s", i, exc)

        logger.info("Batch insert complete for %d record(s)", len(records))

    # ------------------------------------------------------------------
    # Forecasts
    # ------------------------------------------------------------------

    def create_forecast(
        self,
        station_id: int,
        issued_at: str,
        lead_time_days: int,
        value: float,
        variable: str,
        model: str,
    ) -> dict:
        """Create a forecast record in Strapi.

        Parameters
        ----------
        station_id:
            Strapi station record ID.
        issued_at:
            ISO-8601 datetime when the forecast was issued.
        lead_time_days:
            Forecast lead time in days.
        value:
            Forecast value.
        variable:
            Variable name.
        model:
            Model identifier (e.g. ``"GFS"``, ``"ERA5"``).

        Returns
        -------
        dict
            Created Strapi record.
        """
        payload = {
            "data": {
                "station": station_id,
                "issued_at": issued_at,
                "lead_time_days": lead_time_days,
                "value": value,
                "variable": variable,
                "model": model,
            }
        }
        result = self._request("POST", "/api/forecasts", json=payload)
        logger.debug(
            "Created forecast: station=%s  issued=%s  lead=%dd  model=%s",
            station_id,
            issued_at,
            lead_time_days,
            model,
        )
        return result

    # ------------------------------------------------------------------
    # File upload
    # ------------------------------------------------------------------

    def upload_geotiff(self, file_path: str, title: str) -> dict:
        """Upload a GeoTIFF (or any file) via the Strapi media library.

        Parameters
        ----------
        file_path:
            Local path to the file to upload.
        title:
            Caption/title for the uploaded file.

        Returns
        -------
        dict
            Strapi upload response.
        """
        # Set Content-Type to None so that requests auto-sets the
        # multipart/form-data boundary — required for file uploads.
        headers = {"Content-Type": None}
        with open(file_path, "rb") as fh:
            files = {"files": (title, fh, "image/tiff")}
            import json as _json
            data = {"fileInfo": _json.dumps({"caption": title})}
            result = self._request(
                "POST", "/api/upload", files=files, data=data, extra_headers=headers
            )
        logger.info("Uploaded file '%s' to Strapi", title)
        return result

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _request(
        self,
        method: str,
        path: str,
        extra_headers: Optional[dict] = None,
        **kwargs: Any,
    ) -> Any:
        """Send an HTTP request with retry logic.

        Parameters
        ----------
        method:
            HTTP method (``"GET"``, ``"POST"``, etc.).
        path:
            URL path (appended to *base_url*).
        extra_headers:
            Headers to merge (or clear) for this request only.
        **kwargs:
            Forwarded to ``requests.Session.request``.

        Returns
        -------
        Any
            Parsed JSON response body.

        Raises
        ------
        requests.HTTPError
            When all retry attempts are exhausted.
        """
        url = self.base_url + path
        headers: dict = {}
        if extra_headers:
            headers.update(extra_headers)

        last_exc: Optional[Exception] = None
        for attempt in range(_MAX_RETRIES):
            try:
                resp = self._session.request(
                    method,
                    url,
                    timeout=self.timeout,
                    headers=headers or None,
                    **kwargs,
                )
                if resp.status_code >= 500:
                    raise requests.exceptions.HTTPError(
                        f"Server error {resp.status_code}", response=resp
                    )
                resp.raise_for_status()
                return resp.json() if resp.content else {}
            except (requests.exceptions.HTTPError, requests.exceptions.ConnectionError) as exc:
                last_exc = exc
                wait = _RETRY_BACKOFF_BASE**attempt
                logger.warning(
                    "Request failed (attempt %d/%d): %s. Retrying in %ds …",
                    attempt + 1,
                    _MAX_RETRIES,
                    exc,
                    wait,
                )
                time.sleep(wait)
            except requests.exceptions.RequestException as exc:
                logger.error("Non-retryable request error: %s", exc)
                raise

        logger.error("All %d retry attempts exhausted for %s %s", _MAX_RETRIES, method, path)
        raise last_exc  # type: ignore[misc]
