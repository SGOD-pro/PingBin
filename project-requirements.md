# `requirements.md`

## 1. Tech Stack Requirements (Locked)

### Frontend
- **Runtime:** Node.js 20+ (for Vite build only, not deployed to backend)
- **Framework:** React 18+ with Vite 5+
- **Styling:** Tailwind CSS 3+
- **UI Components:** shadcn/ui (latest)
- **Map:** `@mapcn/map` (installed via `npx shadcn@latest add @mapcn/map`)
- **Package Manager:** npm or pnpm (DO NOT mix — pick one, stick with it)
- **Deploy:** Vercel (static build)

### Backend
- **Runtime:** Python 3.12
- **Package Manager:** `uv` (DO NOT use pip, poetry, or requirements.txt)
- **AWS SDK:** `boto3` (latest)
- **Twilio SDK:** `twilio` (latest, Python package)
- **Framework:** None. Pure AWS Lambda handler functions (2 Lambdas: `webhook_receiver.py`, `processor.py`). Do NOT use FastAPI/Flask/Django.
- **Deploy:** AWS Lambda via ZIP upload or container image

### Message Queue
- **Service:** AWS SQS (`cleanloop-messages` queue)
- **Role:** Decouples Lambda 1 (webhook intake) from Lambda 2 (heavy processor)

### AI
- **Provider:** Amazon Bedrock via `boto3`
- **Model ID:** `amazon.nova-lite-v1:0`
- **Input:** Image (base64) + text prompt
- **Output:** Structured JSON parsed from model response text

### Infrastructure
- **Database:** AWS DynamoDB (2 tables: `Reports`, `Workers`)
- **Storage:** AWS S3 (`cleanloop-images`, public-readable for demo)
- **HTTP:** AWS API Gateway (HTTP API, not REST API — lighter, cheaper, faster)
- **Messaging:** Twilio WhatsApp API (Sandbox)

---

## 2. Functional Requirements — Core Loop

### FR-1: Citizen Report Intake
**Trigger:** Twilio webhook POST to `/webhook` endpoint (API Gateway → Lambda 1 `webhook_receiver.py`).
**Input:** Twilio webhook payload (message body, media URLs, sender phone, message timestamp).
**Behavior:**
- Lambda 1 MUST return HTTP 200 within 500ms. No exceptions.
- Lambda 1 MUST parse the Twilio URL-encoded payload to detect: is this a photo? is this a location share? is this a text message?
- Lambda 1 MUST construct a normalized JSON event and send it to AWS SQS (`cleanloop-messages`).
- Lambda 1 MUST NOT call Bedrock, DynamoDB, or S3 synchronously.
**Acceptance:** Twilio receives 200 OK. Normalized message appears in SQS queue. No timeout errors in Twilio console.

### FR-2: Image Classification & ACID Intake
**Trigger:** Lambda 2 (`processor.py`) receives SQS record from `cleanloop-messages` queue.
**Input:** SQS message payload containing `sender_phone`, `message_type: "photo"`, `media_url`, `timestamp`.
**Behavior:**
- **ACID Step 1 (DB First):** Save raw report to DynamoDB `Reports` table with `status: "pending"`, `report_id`, `citizen_phone`, and `created_at`.
- **ACID Step 2 (Download & S3):** Download image from Twilio media URL (requires HTTP Basic Auth with Twilio Account SID / Auth Token) and upload to S3 (`cleanloop-images/before/{report_id}.jpg`). Store public S3 URL.
- **ACID Step 3 (Bedrock AI):** Send image (base64) + structured prompt to Bedrock Nova Lite (`amazon.nova-lite-v1:0`).
- **ACID Step 4 (Parse JSON):** Parse model response text into JSON. Fields required:
  - `waste_type` (string: "plastic" | "organic" | "paper" | "glass" | "metal" | "e_waste" | "hazardous")
  - `fill_percent` (integer: 0-100)
  - `urgency` (string: "low" | "medium" | "high" | "critical")
  - `estimated_workers_needed` (integer: 1-4)
  - `estimated_minutes_to_clean` (integer: 5-120)
- If Bedrock fails or returns unparseable JSON, use fallback defaults: `waste_type="unknown"`, `fill_percent=50`, `urgency="medium"`, `estimated_workers_needed=1`, `estimated_minutes_to_clean=30`.
**Acceptance:** Raw report created atomically in DynamoDB `Reports` table with status `pending`, image uploaded to S3, and classification parsed.

### FR-3: Priority Scoring (Inline)
**Trigger:** Immediately after FR-2 classification inside Lambda 2.
**Input:** Classification fields (`fill_percent`, `urgency`, etc.).
**Behavior:**
- Compute priority score **inline inside Lambda 2** using 5 lines of math:
  - `overflow_score = fill_percent * 0.4`
  - `wait_score = 50 * 0.2` (default mid)
  - `crowd_score = 0 * 0.15` (default 0)
  - `sensitive_score = 0 * 0.15` (default 0)
  - `weather_score = 50 * 0.1` (default mid)
  - `priority_score = round(overflow_score + wait_score + crowd_score + sensitive_score + weather_score, 2)`
- Update DynamoDB `Reports` record: `photo_before_url`, `waste_type`, `fill_percent`, `urgency`, `priority_score`, `estimated_workers_needed`, `estimated_minutes_to_clean`.
**Acceptance:** `priority_score` and classification fields updated in DynamoDB `Reports` record.

### FR-4: Multi-Worker Dispatch
**Trigger:** Location received via WhatsApp → Lambda 1 → SQS → Lambda 2 `processor.py`.
**Input:** SQS message with `message_type: "location"`, `latitude`, `longitude`, `sender_phone`.
**Behavior:**
- Find pending report from same sender within 5-minute window.
- Update report `location_before` with lat/lng.
- Query DynamoDB `Workers` table where `status = "free"`.
- Assign $N = \min(\text{estimated\_workers\_needed}, \text{free\_workers\_available})$ nearest workers via Haversine.
- If $N < \text{estimated\_workers\_needed}$, recalculate: `recalculated_estimated_time = estimated_minutes_to_clean * (estimated_workers_needed / N)`.
- Update `Reports` record: `status = "assigned"`, `worker_phones`, `assigned_workers_count`, `recalculated_estimated_time`.
- Update `Workers` table: `status = "busy"` for all assigned workers.
- Send WhatsApp message to each assigned worker with waste type, fill %, location link, and instructions to send PHOTO + LOCATION upon arrival.
- Send WhatsApp notification to citizen. If no free workers, report stays `pending` and citizen is notified.
**Acceptance:** Workers receive WhatsApp assignment message. Report status changes to `assigned`, worker statuses change to `busy`.

### FR-5: Worker Arrival & Start Confirmation
**Trigger:** Worker sends PHOTO + LOCATION upon arriving at bin → Twilio webhook → Lambda 1 → SQS → Lambda 2.
**Input:** SQS message with photo media_url and/or lat/lng from assigned worker.
**Behavior:**
- Lambda 2 finds report where worker is assigned and `status = "assigned"`.
- Uploads start photo to S3 (`start_photo_url`), saves `start_location`.
- Verifies GPS distance between `location_before` and `start_location` $\le 50$m.
- If GPS $\le 50$m: updates report `status = "in_progress"`, logs `start_time`.
- Sends WhatsApp confirmation to worker. If GPS $> 50$m, alerts worker to move closer to bin.
**Acceptance:** `start_photo_url`, `start_location`, and `start_time` populated; status changes to `in_progress`.

### FR-6: Worker Completion + Truth Verification
**Trigger:** Worker sends after-PHOTO + LOCATION via WhatsApp → Twilio webhook → Lambda 1 → SQS → Lambda 2.
**Input:** SQS message with photo media_url and/or lat/lng from in_progress worker.
**Behavior:**
- Lambda 2 finds report where worker is working and `status = "in_progress"`.
- Uploads after-photo to S3 (`cleanloop-images/after/{report_id}.jpg`), saves `location_after`.
- Computes `actual_duration = finish_time - start_time` (in minutes).
- Computes `truth_percentage = min(100, round((actual_duration / estimated_time_used) * 100))` where `estimated_time_used = recalculated_estimated_time if exists else estimated_minutes_to_clean`.
- Verifies GPS distance between `location_before` and `location_after` $\le 50$m.
- **Truth Verification Logic:**
  - If `haversine_distance <= 50m` AND `truth_percentage >= 50` $\rightarrow$ `status = "resolved"`.
  - If `haversine_distance > 50m` OR `truth_percentage < 50` $\rightarrow$ `status = "needs_review"`.
- Updates report with `finish_time`, `actual_duration`, `truth_percentage`, `photo_after_url`, `location_after`, and final `status`.
- Updates `Workers` table: `status = "free"` for all assigned workers.
- If resolved: sends WhatsApp confirmation to citizen with coupon code `CLEAN10` and incremented reward count.
- If needs_review: does NOT send citizen coupon; surfaces in admin dashboard `needs_review` queue.
**Acceptance:** Report resolved or flagged. Workers freed. Citizen rewarded (if resolved).

### FR-7: Admin Dashboard (Frontend)
**Trigger:** Page load at admin dashboard URL, polled every 5 seconds.
**Input:** No input required on load.
**Behavior:**
- Calls GET `/reports` endpoint (API Gateway → Lambda 2 `processor.py` HTTP trigger).
- Lambda 2 scans DynamoDB `Reports` table for active reports (`pending`, `assigned`, `in_progress`, `needs_review`).
- Frontend renders:
  - Cluster map with color-coded pins: red = pending, yellow = assigned, blue = in_progress, green = resolved, orange = needs_review.
  - Priority queue table (sorted by `priority_score` descending).
  - Needs-review table.
  - Live stats: total pending, total resolved, avg resolution time, active workers.
- Polls every 5 seconds for updates.
**Acceptance:** Dashboard loads. Shows seeded synthetic reports. Updates live when new real reports/actions occur.

### FR-8: Seeded Demo Data
**Trigger:** Local script execution `uv run python scripts/seed_data.py` (or optional GET `/seed` on Lambda 2).
**Input:** None.
**Behavior:**
- Script inserts 50-100 synthetic reports into DynamoDB `Reports` table.
- Reports have randomized: location (around venue/campus), waste_type, fill_percent, urgency, priority_score, status (mix of resolved, pending, in_progress, needs_review).
- Script also inserts 3-5 workers into `Workers` table with `last_known_location` near campus and status (`free`/`busy`).
**Acceptance:** Admin dashboard shows 50+ pins on map immediately on page load.

---

## 3. Sellable Module Interface Contracts

These are the strict, non-negotiable API contracts for the 3 modules listed on the M&A trading floor. Each module MUST be in its own isolated directory under `/modules/` with its own `README.md` and `.env.example`.

### Module 1: Priority/Triage Scoring Engine

**Directory:** `/modules/priority-engine/`

**Interface:**
```python
def score_reports(reports: list[dict]) -> list[dict]:
    """
    Input: list of dicts, each with:
    {
        "id": str,
        "factors": {
            "overflow": int (0-100),
            "waiting_time": int (0-100, normalized),
            "crowd_density": int (0-100, optional default 0),
            "sensitive_proximity": int (0 or 1),
            "weather": int (0-100, optional default 50)
        }
    }
    
    Output: list of dicts, sorted by score descending:
    [
        {
            "id": str,
            "score": float (0-100),
            "rank": int
        }
    ]
    """
```

**Constraints:**
- NO imports from main backend code.
- NO references to "waste", "report", "citizen", "worker", "WhatsApp", "Twilio" anywhere in the code or schema.
- Accepts generic `factors` dict. Returns generic `score` and `rank`.
- Weights (40/20/15/15/10) are configurable via environment variables, but defaults are hardcoded.

### Module 2: Image → Structured Classification Wrapper

**Directory:** `/modules/image-classifier/`

**Interface:**
```python
def classify_image(image: str, context: str = "") -> dict:
    """
    Input:
    - image: base64-encoded image string OR public URL
    - context: optional text context (e.g., "This is a waste bin photo")
    
    Output: dict with fields:
    {
        "category": str,
        "fill_percent": int (0-100),
        "urgency": str ("low"|"medium"|"high"|"critical"),
        "estimated_workers_needed": int,
        "estimated_minutes_to_clean": int
    }
    """
```

**Constraints:**
- NO imports from main backend code.
- NO references to "waste", "report", "citizen", "worker", "WhatsApp", "Twilio" in the interface.
- The function name `classify_image` and the output field names (`category`, `fill_percent`, `urgency`, `estimated_workers_needed`, `estimated_minutes_to_clean`) are the public API.
- Internally, the prompt sent to Bedrock can mention waste (that's the prompt layer, not the interface layer).
- MUST use `boto3` Bedrock client. Model ID configurable via env var. Default: `amazon.nova-lite-v1:0`.

### Module 3: WhatsApp Intake Handler

**Directory:** `/modules/whatsapp-intake/`

**Interface:**
```python
def handle_webhook(event: dict) -> dict:
    """
    Input: AWS Lambda event dict (from API Gateway proxy integration).
    Contains Twilio webhook POST body in event['body'] (URL-encoded).
    
    Output: dict with:
    {
        "statusCode": 200,
        "body": "<Response></Response>"  # Twilio XML response
    }
    
    Side effects:
    - Parses Twilio URL-encoded payload
    - Detects message type (photo, location, text)
    - Sends normalized JSON message to SQS queue (configured via SQS_QUEUE_URL)
    - Returns 200 OK immediately (<500ms)
    """
```

**Constraints:**
- This module IS coupled to Twilio and WhatsApp. That's its purpose.
- The SQS queue URL MUST be configurable via env var (`SQS_QUEUE_URL`).
- NO imports from main backend code.
- Packaged standalone for teams needing Twilio WhatsApp intake decoupled via SQS.

---

## 4. Non-Functional Requirements

### NFR-1: SQS Decoupled Async Pattern (Critical)
- Twilio webhook MUST return 200 OK in under 500ms via Lambda 1.
- All heavy compute (Bedrock, S3 uploads, DynamoDB writes, Twilio outbound messages) MUST happen in SQS-triggered Lambda 2 (`processor.py`).
- Lambda 2 max timeout: 60 seconds (more than enough for Bedrock + S3 + DB).
- Lambda 1 max timeout: 3 seconds (returns in <500ms anyway).

### NFR-2: CORS
- API Gateway MUST have CORS configured explicitly.
- Allowed origins: `*` (for hackathon demo; restrict in "production" narrative).
- Allowed methods: GET, POST, OPTIONS.
- Set at API Gateway level.

### NFR-3: Error Handling
- If Bedrock fails → use fallback defaults (see FR-2). Do NOT crash the pipeline.
- If DynamoDB write fails → retry once. If still fails, log to CloudWatch and flag.
- If Twilio outbound send fails → retry once. If still fails, report still exists in DB as `pending`/`assigned`.
- Lambda 1 MUST NEVER throw an unhandled exception. Catch everything. Return 200. Twilio must always get its 200.

### NFR-4: Polling vs WebSockets
- Admin dashboard uses 5-second polling. DO NOT build WebSocket infrastructure for this hackathon.
- Lambda 2 serves GET `/reports` by scanning DynamoDB for active non-resolved reports.

---

## 5. Data Model (Exact DynamoDB Schemas)

### Table: `Reports`
| Attribute | Type | Key Type | Notes |
|---|---|---|---|
| `report_id` | String | PK | UUID |
| `citizen_phone` | String | | E.164 format |
| `worker_phone` | String | | Nullable until assigned |
| `photo_before_url` | String | | S3 URL |
| `photo_after_url` | String | | S3 URL, nullable |
| `location_before` | Map `{lat, lng}` | | Float values |
| `location_after` | Map `{lat, lng}` | | Nullable |
| `waste_type` | String | | Enum |
| `fill_percent` | Number | | 0-100 |
| `urgency` | String | | Enum |
| `priority_score` | Number | | 0-100 |
| `estimated_workers_needed` | Number | | 1-5 |
| `estimated_minutes_to_clean` | Number | | 5-120 |
| `start_time` | String | | ISO 8601, nullable |
| `finish_time` | String | | ISO 8601, nullable |
| `actual_duration` | Number | | Minutes, nullable |
| `status` | String | GSI PK | `pending`/`assigned`/`in_progress`/`resolved`/`needs_review` |
| `created_at` | String | GSI SK | ISO 8601 |

**GSI:** `status-index` (PK: `status`, SK: `created_at`)

### Table: `Workers`
| Attribute | Type | Key Type | Notes |
|---|---|---|---|
| `worker_id` | String | PK | UUID |
| `phone` | String | | E.164 format |
| `last_known_location` | Map `{lat, lng}` | | Float values |
| `status` | String | | `free` / `busy` |

---

## 6. Out of Scope (Do NOT Build)

| Feature | Reason |
|---|---|
| WebSocket live updates | Polling is sufficient for demo. WebSockets add infra complexity. |
| User authentication for admin dashboard | Not needed for hackathon demo. |
| Worker GPS live tracking | Background location is a native-app problem. |
| Predictive overflow modeling | No historical data pipeline. |
| Gamified leaderboard | Cosmetic. Replaced with simple counter. |
| QR bin identity system | Nice-to-have, cut for time. |
| Custom-trained YOLOv8 model | No dataset, no training time. Nova Lite handles this. |
| Full loyalty/coupon system | Simulated counter only. |
| Native mobile app | WhatsApp is the entire interface by design. |
| FastAPI/Flask server | Pure Lambda handlers. No server process. |
| Separate Query / Seed Lambdas | Handled by Lambda 2 dual trigger and local seed script. |

---

## 7. Demo Seed Data Requirements

Before the live pitch, the system MUST be seeded with:
- **50-100 synthetic reports** in DynamoDB with:
  - Randomized locations within 2km of the venue.
  - Mix of statuses: ~60% resolved, ~20% pending, ~10% in_progress, ~10% needs_review.
  - Randomized waste types, fill percentages, urgency.
  - Randomized timestamps within the last 48 hours.
- **3-5 workers** in DynamoDB `Workers` table:
  - Phone numbers (can be fake for seeded data).
  - Locations near venue.
  - Mix of `free` and `busy` statuses.
- **1 live report** sent from a real phone during the pitch to prove the pipeline works end-to-end.

---

## 8. AI Agent Instructions

When building this project, the AI agent MUST:
1. Follow `architecture.md` for system design and folder structure (2 Lambdas + SQS queue).
2. Follow `project.md` for scope and feature decisions.
3. Follow `requirements.md` for exact interfaces, schemas, and constraints.
4. Use `uv` for all Python backend dependency management.
5. Use `npm` or `pnpm` for all frontend dependency management.
6. Isolate the 3 sellable modules in `/modules/` with zero imports from main backend.
7. Implement the 2-Lambda + SQS pattern (Lambda 1 pushes to SQS and returns 200, Lambda 2 processes SQS records and serves GET `/reports`).
8. Implement scoring inline inside Lambda 2 (5 lines of math).
9. Use pure Lambda handlers — no FastAPI, no Flask, no Django.
10. Use Nova Lite for all AI classification calls.
11. Run seed data generation via local script `scripts/seed_data.py`.