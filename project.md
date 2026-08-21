# `project.md`

---

## 1. What This Is

A WhatsApp-native waste reporting and dispatch system. Citizens report overflowing bins by sending a photo through WhatsApp — no app install, no signup. The system acknowledges the Twilio webhook instantly, asynchronously classifies the waste using AI, scores it by urgency with a fixed (non-AI) formula, dispatches the nearest available worker, tracks actual work time against an AI-estimated benchmark to catch fake completions, and verifies cleanup with GPS-based proof.

**One-line pitch:** *"Your phone is already the sensor. WhatsApp is already the interface. We built the brain, the dispatch, and the audit trail in between."*

---

## 2. Why This Beats What's Already in the Market

| Existing approach | Limitation | CleanLoop's answer |
|---|---|---|
| Municipal IoT systems (Chennai, Madurai) | Requires govt-funded sensors, RFID, fixed cameras — high capex | Zero hardware. Citizen's phone is the sensor. |
| Commercial platforms (Nordsense, Bigbelly) | Built for enterprise/municipal fleets with dedicated smart bins | Works on any existing bin, any city, day one |
| Custom mobile apps (hackathon attempts) | Requires install + signup — proven adoption friction | WhatsApp — already installed, 2-tap flow |
| Systems relying on "worker marks done" | No way to verify the work actually happened | Time-vs-estimate check + GPS-distance proof — no trust required |

---

## 3. Tech Stack (Exact & Locked)

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React (Vite) + Tailwind + shadcn/ui | All latest versions. Component-driven, fast to iterate |
| Map component | `@mapcn/map` via `npx shadcn@latest add @mapcn/map` | Drop-in map component for cluster view |
| Backend | Python 3.12 (managed by `uv`) | 2 stateless AWS Lambda functions (`webhook_receiver.py`, `processor.py`) |
| Message Queue | AWS SQS (`cleanloop-messages`) | Decouples webhook ingestion from heavy processing |
| Messaging | Twilio WhatsApp API | Sandbox mode — safe for live demo |
| AI classification | Amazon Bedrock — **Nova Lite** | Multimodal (image + text), returns structured JSON. ~$0.001 per report |
| Database | DynamoDB | Two tables: `Reports`, `Workers` |
| Image storage | S3 | Before/after photos (`cleanloop-images`), referenced by URL in DB |
| Deploy | Vercel (Frontend), AWS Lambda ZIP (Backend) | Direct CLI upload to avoid SAM h## 4. Core Workflow (2-Lambda + SQS Pattern)

1. **Report** — Citizen sends a photo via WhatsApp. 
2. **Acknowledge & Queue (Critical)** — `webhook_receiver.py` (Lambda 1) catches the Twilio POST, sends the normalized event to SQS (`cleanloop-messages`), and **immediately returns HTTP 200 OK** within <500ms.
3. **Queue Processing (ACID Intake)** — SQS triggers `processor.py` (Lambda 2):
   - Atomically saves raw report to DynamoDB `Reports` table first (`status: "pending"`).
   - Downloads photo from Twilio media URL and uploads to S3 (`cleanloop-images/before/{report_id}.jpg`).
   - Calls Bedrock Nova Lite with image base64 → returns structured classification JSON (including `estimated_workers_needed` [1-4] and `estimated_minutes_to_clean`).
4. **Inline Score** — `processor.py` computes priority score inline (5 lines of math) and updates DynamoDB.
5. **Location & Correlate** — Citizen shares native WhatsApp location $\rightarrow$ Lambda 1 $\rightarrow$ SQS $\rightarrow$ `processor.py`. Correlates with pending photo report by phone number + 5-min window, updating `location_before`.
6. **Multi-Worker Dispatch** — `processor.py` matches $N = \min(\text{estimated\_workers\_needed}, \text{free\_workers\_available})$ nearest workers via Haversine distance.
   - If $N < \text{estimated\_workers\_needed}$, recalculates: `recalculated_estimated_time = estimated_minutes_to_clean * (estimated_workers_needed / N)`.
   - Sends WhatsApp assignments to all assigned workers with estimated time and location link.
   - Report status becomes `assigned`, each assigned worker becomes `busy`.
7. **Worker Arrival & Start** — Worker arrives at location and sends **PHOTO + LOCATION** via WhatsApp $\rightarrow$ Lambda 1 $\rightarrow$ SQS $\rightarrow$ `processor.py`.
   - Verifies GPS distance $\le 50$m. Uploads start photo to S3 (`start_photo_url`), saves `start_location`, logs `start_time`, and sets status to `in_progress`.
8. **Resolve & Completion** — Worker sends **after-PHOTO + LOCATION** $\rightarrow$ Lambda 1 $\rightarrow$ SQS $\rightarrow$ `processor.py`.
   - Logs `finish_time` and computes `actual_duration = finish_time - start_time`.
   - Uploads after-photo to S3 (`photo_after_url`), saves `location_after`.
9. **Truth Verification (Deterministic):**
   - **GPS Proximity check:** Haversine distance between before/after locations must be $\le 50$m.
   - **Truth Percentage check:** `truth_percentage = min(100, round((actual_duration / estimated_time_used) * 100))`.
   - If GPS $\le 50$m AND `truth_percentage >= 50` $\rightarrow$ status becomes `resolved`.
   - If GPS $> 50$m OR `truth_percentage < 50` $\rightarrow$ flagged `needs_review`.
10. **Close & Reward** — Citizen receives WhatsApp confirmation + coupon code: *"Cleaning completed! Here's your reward coupon: CLEAN10 - 10% off at [Local Store]. You've helped resolve X reports!"*. All assigned workers freed (`status: "free"`).
11. **Visualize** — Admin dashboard polls API Gateway GET `/reports` (served by Lambda 2 `processor.py`) every 5 seconds to show live cluster map, priority queue, and flagged items.

---

## 5. Priority / Triage Scoring Engine — Fixed Logic, No AI

Deterministic and explainable on purpose — much stronger in Q&A than "the model decided." In the main app pipeline, this scoring runs **inline inside Lambda 2** (5 lines of math).

| Factor | Weight |
|---|---|
| Overflow / fill % | 40 |
| Waiting time | 20 |
| Crowd density | 15 |
| Proximity to sensitive site | 15 |
| Weather (optional) | 10 |

Score = weighted sum, normalized to 0–100. Highest score dispatched first.

---

## 6. The 3 Sellable Modules (M&A Trading Floor Strategy)

Modules are strictly isolated in `/modules/`. Per hackathon rules, we must list at least 3 separable modules. Pricing is final; rules state prices can only move DOWN, so we list high based on buyer-pool scarcity.

### Module 1: Priority/Triage Scoring Engine
- **Interface:** Strictly generic. Accepts `{id, factors: {...weighted values}}`, returns ranked array. NO waste/WhatsApp-specific fields.
- **Buyer Pool:** Widest (PS-1, PS-5, PS-9, PS-10).
- **List Price:** ₹4.5–5.0 Cr (Top of band)

### Module 2: Image → Structured Classification Wrapper
- **Interface:** Generic. Accepts plain image (base64 or URL) + optional text context. NO WhatsApp payload fields.
- **Buyer Pool:** Medium (PS-1 strong, PS-8/PS-10 soft fit).
- **List Price:** ₹3.5–4.0 Cr (Mid band)

### Module 3: WhatsApp Intake Handler
- **Interface:** Coupled to Twilio. Standalone webhook handler that takes incoming Twilio POSTs, parses message types, pushes to SQS, and returns 200 OK.
- **Buyer Pool:** Narrow but sharp (PS-1, PS-9 near-certain buyers).
- **List Price:** ₹3.0–3.5 Cr (Safe pick pricing)

---

## 7. Data Model (DynamoDB)

**`Reports`**
- `report_id` (PK)
- `citizen_phone`, `worker_phone`, `worker_phones` (List)
- `assigned_workers_count` (Number)
- `photo_before_url`, `photo_after_url`, `start_photo_url` (S3 keys)
- `location_before` `{lat, lng}`, `location_after` `{lat, lng}`, `start_location` `{lat, lng}`
- `waste_type`, `fill_percent`, `urgency`, `priority_score`
- `estimated_workers_needed`, `estimated_minutes_to_clean`, `recalculated_estimated_time`
- `start_time`, `finish_time`, `actual_duration`, `truth_percentage`
- `status` (`pending` / `assigned` / `in_progress` / `resolved` / `needs_review`)
- `created_at` (ISO 8601)
- GSI on `status` + `created_at` (`status-index`) for the dashboard queue query

**`Workers`**
- `worker_id` (PK)
- `phone`, `last_known_location` `{lat, lng}`, `status` (`free` / `busy`)

---

## 8. Work Verification & Truth Scoring (Anti Fake-Work Engine)

- **Two-photo + Two-location tracking:** Worker sends arrival photo + location upon reaching bin, then cleanup photo + location upon completion.
- **Truth Percentage Calculation:** `truth_percentage = min(100, round((actual_duration / estimated_time_used) * 100))`.
- **GPS Proximity:** Double-verified ($\le 50$m) on both arrival and finish.
- **Flag, don't auto-punish:** Anomalies (<50% truth or >50m GPS) route to human review queue while freeing workers.ute to a human review queue. AI time-estimate is a heuristic, not a verdict.

---

## 9. Known Risks & Mitigations

- **Twilio 15s Timeout:** Solved by SQS decoupling. Lambda 1 sends event to SQS and returns 200 OK instantly (<500ms). Lambda 2 processes messages from SQS asynchronously.
- **Lambda + CORS:** Set CORS headers explicitly in API Gateway config, not just in Lambda response headers.
- **SAM build hangs:** Deploy via direct zip upload or AWS CLI. Don't fight SAM.
- **Lambda package size:** Limit is 50 MB zipped / 250 MB unzipped. If pushed past, move to a container image early.

---

## 10. Feature Scope

### Built (MVP / P0)
- WhatsApp photo + location intake (two-message correlation via SQS)
- Nova Lite vision classification
- Fixed-logic priority/triage scoring engine (inline inside Lambda 2)
- Nearest-worker matching and WhatsApp dispatch
- Worker START/DONE time tracking
- Deterministic GPS + time-plausibility verification
- Simulated reward counter ("You've helped resolve X reports")
- Admin dashboard: cluster map, priority queue, needs-review queue, live stats (polled from Lambda 2 GET `/reports`)
- DynamoDB seeded with synthetic reports for demo scale via local script `scripts/seed_data.py`

### Explicitly Cut
- Predictive overflow modeling (Needs real historical data)
- Illegal dumping CV detection (Separate CV problem)
- Gamified leaderboard (Cosmetic)
- QR bin identity system (Nice-to-have)
- Custom-trained detection model (No labeled dataset — using Nova Lite instead)
- Dedicated Seed/Query Lambdas (Consolidated into 2 Lambdas + local script)

---

## 11. Timeline Discipline

- **Tonight, 11:59 PM:** Repository lock. Main app + 3 standalone tradable assets committed before this.
- **Tomorrow:** Trading floor (execute the mandatory 1 buy), 90-minute integration sprint, 5-minute pitch + 4-minute Q&A.
- **Day after, 10 PM:** Final integrated repo push — 60% of the product score is graded on this.

Build the loop first. Package the 3 sellable assets second. Polish last.