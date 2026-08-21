# `architecture.md`

## 1. System Overview
PingBin is a serverless, event-driven waste management system. It uses WhatsApp as the citizen/worker interface, AWS SQS for decoupling, AWS Lambda for compute (2 Lambdas), Amazon Bedrock for AI vision, DynamoDB for storage, and a React frontend for administrators. 

The core architectural constraint is **decoupled async processing via SQS**. Twilio webhooks must return `200 OK` in under 500ms. Lambda 1 drops incoming events into AWS SQS and returns 200 immediately. Lambda 2 is SQS-triggered to perform all heavy processing (ACID DB writes, AI classification, inline scoring, worker routing, and verification), and also responds to API Gateway GET requests for dashboard data (`/reports`).

## 2. Tech Stack (Absolute & Non-Negotiable)
- **Frontend:** React (Vite) + Tailwind CSS + shadcn/ui (all latest versions)
- **Map Component:** `@mapcn/map` (installed via `npx shadcn@latest add @mapcn/map`)
- **Backend Language:** Python 3.14
- **Backend Dependency Management:** `uv` (DO NOT use pip, poetry, or npm for backend dependencies)
- **Backend Framework:** Pure AWS Lambda handlers (2 stateless functions, no web frameworks)
- **Message Queue:** AWS SQS (`pingbin-messages` queue)
- **AI:** Amazon Bedrock (Model: `amazon.nova-lite-v1:0`) - Multimodal
- **Database:** AWS DynamoDB (Two tables: `Reports`, `Workers`)
- **Storage:** AWS S3 (`pingbin-images` for before/after images)
- **Messaging:** Twilio WhatsApp API (Sandbox mode)
- **HTTP Routing:** AWS API Gateway (HTTP API)
- **Frontend Deploy:** Vercel
- **Backend Deploy:** AWS Lambda (ZIP upload or container image)

## 3. Project Directory Structure
The repository is structured as a monorepo containing the 2 Lambdas, the React frontend, and the 3 strictly isolated sellable modules:

```text
pingbin/
├── frontend/                  # React Vite App
│   ├── src/
│   ├── package.json
│   └── ... (shadcn/ui components)
├── backend/                   # Python AWS Lambda functions (2 Lambdas)
│   ├── pyproject.toml         # Managed by uv
│   ├── src/
│   │   ├── webhook_receiver.py  # Lambda 1 (Twilio -> SQS -> 200 OK)
│   │   ├── processor.py         # Lambda 2 (Dual trigger: SQS processor + GET /reports & /seed)
│   │   └── utils/               # Shared DB/S3/Bedrock/Haversine helpers
├── modules/                   # 3 Separable, Sellable Assets
│   ├── priority-engine/       # Generic scoring module
│   ├── image-classifier/      # Generic Nova Lite wrapper
│   └── whatsapp-intake/       # Standalone Twilio -> SQS webhook handler
├── scripts/                   # Local utility scripts
│   └── seed_data.py           # Local synthetic data generator script
└── docs/                      # Project documentation
```

## 4. Core Data Flow (The "PingBin" Loop)
1. **Intake:** Citizen sends photo via WhatsApp. Twilio hits API Gateway POST `/webhook` -> `webhook_receiver.py` (Lambda 1).
2. **Acknowledge & Queue:** `webhook_receiver.py` parses the Twilio payload, sends the normalized message to the SQS queue (`pingbin-messages`), and immediately returns HTTP 200 OK to Twilio in <500ms.
3. **Queue Trigger & ACID Intake:** SQS triggers `processor.py` (Lambda 2).
   - **ACID Step 1:** Atomically saves raw report to DynamoDB `Reports` table with `status: "pending"`.
   - **ACID Step 2:** Downloads photo from Twilio media URL and uploads to S3 (`pingbin-images/before/{report_id}.jpg`).
   - **ACID Step 3:** Invokes Amazon Bedrock (Nova Lite) to classify waste (`waste_type`, `fill_percent`, `urgency`, `estimated_workers_needed` [1-4], `estimated_minutes_to_clean`).
   - **ACID Step 4 (Inline Score):** Computes `priority_score` inline (5 lines of fixed math, no separate function/module call).
   - **ACID Step 5:** Updates DynamoDB `Reports` record with classification results and priority score.
4. **Await Location:** Bot prompts citizen on WhatsApp to share native location.
5. **Correlate & Multi-Worker Dispatch:** Citizen shares location -> `webhook_receiver.py` -> SQS -> `processor.py`.
   - `processor.py` correlates location with pending photo report (by phone number + 5-min window) and updates `location_before`.
   - Queries `Workers` table for free workers (status = "free").
   - Assigns $N = \min(\text{estimated\_workers\_needed}, \text{free\_workers\_available})$ nearest workers (via Haversine distance).
   - If $N < \text{estimated\_workers\_needed}$, recalculates: `recalculated_estimated_time = estimated_minutes_to_clean * (estimated_workers_needed / N)`.
   - Dispatches WhatsApp assignment to all assigned workers with estimated time and location link.
   - Updates report `status: "assigned"` and each assigned worker `status: "busy"`.
6. **Worker Arrival & Start Confirmation:**
   - Worker arrives at bin location and sends **PHOTO + LOCATION** via WhatsApp.
   - `processor.py` uploads start photo to S3 (`start_photo_url`), saves `start_location`, and verifies GPS distance between `location_before` and `start_location` $\le 50$m.
   - If GPS $\le 50$m: updates report `status: "in_progress"` and logs `start_time`.
7. **Worker Completion & Truth Verification:**
   - Worker finishes cleanup and sends **after-PHOTO + LOCATION** via WhatsApp.
   - `processor.py` uploads after-photo to S3 (`photo_after_url`), saves `location_after`, and calculates `actual_duration = finish_time - start_time`.
   - Calculates `truth_percentage = min(100, round((actual_duration / estimated_time_used) * 100))` where `estimated_time_used = recalculated_estimated_time if exists else estimated_minutes_to_clean`.
   - Verifies GPS distance $\le 50$m.
   - If GPS $\le 50$m AND `truth_percentage >= 50`: sets `status: "resolved"`, frees all assigned workers (`status: "free"`), sends citizen WhatsApp completion message with coupon code (`CLEAN10`) and incremented reward counter.
   - If GPS $> 50$m OR `truth_percentage < 50`: sets `status: "needs_review"`, frees workers to unblock them, and flags report in dashboard.
8. **Dashboard Query:** Admin dashboard polls API Gateway GET `/reports` every 5 seconds. Handled by `processor.py` (API Gateway trigger), returning active non-resolved reports.

## 5. Architectural Rules for the AI Agent
- **RULE 1:** Never perform synchronous heavy work (Bedrock AI, DynamoDB writes, S3 uploads) inside Lambda 1 (`webhook_receiver.py`). Lambda 1 only parses the payload, pushes to SQS, and returns 200 OK.
- **RULE 2:** Backend uses exactly 2 Lambda functions: `webhook_receiver.py` (Lambda 1) and `processor.py` (Lambda 2 with dual triggers: SQS + API Gateway GET `/reports`/`/seed`). No separate query or seed Lambdas.
- **RULE 3:** Scoring in Lambda 2 is INLINE (5 lines of math). Do not import external modules or make separate function calls for scoring in the core pipeline.
- **RULE 4:** The backend uses Python 3.12 with `uv`. Output `pyproject.toml` compatible with `uv`. Do not generate `requirements.txt`.
- **RULE 5:** The frontend uses Vite + React + shadcn/ui. Do not install heavy UI frameworks like MUI or Ant Design.
- **RULE 6:** Image classification must return structured JSON from Bedrock Nova Lite (with markdown fence stripping and fallback defaults).
- **RULE 7:** The 3 sellable modules in `/modules/` MUST NOT import from `/backend/` or `/frontend/`. Module 3 (`whatsapp-intake`) packages Lambda 1's Twilio -> SQS webhook logic standalone.
- **RULE 8:** Seed data generation is a local Python script in `scripts/seed_data.py`, not a dedicated Lambda function.

