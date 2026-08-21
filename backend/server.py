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

async def classify_profile(raw: dict) -> dict:
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise RuntimeError("EMERGENT_LLM_KEY is not configured.")
    prompt = f'''Analyze this public Instagram profile for commercial intelligence. Return ONLY valid JSON with keys: classification (string), pillars (array of strings), email (string|null), whatsapp (string|null), landing_page (string|null), lead_score (integer 0-100), fit_label (string), rationale (string), signals (array of strings). Never invent contact details. Profile: {json.dumps(raw, ensure_ascii=True)}'''
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
        intelligence = await classify_profile(raw)
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Profile analysis failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    profile = {key: raw.get(key) for key in ["username", "fullName", "biography", "externalUrl", "externalUrls", "followersCount", "followsCount", "postsCount", "verified", "isBusinessAccount", "businessCategoryName", "profilePicUrl", "profilePicUrlHD"]}
    response = {"profile": profile, "intelligence": intelligence, "source": "Apify public Instagram Scraper + Gemini 3 Flash", "analyzed_at": datetime.now(timezone.utc).isoformat()}
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