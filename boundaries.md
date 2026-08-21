# `boundaries.md`

## 1. Scope Boundaries

### The AI Agent IS ALLOWED to:
- Create files in `/frontend/src/`, `/backend/src/`, `/modules/*/`, and `/scripts/`.
- Modify environment variables in `.env.example` files.
- Add dependencies via `uv add` (Python) or `npm install` (frontend).
- Refactor code *within* a single Lambda function or React component.
- Add comments and docstrings.

### The AI Agent IS NOT ALLOWED to:
- Create new files outside the directory structure defined in `architecture.md`.
- Add features listed in `requirements.md` §6 (Out of Scope).
- Install packages not listed in `requirements.md` §1.
- Modify the interface contracts in `requirements.md` §3.
- Create test files, spec files, or CI/CD pipelines. No tests for this hackathon.
- Create Dockerfiles, Terraform, or CloudFormation templates unless explicitly asked.
- Add authentication, authorization, or user management to any layer.
- Create a mobile app, PWA manifest, or native wrapper.
- Add new Lambda functions beyond the 2 defined in `api.md` §1 (`webhook_receiver.py` and `processor.py`).
- Create new API Gateway routes beyond the routes defined in `api.md` §6 (POST `/webhook`, GET `/reports`, GET `/seed`, OPTIONS `/reports`).
- Add new DynamoDB tables or GSIs beyond the 1 GSI defined in `requirements.md` §5.
- Install state management libraries (Redux, Zustand) in the frontend.
- Install routing libraries (React Router) unless the frontend has multiple pages — it doesn't, it's a single dashboard.
- Install `axios`. Use `fetch()`.

---

## 2. Time Boundaries (Hard Stops)

The repository locks tonight at 11:59 PM. All code must be committed and pushed before this deadline.

### Build Phase Schedule (Suggested):
- **Phase 1 (0:00–0:30):** Infrastructure setup. DynamoDB tables, SQS queue (`cleanloop-messages`), S3 bucket, API Gateway.
- **Phase 2 (0:30–1:15):** Lambda 1 (`webhook_receiver.py`). Twilio webhook → SQS → 200 OK (<500ms).
- **Phase 3 (1:15–3:15):** Lambda 2 (`processor.py`). SQS processor (Bedrock Nova Lite, inline scoring, worker dispatch, START/DONE verification) + GET `/reports` endpoint.
- **Phase 4 (3:15–4:15):** Frontend dashboard. Vite + shadcn + Map. Polling GET `/reports`. Render cluster map + priority queue + needs-review queue.
- **Phase 5 (4:15–4:45):** Local seed data script (`scripts/seed_data.py`). 50-100 synthetic reports + 3-5 workers.
- **Phase 6 (4:45–5:15):** Isolate 3 modules into `/modules/` with READMEs and `.env.example`. Create separate branches for each.

### Hard Stops (No Exceptions):
- **Stop backend work at 4:00 hours.** If Lambdas aren't done, mock them and move to frontend. A dashboard with mocked data scores higher than perfect Lambdas with no UI.
- **Stop frontend work at 4:30 hours.** If the map isn't rendering, use a table view. A table with data scores higher than a blank map.
- **Stop ALL work at 5:00 hours.** Commit, push, walk away. Do not work past this point. Tired code is worse than no code.

---

## 3. Refactoring Boundaries

### The AI Agent MUST NOT refactor code if:
- The code works and meets the acceptance criteria in `requirements.md`.
- The refactoring spans multiple files or modules.
- The refactoring requires changing a function signature.
- The refactoring is for "cleanliness" or "best practices" without a functional reason.
- The refactoring is requested because the AI agent "thinks there's a better way." If it works, leave it.

### The AI Agent MUST refactor code if:
- There is a runtime error or bug blocking the core loop.
- The code violates `rules.md` §4 (Module Isolation Rules).
- The code violates `rules.md` §2.6 (Bedrock response parsing — markdown fence stripping is mandatory).
- The Twilio webhook Lambda does not return 200 OK within 500ms.

---

## 4. Dependency Boundaries

### Allowed Python Packages (install via `uv add`):
- `boto3` (AWS SDK — DynamoDB, S3, Bedrock, SQS)
- `twilio` (Twilio WhatsApp API)
- `requests` (downloading Twilio media URLs with Basic Auth)

### Banned Python Packages:
- `fastapi`, `flask`, `django` (no web frameworks)
- `ultralytics`, `torch`, `tensorflow` (no custom ML models)
- `geopy`, `haversine` (write the math yourself, 10 lines)
- `pytest` (no tests)
- `pandas`, `numpy` (no data science libraries — overkill)

### Allowed npm Packages (install via `npm install`):
- `react`, `react-dom` (already in Vite template)
- `tailwindcss` (already in Vite template)
- `shadcn/ui` (installed via CLI)
- `@mapcn/map` (installed via shadcn CLI)
- `lucide-react` (icon library, installed with shadcn)
- `clsx`, `tailwind-merge` (installed with shadcn)

### Banned npm Packages:
- `axios` (use `fetch`)
- `redux`, `zustand`, `mobx` (use Context + useState)
- `react-router-dom` (single page, no routing)
- `react-leaflet`, `react-map-gl` (use `@mapcn/map`)
- `mui`, `antd`, `chakra-ui` (use shadcn)
- `socket.io`, `socket.io-client` (no WebSockets, use polling)
- `framer-motion` (no animations, waste of time)

---

## 5. Error Handling Boundaries

### Lambda 1 (`webhook_receiver.py`):
- MUST catch ALL exceptions.
- MUST return 200 OK even on error.
- MUST send normalized message to SQS.
- MUST log errors to CloudWatch.
- MUST NOT retry. Twilio will retry on non-2xx, causing duplicates. Always return 200.

### Lambda 2 (`processor.py`):
- Bedrock failure → use fallback defaults. Do NOT throw.
- DynamoDB failure → retry once. If still fails, log and return. Do NOT throw.
- Twilio outbound failure → retry once. If still fails, log and return. Do NOT throw.
- JSON parse failure (Bedrock response) → use fallback defaults. Do NOT throw.
- SQS batch processing → process each record gracefully.

### Frontend:
- `fetch` failure → catch, show toast, keep last successful data on screen.
- MUST NOT crash the page on API error.
- MUST NOT show a blank screen.

### Error Handling Depth:
- One top-level try/except per Lambda handler. Not per line.
- If you need nested try/excepts, the function is too complex. Simplify.

---

## 6. UI/UX Boundaries

### The AI Agent MUST NOT:
- Add animations, transitions, or loading spinners beyond shadcn defaults.
- Create custom CSS files. Use Tailwind classes only.
- Add dark mode toggle. Pick one theme (light or dark) and stick with it.
- Add charts or graphs. Use tables and the map only.
- Add search, filter, or sort UI to the tables. The data is pre-sorted by priority score from the API.
- Add pagination. Load all reports (max ~100 for demo).
- Add responsive/mobile layouts for the admin dashboard. It's a desktop admin tool.
- Add a landing page, about page, or settings page. One page: the dashboard.

### The AI Agent MUST:
- Use shadcn `Card` for the dashboard layout.
- Use shadcn `Table` for the priority queue and needs-review queue.
- Use `@mapcn/map` for the cluster map.
- Use shadcn `Badge` for status indicators (pending=yellow, assigned=blue, in_progress=blue, resolved=green, needs_review=orange).
- Use shadcn `Toast` for error notifications.
- Show live stats at the top: Total Pending, Total Resolved, Avg Resolution Time, Active Workers.

---

## 7. Module Boundaries (Critical for M&A Trading)

### Strict Isolation:
- `/modules/priority-engine/` — ZERO imports from `/backend/` or `/frontend/`. ZERO references to waste, report, citizen, worker, WhatsApp, Twilio.
- `/modules/image-classifier/` — ZERO imports from `/backend/` or `/frontend/`. ZERO references to waste, report, citizen, worker, WhatsApp, Twilio in the interface.
- `/modules/whatsapp-intake/` — ZERO imports from `/backend/` or `/frontend/`. Packages Lambda 1's webhook handler standalone (Twilio POST → SQS → 200 OK). CAN reference Twilio and WhatsApp.

### Module Branch Strategy:
The 3 sellable modules must be on separate branches in the same repo:
- `main` — full application including `/modules/` directory
- `module/priority-engine` — contains ONLY the contents of `/modules/priority-engine/` at root
- `module/image-classifier` — contains ONLY the contents of `/modules/image-classifier/` at root
- `module/whatsapp-intake` — contains ONLY the contents of `/modules/whatsapp-intake/` at root

### Module README Requirement:
Each module branch MUST have a `README.md` with:
- Module name and one-line description
- Input/output interface (copy from `requirements.md` §3)
- Environment variables
- A real input → output example
- A 30–45s demo video link (Google Drive or YouTube)

### Module Pricing (Locked at Listing):
- Priority Engine: ₹4.5–5.0 Cr
- Image Classifier: ₹3.5–4.0 Cr
- WhatsApp Intake: ₹3.0–3.5 Cr
- Prices can ONLY move DOWN after listing. NEVER up.
- DO NOT discount on day one. Discount only if asset isn't moving near close of trading window.

---

## 8. File Creation Boundaries

### The AI Agent CAN create files in:
```
/frontend/src/
/frontend/src/components/
/frontend/src/lib/
/frontend/src/hooks/
/backend/src/
/backend/src/utils/
/modules/priority-engine/
/modules/image-classifier/
/modules/whatsapp-intake/
/scripts/
```

### The AI Agent CANNOT create files in:
```
/ (root — only config files like .gitignore, package.json, etc.)
/tests/
/docs/ (beyond the provided .md files)
/infra/
/terraform/
/.github/
```

### Specific File Names (Must Match Exactly):
- `backend/src/webhook_receiver.py` — Lambda 1 (Twilio → SQS → 200 OK)
- `backend/src/processor.py` — Lambda 2 (SQS processor + GET `/reports` / `/seed`)
- `backend/src/utils/haversine.py` — Haversine distance utility
- `backend/src/utils/bedrock.py` — Bedrock Nova Lite wrapper
- `backend/src/utils/dynamo.py` — DynamoDB helper functions
- `backend/src/utils/twilio_outbound.py` — Twilio outbound message helper
- `scripts/seed_data.py` — Local synthetic data generator script
- `frontend/src/App.tsx` — Main dashboard component
- `frontend/src/components/ClusterMap.tsx` — Map component
- `frontend/src/components/PriorityQueue.tsx` — Priority queue table
- `frontend/src/components/NeedsReviewQueue.tsx` — Needs review table
- `frontend/src/components/StatsBar.tsx` — Live stats header
- `frontend/src/hooks/useReports.ts` — Polling hook
- `modules/priority-engine/engine.py` — Scoring logic
- `modules/image-classifier/classifier.py` — Bedrock classification wrapper
- `modules/whatsapp-intake/handler.py` — Twilio webhook receiver