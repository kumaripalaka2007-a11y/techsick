import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from pymongo import MongoClient


BACKEND_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BACKEND_URL:
    env_path = "/app/frontend/.env"
    for line in open(env_path):
        if line.startswith("REACT_APP_BACKEND_URL="):
            BACKEND_URL = line.split("=", 1)[1].strip().strip('"')
            break
BASE_URL = BACKEND_URL.rstrip("/")


def _backend_env(key):
    for line in open("/app/backend/.env"):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip().strip('"')
    raise RuntimeError(f"{key} not found in backend/.env")


@pytest.fixture
def api_client():
    return requests.Session()


@pytest.fixture
def auth_client():
    session = requests.Session()
    mongo = MongoClient(_backend_env("MONGO_URL"))
    db = mongo[_backend_env("DB_NAME")]
    user_id = f"test-user-{uuid.uuid4().hex[:8]}"
    token = f"test_session_{uuid.uuid4().hex[:12]}"
    db.users.insert_one({"user_id": user_id, "email": f"{user_id}@example.com", "name": "Test User", "picture": None, "created_at": datetime.now(timezone.utc)})
    db.user_sessions.insert_one({"user_id": user_id, "session_token": token, "expires_at": datetime.now(timezone.utc) + timedelta(days=7), "created_at": datetime.now(timezone.utc)})
    session.headers["Authorization"] = f"Bearer {token}"
    yield session
    db.users.delete_one({"user_id": user_id})
    db.user_sessions.delete_one({"session_token": token})


def test_health_endpoint(api_client):
    response = api_client.get(f"{BASE_URL}/api/")
    assert response.status_code == 200
    assert response.json()["message"] == "TECH SICK Intelligence API online"


def test_auth_me_requires_sign_in(api_client):
    response = api_client.get(f"{BASE_URL}/api/auth/me")
    assert response.status_code == 401


def test_auth_me_returns_user_with_valid_session(auth_client):
    response = auth_client.get(f"{BASE_URL}/api/auth/me")
    assert response.status_code == 200
    payload = response.json()
    assert payload["user_id"].startswith("test-user-")
    assert payload["email"].endswith("@example.com")
    assert "_id" not in payload


def test_proxy_image_rejects_unsupported_host(auth_client):
    response = auth_client.get(f"{BASE_URL}/api/proxy-image", params={"url": "https://evil.example.com/pic.jpg"})
    assert response.status_code == 400
    assert "Unsupported image host" in response.json()["detail"]


def test_proxy_image_rejects_non_https(auth_client):
    response = auth_client.get(f"{BASE_URL}/api/proxy-image", params={"url": "http://scontent.cdninstagram.com/pic.jpg"})
    assert response.status_code == 400


def test_analyze_requires_sign_in(api_client):
    response = api_client.post(f"{BASE_URL}/api/analyze", json={"profile_url": "@glossier"})
    assert response.status_code == 401


def test_analyze_rejects_malformed_profile_input(auth_client):
    response = auth_client.post(f"{BASE_URL}/api/analyze", json={"profile_url": "!"})
    assert response.status_code == 422
    assert "detail" in response.json()


def test_analyze_rejects_non_instagram_profile_host(auth_client):
    response = auth_client.post(f"{BASE_URL}/api/analyze", json={"profile_url": "https://notinstagram.com/brand"})
    assert response.status_code == 400
    assert "valid public Instagram profile URL" in response.json()["detail"]


def test_analyze_live_profile_returns_profile_intelligence(auth_client):
    response = auth_client.post(f"{BASE_URL}/api/analyze", json={"profile_url": "@glossier"}, timeout=150)
    assert response.status_code == 200
    payload = response.json()
    assert payload["profile"]["username"] == "glossier"
    assert payload["profile"]["profile_pic_url"]
    assert payload["profile"]["profile_pic_url"].startswith("https://")
    assert payload["intelligence"]["classification"]
    assert isinstance(payload["intelligence"]["pillars"], list)
    assert 0 <= payload["intelligence"]["lead_score"] <= 100
    assert payload["source"]
    assert payload["analyzed_at"]
    intel = payload["intelligence"]
    assert intel["niche_category"] in ["Tech & Dev", "Fitness & Wellness", "Fashion & Lifestyle", "Food & Local Business", "Creator & Art", "SaaS & B2B", "Beauty & Skincare", "Other"]
    assert isinstance(intel["sub_niches"], list) and intel["sub_niches"]
    assert isinstance(intel["palette"], list) and all(c.startswith("#") for c in intel["palette"])
    assert 1 <= intel["consistency_score"] <= 100
    assert 1 <= intel["collab_fit_score"] <= 100
    assert intel["sponsorship_readiness"] in ["Low", "Medium", "High"]
    assert intel["audience"]["age_range"]
    assert intel["buyer_persona"]["pain_points"]
    assert sum(h["share"] for h in intel["hook_archetypes"]) == 100
    assert sum(m["pct"] for m in intel["content_mix"]) == 100
    assert len(intel["pitch"]) > 100
    analytics = payload["analytics"]
    assert analytics["cadence_label"]
    assert analytics["posts_analyzed"] > 0
    assert analytics["consistency_status"] in ["Highly Consistent", "Moderate / Sporadic", "Inactive"]
    assert 1 <= analytics["consistency_score"] <= 100
    assert analytics["engagement_tier"] in ["Below Average", "Average", "Above Average", "Exceptional"]
    assert analytics["location"]["confidence"] in ["High", "Medium", "Low"]
    assert analytics["community_pulse"]
    assert analytics["responsiveness"] in ["Active Responder", "Passive Broadcaster", "Unknown"]
