import os

import pytest
import requests


BACKEND_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BACKEND_URL:
    env_path = "/app/frontend/.env"
    for line in open(env_path):
        if line.startswith("REACT_APP_BACKEND_URL="):
            BACKEND_URL = line.split("=", 1)[1].strip().strip('"')
            break
BASE_URL = BACKEND_URL.rstrip("/")


@pytest.fixture
def api_client():
    return requests.Session()


def test_health_endpoint(api_client):
    response = api_client.get(f"{BASE_URL}/api/")
    assert response.status_code == 200
    assert response.json()["message"] == "TECH SICK Intelligence API online"


def test_analyze_rejects_malformed_profile_input(api_client):
    response = api_client.post(f"{BASE_URL}/api/analyze", json={"profile_url": "!"})
    assert response.status_code == 422
    assert "detail" in response.json()


def test_analyze_rejects_non_instagram_profile_host(api_client):
    response = api_client.post(f"{BASE_URL}/api/analyze", json={"profile_url": "https://notinstagram.com/brand"})
    assert response.status_code == 400
    assert "valid public Instagram profile URL" in response.json()["detail"]


def test_analyze_live_profile_returns_profile_intelligence(api_client):
    response = api_client.post(f"{BASE_URL}/api/analyze", json={"profile_url": "@glossier"}, timeout=30)
    assert response.status_code == 200
    payload = response.json()
    assert payload["profile"]["username"] == "glossier"
    assert payload["intelligence"]["classification"]
    assert isinstance(payload["intelligence"]["pillars"], list)
    assert 0 <= payload["intelligence"]["lead_score"] <= 100
    assert payload["source"]
    assert payload["analyzed_at"]