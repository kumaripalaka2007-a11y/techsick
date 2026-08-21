from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Any
import uuid
from datetime import datetime, timedelta, timezone
import re
import json
from urllib.parse import urlparse
from fastapi.concurrency import run_in_threadpool
from apify_client import ApifyClient
from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta
import httpx


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

class AnalyzeRequest(BaseModel):
    profile_url: str = Field(min_length=2, max_length=300)

class AnalyzeResponse(BaseModel):
    profile: dict
    intelligence: dict
    analytics: dict
    source: str
    analyzed_at: str

class SessionRequest(BaseModel):
    session_id: str

@api_router.post("/auth/session")
async def create_auth_session(input: SessionRequest, response: Response):
    async with httpx.AsyncClient(timeout=10) as http:
        res = await http.get("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data", headers={"X-Session-ID": input.session_id})
    if res.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired sign-in session.")
    data = res.json()
    user = await db.users.find_one({"email": data["email"]}, {"_id": 0})
    if user:
        user_id = user["user_id"]
        await db.users.update_one({"user_id": user_id}, {"$set": {"name": data["name"], "picture": data.get("picture")}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({"user_id": user_id, "email": data["email"], "name": data["name"], "picture": data.get("picture"), "created_at": datetime.now(timezone.utc)})
    await db.user_sessions.insert_one({"user_id": user_id, "session_token": data["session_token"], "expires_at": datetime.now(timezone.utc) + timedelta(days=7), "created_at": datetime.now(timezone.utc)})
    response.set_cookie("session_token", data["session_token"], path="/", secure=True, httponly=True, samesite="none", max_age=7 * 24 * 3600)
    return {"user_id": user_id, "email": data["email"], "name": data["name"], "picture": data.get("picture")}

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("session_token")
    auth = request.headers.get("Authorization", "")
    if not token and auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Sign in with Google to run a live analysis.")
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Sign in with Google to run a live analysis.")
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")
    return user

@api_router.get("/auth/me")
async def auth_me(user: dict = Depends(get_current_user)):
    return user

@api_router.post("/auth/logout")
async def auth_logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/", secure=True, httponly=True, samesite="none")
    return {"ok": True}

ALLOWED_IMAGE_HOST_MARKERS = ("cdninstagram.com", "scontent", "instagram.com", "fbcdn.net")

@api_router.get("/proxy-image")
async def proxy_image(url: str):
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname or not any(marker in parsed.hostname for marker in ALLOWED_IMAGE_HOST_MARKERS):
        raise HTTPException(status_code=400, detail="Unsupported image host.")
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as http:
            res = await http.get(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Referer": "https://www.instagram.com/"})
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Could not fetch the image from Instagram CDN.") from exc
    if res.status_code != 200 or not res.content:
        raise HTTPException(status_code=502, detail="Image source rejected the request.")
    return Response(content=res.content, media_type=res.headers.get("content-type", "image/jpeg"), headers={"Cache-Control": "public, max-age=86400"})

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "TECH SICK Intelligence API online"}

def normalize_profile_url(value: str) -> str:
    value = value.strip()
    handle = value.replace("@", "").strip().rstrip("/")
    if handle.startswith("http://") or handle.startswith("https://"):
        parsed = urlparse(handle)
        if parsed.scheme not in {"http", "https"} or parsed.hostname not in {"instagram.com", "www.instagram.com"}:
            raise HTTPException(status_code=400, detail="Enter a valid public Instagram profile URL.")
        return handle if handle.endswith("/") else f"{handle}/"
    if not re.fullmatch(r"[A-Za-z0-9._]+", handle):
        raise HTTPException(status_code=400, detail="Enter a valid Instagram handle or profile URL.")
    return f"https://www.instagram.com/{handle}/"

def scrape_profile(url: str) -> dict:
    token = os.environ.get("APIFY_TOKEN")
    if not token:
        raise RuntimeError("APIFY_TOKEN is not configured. Add an Apify token to backend/.env to enable live extraction.")
    client = ApifyClient(token)
    run = client.actor("apify/instagram-scraper").call(run_input={
        "resultsType": "details",
        "directUrls": [url],
        "resultsLimit": 1,
    })
    items = list(client.dataset(run.default_dataset_id).iterate_items())
    if not items:
        raise RuntimeError("Apify returned no public profile data for this handle.")
    return items[0]

def scrape_comments(post_urls: list) -> list:
    token = os.environ.get("APIFY_TOKEN")
    if not token:
        return []
    client = ApifyClient(token)
    run = client.actor("apify/instagram-scraper").call(run_input={"resultsType": "comments", "directUrls": post_urls, "resultsLimit": 40})
    return list(client.dataset(run.default_dataset_id).iterate_items())

def compute_metrics(raw: dict, comments: list) -> dict:
    posts = [p for p in (raw.get("latestPosts") or []) if isinstance(p, dict)]
    stamps = []
    for p in posts:
        t = p.get("timestamp") or p.get("takenAt")
        if not t:
            continue
        try:
            dt = datetime.fromisoformat(str(t).replace("Z", "+00:00"))
            stamps.append(dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc))
        except ValueError:
            continue
    stamps.sort()
    followers = raw.get("followersCount") or 0
    likes = [p.get("likesCount") or 0 for p in posts]
    cmts = [p.get("commentsCount") or 0 for p in posts]
    avg_likes = round(sum(likes) / len(likes)) if likes else 0
    avg_comments = round(sum(cmts) / len(cmts)) if cmts else 0
    engagement_rate = round((avg_likes + avg_comments) / followers * 100, 2) if followers else None
    comment_like_ratio = round(avg_comments / avg_likes * 100, 2) if avg_likes else None
    cadence_label = "Unknown"
    last_post_days_ago = None
    if stamps:
        last_post_days_ago = (datetime.now(timezone.utc) - stamps[-1]).days
        if len(stamps) >= 2:
            span = max((stamps[-1] - stamps[0]).days, 1)
            per_week = round(len(stamps) / span * 7, 1)
            cadence_label = "Daily" if per_week >= 6.5 else ("Irregular" if span < 7 else f"{per_week} posts/week")
    owner = (raw.get("username") or "").lower()
    owner_comments = [c for c in comments if (c.get("ownerUsername") or "").lower() == owner]
    reply_rate = round(len(owner_comments) / len(comments) * 100) if comments else None
    location_names = sorted({p.get("locationName") for p in posts if p.get("locationName")})[:6]
    comment_samples = [(c.get("text") or "")[:160] for c in comments if (c.get("ownerUsername") or "").lower() != owner][:12]
    return {"cadence_label": cadence_label, "last_post_days_ago": last_post_days_ago, "posts_analyzed": len(posts), "avg_likes": avg_likes, "avg_comments": avg_comments, "engagement_rate": engagement_rate, "comment_like_ratio": comment_like_ratio, "owner_reply_rate": reply_rate, "location_names": location_names, "comment_samples": comment_samples}

def build_ai_context(raw: dict) -> dict:
    posts = raw.get("latestPosts") or []
    captions = [(p.get("caption") or "")[:280] for p in posts[:12] if isinstance(p, dict)]
    hashtags = sorted({tag for cap in captions for tag in re.findall(r"#(\w+)", cap)})[:20]
    return {
        "username": raw.get("username"), "fullName": raw.get("fullName"), "biography": raw.get("biography"),
        "externalUrl": raw.get("externalUrl"), "businessCategoryName": raw.get("businessCategoryName"),
        "isBusinessAccount": raw.get("isBusinessAccount"), "verified": raw.get("verified"),
        "followersCount": raw.get("followersCount"), "followsCount": raw.get("followsCount"),
        "postsCount": raw.get("postsCount"), "recent_captions": captions, "hashtags": hashtags,
    }

async def classify_profile(raw: dict, metrics: dict, comments: list) -> dict:
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise RuntimeError("EMERGENT_LLM_KEY is not configured.")
    context = build_ai_context(raw)
    context["posting_metrics"] = {k: v for k, v in metrics.items() if k not in {"comment_samples", "location_names"}}
    context["location_hints"] = {"biography": raw.get("biography"), "externalUrl": raw.get("externalUrl"), "post_geotags": metrics.get("location_names", [])}
    context["comment_samples"] = metrics.get("comment_samples", [])
    prompt = f'''Analyze this public Instagram profile for commercial intelligence. Return ONLY valid JSON with these keys:
- classification (string like "B2C E-Commerce" or "B2B SaaS")
- pillars (array of 3 content pillar strings)
- email, whatsapp, landing_page (string or null; never invent contact details)
- lead_score (integer 0-100), fit_label (string like "HIGH FIT"), rationale (string), signals (array of strings)
- niche_category (exactly one of: "Tech & Dev", "Fitness & Wellness", "Fashion & Lifestyle", "Food & Local Business", "Creator & Art", "SaaS & B2B", "Beauty & Skincare", "Other")
- niche_archetype (short label like "Tech & SaaS Creator" or "Fitness & Nutrition Coach")
- sub_niches (array of 3-5 hashtag strings like "#NextJS" or "#GymMotivation")
- palette (array of 4 hex color strings representing the brand visual identity, inferred from niche, bio and captions)
- visual_style_tags (array of 2-3 tags like "Minimalist", "Vibrant", "UGC-driven")
- consistency_score (integer 1-100 rating visual brand consistency)
- hook_archetypes (array of 3 objects {{"name": string, "share": integer}} with shares summing to 100; names like "Problem-Solution", "Storytelling", "Promotional", "Educational", "Behind-the-Scenes")
- content_mix (array of 3-4 objects {{"label": string, "pct": integer}} with pct summing to 100; labels like "Tutorials", "Reviews", "Lifestyle")
- audience (object {{"age_range": string like "18-24", "interests": array of 3 strings, "gender_split": {{"female": integer, "male": integer}} with values summing to 100}})
- buyer_persona (object {{"demographics": string, "pain_points": array of 3 strings, "buying_intent": string}})
- sponsorship_readiness (exactly one of "Low", "Medium", "High", based on posting consistency, promo ratio and engagement signals)
- collab_fit_score (integer 1-100 brand partnership readiness)
- pitch (80-120 word personalized cold outreach email referencing this brand's gaps and recent content themes)
- audience_analytics (object with these sub-keys):
  - consistency_score (integer 1-100 based on posting gaps, rhythm and recency of the last post)
  - consistency_status (exactly one of "Highly Consistent", "Moderate / Sporadic", "Inactive")
  - consistency_note (one sentence explaining the posting frequency trend)
  - engagement_tier (exactly one of "Below Average", "Average", "Above Average", "Exceptional"; roughly 1-3% engagement is average, adjust expectations for follower size)
  - community_pulse (short label like "High Trust & Questions", "High Hype / Emojis Only", or "Customer Support Inquiries", based on the comment samples)
  - responsiveness (exactly one of "Active Responder", "Passive Broadcaster", "Unknown", based on the owner comment-reply rate)
  - location (object {{"city": string or null, "state": string or null, "country": string or null, "flag": string with the country flag emoji or "", "confidence": "High"|"Medium"|"Low"}} aggregated from bio, external links and post geotags; never invent a location without evidence)
Base everything on the provided data only. Profile: {json.dumps(context, ensure_ascii=True)}'''
    chat = LlmChat(api_key=key, session_id=f"profile-{uuid.uuid4()}", system_message="You are a precise B2B social intelligence analyst. Output strict JSON.").with_model("gemini", "gemini-3-flash-preview")
    result = ""
    async for event in chat.stream_message(UserMessage(text=prompt)):
        if isinstance(event, TextDelta):
            result += event.content
    try:
        cleaned = result.replace("```json", "").replace("```", "").strip()
        return json.loads(cleaned)
    except (json.JSONDecodeError, TypeError) as exc:
        raise RuntimeError("Gemini returned an unreadable analysis.") from exc

@api_router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_profile(input: AnalyzeRequest, user: dict = Depends(get_current_user)):
    url = normalize_profile_url(input.profile_url)
    try:
        raw = await run_in_threadpool(scrape_profile, url)
        post_urls = [(p.get("url") or f"https://www.instagram.com/p/{p.get('shortCode')}/") for p in (raw.get("latestPosts") or [])[:4] if isinstance(p, dict) and (p.get("url") or p.get("shortCode"))]
        comments = []
        if post_urls:
            try:
                comments = await run_in_threadpool(scrape_comments, post_urls)
            except Exception as exc:
                logger.warning("Comment scrape failed, continuing without: %s", exc)
        metrics = compute_metrics(raw, comments)
        intelligence = await classify_profile(raw, metrics, comments)
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Profile analysis failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    profile = {key: raw.get(key) for key in ["username", "fullName", "biography", "externalUrl", "externalUrls", "followersCount", "followsCount", "postsCount", "verified", "isBusinessAccount", "businessCategoryName", "profilePicUrl", "profilePicUrlHD"]}
    profile["profile_pic_url"] = raw.get("profilePicUrlHD") or raw.get("profilePicUrl")
    analytics = {**{k: v for k, v in metrics.items() if k not in {"comment_samples", "location_names"}}, **intelligence.pop("audience_analytics", {})}
    response = {"profile": profile, "intelligence": intelligence, "analytics": analytics, "source": "Apify public Instagram Scraper + Gemini 3 Flash", "analyzed_at": datetime.now(timezone.utc).isoformat()}
    await db.analysis_runs.insert_one({**response, "user_id": user["user_id"], "created_at": response["analyzed_at"]})
    return response

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()