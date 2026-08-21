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

## Prioritized backlog
- P0: Add a valid `APIFY_TOKEN` to `/app/backend/.env` to enable live public-profile extraction.
- P1: Add webhook configuration for the CRM push action.
- P1: Add persisted analysis history and a recent-runs view.
- P2: Add phase-two reels transcription and visual content tags.

## Next tasks
- Validate one live public profile end-to-end after the Apify token is added.
- Add authenticated workspace history when the product needs multi-user access.