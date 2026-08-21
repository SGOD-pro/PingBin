# `memory.md`

## Project Context Cheat Sheet

If you lose context, read this file first. It is the single source of truth for state.

---

## 1. What Are We Building

**CleanLoop** — A WhatsApp-native waste reporting and dispatch system for HACQUIRE 2026 hackathon (Problem Statement PS-03, CleanTech/Logistics).

Citizens report overflowing bins by sending a WhatsApp photo. AI classifies the waste. A fixed-logic engine scores priority. The nearest worker is dispatched via WhatsApp. The system tracks actual work time vs AI-estimated time to catch fake completions. Admin dashboard shows a live cluster map and priority queue.

**One-line pitch:** *"Your phone is already the sensor. WhatsApp is already the interface. We built the brain, the dispatch, and the audit trail in between."*

---

## 2. Tech Stack (Locked, Do Not Change)

| Layer | Choice |
|---|---|
| Frontend | React (Vite) + Tailwind + shadcn/ui + `@mapcn/map` |
| Backend | Python 3.12 via `uv` — pure AWS Lambda handlers |
| Queue | AWS SQS (`cleanloop-messages`) |
| Database | AWS DynamoDB (2 tables: `Reports`, `Workers`) |
| Storage | AWS S3 (`cleanloop-images`, public-readable) |
| AI | Amazon Bedrock — Nova Lite (`amazon.nova-lite-v1:0`) |
| Messaging | Twilio WhatsApp API (Sandbox mode) |
| HTTP | AWS API Gateway (HTTP API) |
| Deploy (frontend) | Vercel |
| Deploy (backend) | AWS Lambda ZIP upload |

**Banned:** pip, requirements.txt, FastAPI, Flask, Django, YOLOv8, ultralytics, axios, Redux, WebSockets, react-leaflet, geopy, haversine package.

---

## 3. Architecture (2 Lambdas + SQS)

```
WhatsApp message → Twilio → API Gateway POST /webhook
        ↓
┌─────────────────────────────┐
│ Lambda 1: webhook_receiver  │
│ 1. Parse Twilio payload     │
│ 2. Send to SQS              │
│ 3. Return 200 OK (<500ms)   │
└─────────────────────────────┘
        ↓ (SQS)
┌─────────────────────────────┐
│ Lambda 2: processor         │
│                             │
│ SQS trigger → route_message │
│  - photo → classify + score │
│  - location → correlate     │
│  - START → log timestamp    │
│  - DONE → verify + resolve  │
│                             │
│ API Gateway GET /reports →  │
│  query DynamoDB, return JSON│
│                             │
│ API Gateway GET /seed →     │
│  seed demo data (optional)  │
└─────────────────────────────┘
```

### Lambda 1: `backend/src/webhook_receiver.py`
- Trigger: API Gateway POST `/webhook`
- Returns 200 OK in <500ms. ALWAYS. Even on error.
- Parses Twilio URL-encoded body. Detects photo/location/text.
- Sends clean JSON to SQS.
- NEVER calls Bedrock, DynamoDB, or S3.

### Lambda 2: `backend/src/processor.py`
- Trigger 1: SQS queue (process messages)
- Trigger 2: API Gateway GET `/reports` (dashboard query)
- Trigger 3: API Gateway GET `/seed` (optional seed endpoint)
- Does ALL heavy work: Bedrock, S3, DynamoDB, Twilio outbound, scoring, dispatch, verification.
- Scoring is INLINE (5 lines of math, no separate function).

### Utility Files:
- `backend/src/utils/haversine.py` — 10-line haversine math
- `backend/src/utils/bedrock.py` — Nova Lite wrapper
- `backend/src/utils/dynamo.py` — DynamoDB helpers
- `backend/src/utils/twilio_outbound.py` — Twilio send helper

### Seed Script:
- `scripts/seed_data.py` — local Python script, not a Lambda

---

## 4. The 3 Sellable Modules

Each is in `/modules/` with its own branch, README, .env.example.

| Module | Branch | Interface | Pricing | Buyer Pool |
|---|---|---|---|---|
| Priority Engine | `module/priority-engine` | `{id, factors:{...}}` → ranked array | ₹4.5–5.0 Cr | PS-1, PS-5, PS-9, PS-10 |
| Image Classifier | `module/image-classifier` | `image(base64/url) + context` → JSON | ₹3.5–4.0 Cr | PS-1, PS-8, PS-10 |
| WhatsApp Intake | `module/whatsapp-intake` | Twilio POST → SQS → 200 OK | ₹3.0–3.5 Cr | PS-1, PS-9 |

### Module Rules:
- Modules 1 & 2: ZERO references to waste, report, citizen, worker, WhatsApp, Twilio.
- Module 3: CAN reference Twilio/WhatsApp. Its value IS being WhatsApp-specific.
- All 3: ZERO imports from `/backend/` or `/frontend/`.
- Prices can only move DOWN after listing. Never up.

---

## 5. Locked Decisions (Do Not Question)

1. **WhatsApp-only interface** — no app, no PWA, no web form for citizens/workers.
2. **Nova Lite for AI** — no custom YOLOv8, no training, no GPU.
3. **Deterministic scoring** — fixed weights (40/20/15/15/10), no AI in scoring.
4. **Polling not WebSockets** — 5-second `setInterval` for dashboard.
5. **Pure Lambda** — no FastAPI, no Flask, no Django.
6. **S3 public-readable** — no presigned URLs for hackathon.
7. **Flag, don't auto-punish** — fake-work goes to `needs_review`, not auto-rejected.
8. **Twilio Sandbox** — no business verification, pre-joined phones for demo.
9. **SQS queue** — Lambda 1 sends to SQS, Lambda 2 is SQS-triggered. No async Lambda invoke.
10. **Inline scoring** — 5 lines of math inside Lambda 2. No separate function call.

---

## 6. DynamoDB Schema (Locked)

### Table: `Reports`
| Attribute | Type | Key | Notes |
|---|---|---|---|
| `report_id` | String | PK | UUID |
| `citizen_phone` | String | | E.164 |
| `worker_phone` | String | | Nullable |
| `photo_before_url` | String | | S3 URL |
| `photo_after_url` | String | | Nullable |
| `location_before` | Map | | `{lat, lng}` |
| `location_after` | Map | | Nullable |
| `waste_type` | String | | Enum |
| `fill_percent` | Number | | 0-100 |
| `urgency` | String | | Enum |
| `priority_score` | Number | | 0-100 |
| `estimated_workers_needed` | Number | | 1-5 |
| `estimated_minutes_to_clean` | Number | | 5-120 |
| `start_time` | String | | ISO 8601 |
| `finish_time` | String | | ISO 8601 |
| `actual_duration` | Number | | Minutes |
| `status` | String | GSI PK | pending/assigned/in_progress/resolved/needs_review |
| `created_at` | String | GSI SK | ISO 8601 |

**GSI:** `status-index` (PK: `status`, SK: `created_at`)

### Table: `Workers`
| Attribute | Type | Key | Notes |
|---|---|---|---|
| `worker_id` | String | PK | UUID |
| `phone` | String | | E.164 |
| `last_known_location` | Map | | `{lat, lng}` |
| `status` | String | | free/busy |

---

## 7. Known Risks & Gotchas

| Risk | Mitigation | Status |
|---|---|---|
| Twilio 15s timeout | Lambda 1 returns 200 in <500ms, SQS decouples processing | Solved by architecture |
| Lambda cold start | Hidden from user (SQS decouples) | Solved by architecture |
| Bedrock JSON parse failure | Strip markdown fences (```json), try/except, fallback defaults | Implement in `utils/bedrock.py` |
| CORS errors | Set at API Gateway level, not just Lambda headers | Configure in infra |
| SAM build hangs on Windows | Use direct ZIP upload or AWS CLI | Deploy strategy |
| Lambda package >250MB | Use container image if needed | Monitor during build |
| WhatsApp strips photo EXIF/GPS | Use native location share, correlate by phone+timestamp | Solved by design |
| PS-1 team sells similar priority engine | List early on Exchange Board, price high (₹4.5-5Cr) | Trading floor strategy |

---

## 8. State Tracker

Update this section as you build. If the AI agent loses context, it reads this to know where things stand.

### Infrastructure
- [x] DynamoDB tables created (`Reports`, `Workers`) in ap-south-1
- [x] SQS queue created (`cleanloop-messages`) in ap-south-1
- [x] S3 bucket created (`cleanloop-images-ap-south-1`) in ap-south-1
- [x] API Gateway / FastAPI server created (POST `/webhook`, GET `/reports`, GET `/health`)
- [x] Lambda 1 created (`webhook_receiver.py`)
- [x] Lambda 2 created (`processor.py`)
- [x] SQS queue connected to webhook receiver and processor

### Backend & Truth Verification Engine
- [x] `backend/src/webhook_receiver.py` — Lambda 1 complete (<500ms guaranteed)
- [x] `backend/src/processor.py` — Lambda 2 complete with multi-worker dispatch & truth scoring
- [x] `backend/src/utils/haversine.py` — distance math
- [x] `backend/src/utils/bedrock.py` — Nova Lite wrapper with `apac.amazon.nova-lite-v1:0` support
- [x] `backend/src/utils/dynamo.py` — DB helpers (multi-worker & truth tracking)
- [x] `backend/src/utils/twilio_outbound.py` — send WhatsApp with reward coupon template
- [x] Multi-worker assignment & dynamic time recalculation ($N = \min(\text{needed}, \text{free})$)
- [x] Worker arrival confirmation (PHOTO + LOCATION, GPS $\le 50$m verification)
- [x] Worker cleanup completion (after-PHOTO + LOCATION, truth percentage calculation)
- [x] Fake-work anomaly detection (truth $< 50\%$ or GPS $> 50$m $\rightarrow$ `needs_review`)
- [x] Citizen reward coupon dispatch (`CLEAN10`) on resolution
- [x] Dashboard query endpoint tested (`GET /reports`)

### Frontend & Admin Operations
- [x] Vite + React + Tailwind initialized
- [x] `@mapcn/map` / Leaflet cluster map installed with real-time cluster pins & worker GPS pins (`👷`)
- [x] Sanitation Worker Management modal/form (`components/WorkersModal.tsx`) with photo, name, WhatsApp number, and GPS coordinates
- [x] Worker REST API integration (`GET /workers`, `POST /workers`)
- [x] `hooks/useReports.ts` and `hooks/useWorkers.ts` 5-second polling hooks
- [x] `components/StatsBar.tsx`
- [x] `components/ClusterMap.tsx` (reports & workers)
- [x] `components/PriorityQueue.tsx`
- [x] `components/NeedsReviewQueue.tsx`
- [x] `components/ReportDetailModal.tsx`
- [x] `App.tsx` layout complete & built (0 errors)
- [x] Dashboard loads with live data on `http://localhost:5173`

### Seed Data
- [x] `scripts/seed_data.py` written
- [x] 65 reports seeded in DynamoDB
- [x] 4 workers seeded in DynamoDB

### Module Isolation
- [x] `/modules/priority-engine/` isolated with README + .env.example (₹4.5–5.0 Cr)
- [x] `/modules/image-classifier/` isolated with README + .env.example (₹3.5–4.0 Cr)
- [x] `/modules/whatsapp-intake/` isolated with README + .env.example (₹3.0–3.5 Cr)

### Demo Prep & End-to-End Truth Test Suite
- [x] 10/10 End-to-End Truth System Tests Passed (100% Green)
- [x] Worker Management & Heatmap / Cluster Overlay Verified
- [x] Photo + Location arrival & completion truth verification verified
- [x] Automated system-to-registered citizen reward coupon verified
- [x] Phone (+919382122857) configured & outbound WhatsApp verified
- [ ] 3 demo videos recorded (30-45s each)
- [ ] Videos linked in module READMEs
- [ ] Main branch pushed before 11:59 PM

---

## 9. File Index

| File | Purpose |
|---|---|
| `architecture.md` | System design, tech stack, folder structure |
| `project.md` | Scope, features, what's cut, M&A strategy |
| `requirements.md` | Functional requirements, module interfaces, data model |
| `rules.md` | Coding rules, dependency rules, AI agent behavior rules |
| `api.md` | API contracts, Lambda event schemas, external API patterns |
| `decisions.md` | Architectural Decision Records (ADRs) — the "why" |
| `boundaries.md` | Scope creep limits, hard stops, banned packages |
| `phases.md` | Build phases with time budgets and done criteria |
| `memory.md` | This file. State tracker and context cheat sheet. |

---

## 10. AI Agent Golden Rules

1. Read all `.md` files before writing code.
2. Use `uv` for Python. Use `npm` for frontend. No exceptions.
3. Lambda 1 returns 200 in <500ms. Always. Even on error.
4. Scoring is inline math. Not a function call. Not a module. 5 lines.
5. SQS connects Lambda 1 and Lambda 2. Not async invoke.
6. Modules 1 & 2 are generic. No waste/WhatsApp field names.
7. Module 3 is WhatsApp-coupled. That's its value.
8. No features from the Out of Scope list. Ever.
9. If code works, don't refactor it.
10. If time is up, commit and walk away.

---