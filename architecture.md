# `architecture.md`

## 1. System Overview
PingBin is a serverless, event-driven waste management system. It uses WhatsApp as the citizen/worker interface, AWS SQS for decoupling, AWS Lambda for compute (2 Lambdas), Amazon Bedrock for AI vision, DynamoDB for storage, and a React frontend for administrators. 

The core architectural constraint is **decoupled async processing via SQS**. Twilio webhooks must return `200 OK` in under 500ms. Lambda 1 drops incoming events into AWS SQS and returns 200 immediately. Lambda 2 is SQS-triggered to perform all heavy processing (ACID DB writes, AI classification, safety gate audit, inline scoring, worker routing, 2-gate verification, and post-cleanup recycling warehouse logistics), and also responds to API Gateway GET requests for dashboard data (`/reports`, `/warehouses`, `/workers`, `/coupons`, `/vendors`).

## 2. Tech Stack (Absolute & Non-Negotiable)
- **Frontend:** React (Vite) + Tailwind CSS + shadcn/ui
- **Backend Language:** Python 3.12 / 3.14
- **Backend Dependency Management:** `uv`
- **Backend Framework:** Pure AWS Lambda handlers (2 stateless functions, no web frameworks)
- **Message Queue:** AWS SQS (`pingbin-messages` queue)
- **AI Vision:** Amazon Bedrock (Model: `amazon.nova-lite-v1:0` / `apac.amazon.nova-lite-v1:0`) - Multimodal
- **Database:** AWS DynamoDB (`Reports`, `Workers`, `Vendors`, `Coupons`, `Warehouses`)
- **Storage:** AWS S3 (`cleanloop-images-ap-south-1` for before/after images)
- **Messaging:** Twilio WhatsApp API (Sandbox mode)
- **HTTP Routing:** AWS API Gateway (HTTP API v2)
- **Frontend Deploy:** Vercel

## 3. Project Directory Structure
```text
pingbin/
├── frontend/                  # React Vite Dashboard & Live Simulator
│   ├── src/components/
│   │   ├── PriorityQueue.tsx    # Live Priority Queue + Safety Gate Actions
│   │   ├── WarehouseSection.tsx # Recycling Logistics Ledger & Revenue KPIs
│   │   └── ...
├── backend/                   # Python AWS Lambda functions (2 Lambdas)
│   ├── pyproject.toml         # Managed by uv
│   ├── src/
│   │   ├── webhook_receiver.py  # Lambda 1 (Twilio -> SQS -> 200 OK)
│   │   ├── processor.py         # Lambda 2 (SQS Processor + API Endpoints)
│   │   └── utils/               # Shared DB/S3/Bedrock/Dynamo helpers
├── modules/                   # Standalone, Sellable Assets
│   ├── whatsapp-intake/         # Standalone Twilio -> SQS webhook handler
│   ├── truth-verification-engine/ # 2-Gate deterministic GPS/Duration audit
│   ├── reward-engine/           # Hyperlocal merchant coupon voucher generator
│   └── recycling-categorizer/   # In-house post-cleanup purity & material categorizer
└── scripts/                   # Local utility and verification test scripts
```

## 4. Core Data Flow (The "PingBin V2" Loop)
1. **Intake:** Citizen sends photo via WhatsApp. Twilio hits API Gateway POST `/webhook` -> `webhook_receiver.py` (Lambda 1).
2. **Acknowledge & Queue:** `webhook_receiver.py` parses payload, sends normalized message to SQS queue (`pingbin-messages`), and returns HTTP 200 OK in <500ms.
3. **Queue Trigger & ACID Intake:** SQS triggers `processor.py` (Lambda 2).
   - **ACID Step 1:** Atomically saves raw report to DynamoDB `Reports` table with `status: "pending"`.
   - **ACID Step 2:** Downloads photo and uploads to S3 (`pingbin-images/before/{report_id}.jpg`).
   - **ACID Step 3:** Invokes Amazon Bedrock Nova Lite with merged schema (`waste_type`, `fill_percent`, `urgency`, `estimated_workers_needed`, `estimated_minutes_to_clean`, `confidence`, `suspicious_flag`, `segregation_quality`).
   - **Safety Gate Check:**
     - If `not is_valid_report`: Fails closed and flags `needs_review`.
     - If `confidence < 25`: Sets `status: "pending_admin_review"`. Does **NOT** compute priority score, does **NOT** dispatch workers. Citizen receives generic intake acknowledgement. Admin reviews via Live Priority Queue ("Reject" or "Approve & Dispatch").
     - If `confidence >= 25`: Proceeds to Step 4.
   - **ACID Step 4 (Inline Score):** Computes `priority_score` inline (40/20/15/15/10 weighted formula).
   - **ACID Step 5:** Updates DynamoDB `Reports` record with classification results and priority score.
4. **Await Location:** Bot prompts citizen on WhatsApp to share native location.
5. **Correlate & Multi-Worker Dispatch:** Citizen shares location -> `webhook_receiver.py` -> SQS -> `processor.py`.
   - Correlates location with pending photo report (by phone + 5-min window).
   - Queries `Workers` table for free workers (status = "free").
   - Assigns $N = \min(\text{estimated\_workers\_needed}, \text{free\_workers\_available})$ nearest workers via Haversine.
   - Updates report `status: "assigned"` and each assigned worker `status: "busy"`.
6. **Worker Arrival & Start Confirmation:**
   - Worker arrives at bin location and sends arrival photo + GPS location.
   - Verified $\le 50$m -> updates `status: "in_progress"` and logs `arrival_time`.
7. **Worker Completion & 2-Gate Truth Verification:**
   - Worker finishes cleanup and sends finish photo + GPS location.
   - Gate A: GPS distance $\le 50$m.
   - Gate B: `truth_percentage = min(100, round((actual_duration / estimated_time) * 100)) >= 50%`.
   - If both pass: sets `status: "resolved"`, generates local vendor coupon voucher, and triggers **Recycling & Warehouse Pipeline**.
8. **Recycling Material Categorization & Warehouse Logistics:**
   - Evaluates after-cleanup photo via `modules/recycling-categorizer/` to obtain `recycling_category` and `purity_score`. *(Note: Built in-house — the acquired ANOMALYCategorizer module was not delivered by the seller team by integration time.)*
   - Matches category against DynamoDB `Warehouses` table and selects nearest facility via Haversine.
   - Calculates recovered biomass weight: $\text{Weight} = \text{fill\_percent} \times 0.5\text{ kg}$.
   - Calculates recycling revenue: $\text{Revenue} = \text{Weight} \times \text{Base Price} \times \frac{\text{Purity}}{100}$.
   - Updates `Reports` record: `assigned_warehouse_id`, `assigned_warehouse_name`, `warehouse_status: "pending_pickup"`, `estimated_weight_kg`, `estimated_revenue`.
   - If hazardous/unmatched: sets `warehouse_status: "special_handling_required"`.
9. **Dashboard Queries:** Admin dashboard queries `/reports` and `/warehouses` to populate Command Center and Recycling & Warehouses ledgers.


