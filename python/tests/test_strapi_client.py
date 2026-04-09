"""Unit tests for tama_hidrovias.database.strapi_client (no network calls)."""

from __future__ import annotations

import json
from unittest.mock import MagicMock, call, patch

import pytest
import requests

from tama_hidrovias.database.strapi_client import StrapiClient, _MAX_RETRIES


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_response(
    status_code: int = 200,
    body: dict | list | None = None,
    content: bytes | None = None,
) -> MagicMock:
    """Build a mock requests.Response."""
    resp = MagicMock(spec=requests.Response)
    resp.status_code = status_code
    body_data = body if body is not None else {}
    resp.json.return_value = body_data
    resp.content = content if content is not None else json.dumps(body_data).encode()
    if status_code >= 400:
        resp.raise_for_status.side_effect = requests.exceptions.HTTPError(
            f"HTTP {status_code}", response=resp
        )
    else:
        resp.raise_for_status.return_value = None
    return resp


@pytest.fixture()
def client() -> StrapiClient:
    return StrapiClient(base_url="https://strapi.test", api_token="test-token")


# ---------------------------------------------------------------------------
# get_stations
# ---------------------------------------------------------------------------

class TestGetStations:
    def test_returns_list(self, client):
        stations_payload = {
            "data": [{"id": 1, "attributes": {"code": "ST001"}}],
            "meta": {"pagination": {"page": 1, "pageCount": 1}},
        }
        with patch.object(client._session, "request") as mock_req:
            mock_req.return_value = _make_response(200, stations_payload)
            result = client.get_stations()
        assert isinstance(result, list)
        assert len(result) == 1
        assert result[0]["id"] == 1

    def test_paginates_multiple_pages(self, client):
        page1 = {
            "data": [{"id": 1}],
            "meta": {"pagination": {"page": 1, "pageCount": 2}},
        }
        page2 = {
            "data": [{"id": 2}],
            "meta": {"pagination": {"page": 2, "pageCount": 2}},
        }
        with patch.object(client._session, "request") as mock_req:
            mock_req.side_effect = [
                _make_response(200, page1),
                _make_response(200, page2),
            ]
            result = client.get_stations()
        assert len(result) == 2
        assert mock_req.call_count == 2

    def test_empty_data_returns_empty_list(self, client):
        payload = {"data": [], "meta": {"pagination": {"pageCount": 1}}}
        with patch.object(client._session, "request") as mock_req:
            mock_req.return_value = _make_response(200, payload)
            result = client.get_stations()
        assert result == []


# ---------------------------------------------------------------------------
# create_station
# ---------------------------------------------------------------------------

class TestCreateStation:
    def test_calls_correct_endpoint(self, client):
        created = {"data": {"id": 42, "attributes": {"code": "NEW"}}}
        with patch.object(client._session, "request") as mock_req:
            mock_req.return_value = _make_response(201, created)
            result = client.create_station({"code": "NEW", "name": "New Station"})

        mock_req.assert_called_once()
        call_args = mock_req.call_args
        assert call_args[0][0] == "POST"
        assert call_args[0][1].endswith("/api/stations")

    def test_sends_data_wrapper(self, client):
        with patch.object(client._session, "request") as mock_req:
            mock_req.return_value = _make_response(201, {"data": {"id": 1}})
            client.create_station({"code": "X1"})
        _, kwargs = mock_req.call_args
        assert "json" in kwargs
        assert "data" in kwargs["json"]
        assert kwargs["json"]["data"]["code"] == "X1"


# ---------------------------------------------------------------------------
# batch_insert_measurements
# ---------------------------------------------------------------------------

class TestBatchInsertMeasurements:
    def test_calls_post_n_times(self, client):
        records = [
            {"datetime": "2023-01-01", "value": 1.0},
            {"datetime": "2023-01-02", "value": 2.0},
            {"datetime": "2023-01-03", "value": 3.0},
        ]
        with patch.object(client._session, "request") as mock_req:
            mock_req.return_value = _make_response(201, {"data": {"id": 1}})
            client.batch_insert_measurements(records)

        assert mock_req.call_count == 3

    def test_all_calls_use_post_method(self, client):
        records = [{"value": i} for i in range(3)]
        with patch.object(client._session, "request") as mock_req:
            mock_req.return_value = _make_response(201, {"data": {}})
            client.batch_insert_measurements(records)

        for c in mock_req.call_args_list:
            assert c[0][0] == "POST"

    def test_skips_failed_record_and_continues(self, client):
        """A single failed record should not abort the batch."""
        records = [{"value": 1}, {"value": 2}, {"value": 3}]
        responses = [
            _make_response(201, {"data": {}}),
            _make_response(500),  # will raise on 500
            _make_response(201, {"data": {}}),
        ]
        # On 500, _request raises after retries; simulate the final raised exc
        error_resp = _make_response(500)
        error_resp.raise_for_status.side_effect = requests.exceptions.HTTPError(
            "500", response=error_resp
        )

        call_count = 0

        def side_effect(*args, **kwargs):
            nonlocal call_count
            r = responses[call_count % len(responses)]
            call_count += 1
            return r

        with patch.object(client._session, "request", side_effect=side_effect):
            # Should not raise even if one record fails (after retries)
            # We patch sleep to avoid waiting
            with patch("tama_hidrovias.database.strapi_client.time.sleep"):
                client.batch_insert_measurements(records)


# ---------------------------------------------------------------------------
# Retry on 500 error
# ---------------------------------------------------------------------------

class TestRetryBehavior:
    def test_retries_on_500_error(self, client):
        """Client must attempt exactly _MAX_RETRIES times before raising."""
        error_resp = _make_response(500)

        with patch.object(client._session, "request", return_value=error_resp) as mock_req:
            with patch("tama_hidrovias.database.strapi_client.time.sleep"):
                with pytest.raises(requests.exceptions.HTTPError):
                    client.get_stations()

        assert mock_req.call_count == _MAX_RETRIES

    def test_succeeds_on_second_attempt(self, client):
        """Should succeed when second attempt returns 200."""
        error_resp = _make_response(500)
        ok_payload = {
            "data": [{"id": 1}],
            "meta": {"pagination": {"pageCount": 1}},
        }
        ok_resp = _make_response(200, ok_payload)

        with patch.object(
            client._session, "request", side_effect=[error_resp, ok_resp]
        ):
            with patch("tama_hidrovias.database.strapi_client.time.sleep"):
                result = client.get_stations()

        assert len(result) == 1

    def test_connection_error_retried(self, client):
        conn_error = requests.exceptions.ConnectionError("connection refused")
        ok_payload = {
            "data": [],
            "meta": {"pagination": {"pageCount": 1}},
        }
        ok_resp = _make_response(200, ok_payload)

        with patch.object(
            client._session, "request", side_effect=[conn_error, ok_resp]
        ):
            with patch("tama_hidrovias.database.strapi_client.time.sleep"):
                result = client.get_stations()

        assert result == []


# ---------------------------------------------------------------------------
# Authorization header
# ---------------------------------------------------------------------------

class TestAuthHeader:
    def test_authorization_header_set(self, client):
        assert client._session.headers["Authorization"] == "Bearer test-token"

    def test_custom_base_url_stored(self):
        c = StrapiClient("https://my-strapi.io/", "abc123")
        assert c.base_url == "https://my-strapi.io"  # trailing slash stripped
