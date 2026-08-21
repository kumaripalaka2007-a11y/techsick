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

## Prioritized backlog
- P0: Complete — a valid `APIFY_TOKEN` is configured and live public-profile extraction is verified.
- P0: Complete — Emergent-managed Google sign-in with session-cookie auth and auth-gated live analyzer.
- P1: Add webhook configuration for the CRM push action (Make Custom Webhook — still needs user-provided webhook URL).
- P1: Add persisted analysis history and a recent-runs view (per-user, `user_id` now stored on runs).
- P2: Add phase-two reels transcription and visual content tags.

## Next tasks
- Live-validated `@glossier` end-to-end with an authenticated session: Apify profile details → Gemini classification/score → dashboard replacement.
- Publish/deployment readiness check.