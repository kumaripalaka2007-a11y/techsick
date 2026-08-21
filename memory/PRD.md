# TECH SICK — Product Handoff

## Original problem statement
Create a modern, colorful, dark-themed SaaS web application for “AI-Based Instagram Business Profile Data Extractor & Intelligent Analyzer” developed by team “TECH SICK”, with a live public Instagram analyzer, Gemini reasoning, profile intelligence dashboard, exports, architecture, schema preview, roadmap, and visual direction inspired by the uploaded `hi.pptx`.

## Architecture decisions
- React frontend with a single responsive product page and FastAPI `/api/analyze` endpoint.
- Apify `apify/instagram-scraper` production client using the exact `details` + `directUrls` input schema for public profile metadata.
- Emergent universal LLM key with Gemini `gemini-3-flash-preview` for strict JSON classification and lead scoring.
- MongoDB stores completed analysis runs; responses are shaped without Mongo `_id` values.
- Frontend only calls `REACT_APP_BACKEND_URL`; backend only uses configured Mongo variables.

## Implemented
- TECH SICK cyber-SaaS landing page with dark navy background, cyan/purple/magenta accents, glass cards, responsive mobile layout, and PPTX-inspired visual language.
- Live analyzer input with handle normalization, strict Instagram hostname validation, loading state, toast errors, and profile dashboard replacement after successful analysis.
- Profile intelligence sample dashboard with classification, content pillars, contacts, fit score, JSON export, CSV export, and CRM action toast.
- Problem/solution comparison, 4-stage pipeline, schema/FastAPI tabbed preview, roadmap, footer, mobile navigation, and unique interactive test IDs.
- Build, lint, API regression, desktop interaction, mobile interaction, and mobile overflow checks completed successfully.
- 2026-08-21: Emergent-managed Google sign-in added end to end — navbar "Sign in" button redirects to auth.emergentagent.com with dynamic origin redirect; `AuthCallback` exchanges `session_id` via backend-only `/api/auth/session`; 7-day httpOnly cookie sessions stored in `user_sessions` (users in `users`, custom `user_id` UUID, `_id` never exposed); `/api/auth/me` and `/api/auth/logout` added; `/api/analyze` now requires sign-in and tags runs with `user_id`; navbar shows avatar/name chip with sign-out when authenticated; frontend wrapped in react-router with hash-based callback detection; backend regression suite extended to 7 tests (all passing); auth testing playbook saved at /app/auth_testing.md.
- 2026-08-21: Creator & Business Niche Visualizer + intelligence upgrade — Gemini prompt extended to return niche_category (8 fixed categories), niche_archetype, sub_niches, brand palette (4 hex), visual_style_tags, consistency_score, hook_archetypes (shares sum 100), content_mix (pct sum 100), audience snapshot (age/interests/gender split), buyer_persona, sponsorship_readiness, collab_fit_score, and an 80-120 word outreach pitch. Frontend adds dynamically themed niche hero banner (per-category gradient + lucide icon + glow badge), content-pillars donut (recharts), hook archetype bars, palette swatches, audience snapshot with gender split bar, buyer persona card, collab-fit progress bar, AI Pitch modal with copy, one-click printable Brand Health Audit report (window.print), copy-to-clipboard CRM rows (CSV + Airtable/Notion TSV), and a head-to-head competitor comparison (second handle input, metric table with winner highlights). Backend tests extended to assert the full intelligence schema; live verified with @glossier and @notionhq.

- 2026-08-21: Batch competitor comparison — head-to-head now supports up to 4 profiles (primary + 3 competitors): add handles one at a time, removable competitor chips, duplicate/self-add protection, dynamic N-column metric table (lead score, consistency, collab fit, followers, posts, niche, sponsorship, top themes) with per-metric winner highlighting. Live verified with @glossier vs @notionhq vs @allbirds.

- 2026-08-21: Instagram PFP loading fix — added backend `/api/proxy-image?url=` endpoint (host allowlist for scontent/cdninstagram/fbcdn, https-only, 15s timeout, 24h cache header) to bypass expiring Instagram CDN links and referrer blocks; analysis response now returns normalized `profile_pic_url` (highest-resolution profilePicUrlHD first); frontend Avatar component loads Instagram images through the proxy with `referrerPolicy="no-referrer"` + `crossOrigin="anonymous"`, falls back to a gradient initials avatar on error, and renders inside a story-style conic-gradient ring. Backend tests extended to 9 (proxy host validation + live `profile_pic_url` assertion); live browser run confirmed avatar loads at 320x320 through the proxy.

- 2026-08-21: Audience Connection & Posting Consistency Analytics + Smart Location — backend now computes real posting metrics from Apify `latestPosts` (cadence label e.g. "Daily"/"4.2 posts/week", last-post recency, avg likes/comments, true engagement rate, comment-to-like ratio) and runs a best-effort second Apify pass (`resultsType: comments`) over the top 4 posts to measure owner reply rate and gather anonymized comment samples; Gemini returns audience_analytics (consistency score/status/note, engagement tier vs benchmark, community pulse, responsiveness, standardized location city/state/country/flag/confidence from bio + external links + geotags). Frontend adds a "Community & Consistency Health" 3-card row (color-scaled consistency gauge with status badge + tooltip note, audience connection meter with engagement rate/tier/ratios and pulse + responsiveness pills, smart location card with flag and confidence pill) plus a mini location badge beside the profile name. Live verified end-to-end with @glossier (real values: Daily cadence, 0.12% engagement Below Average, Passive Broadcaster, New York NY USA High confidence); 9 backend tests pass with analytics schema assertions.

## Prioritized backlog
- P0: Complete — a valid `APIFY_TOKEN` is configured and live public-profile extraction is verified.
- P0: Complete — Emergent-managed Google sign-in with session-cookie auth and auth-gated live analyzer.
- P1: Add webhook configuration for the CRM push action (Make Custom Webhook — still needs user-provided webhook URL).
- P1: Add persisted analysis history and a recent-runs view (per-user, `user_id` now stored on runs).
- P2: Add phase-two reels transcription and visual content tags.

## Next tasks
- Live-validated `@glossier` end-to-end with an authenticated session: Apify profile details → Gemini classification/score → dashboard replacement.
- Publish/deployment readiness check.