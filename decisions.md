# `decisions.md`

## Architectural Decision Records (ADR)

This document locks in the "why" behind every major choice. These decisions are final and accepted. The AI agent MUST NOT suggest alternatives or override these decisions during the build.

---

### AD-001: WhatsApp as the Sole Citizen/Worker Interface
**Status:** Accepted  
**Context:** Every municipal smart-waste rollout researched (Chennai, Madurai) hits the same wall: citizens won't download a custom app. Custom mobile apps create adoption friction that kills pilots before they scale.  
**Decision:** Citizens and workers interact with the system exclusively via WhatsApp. No native app, no PWA, no web form for citizens.  
**Consequences:** 
- **Gain:** Zero onboarding friction. WhatsApp is already installed and trusted. Pitch differentiator is immediately obvious to judges.
- **Tradeoff:** WhatsApp strips GPS/EXIF metadata from photos on send. Mitigated by using WhatsApp's native "Share Location" feature as a separate message and correlating by phone+timestamp.

---

### AD-002: Decoupled 2-Lambda + SQS Pattern (Twilio Timeout & Concurrency Fix)
**Status:** Accepted  
**Context:** Twilio webhooks require an HTTP 2xx response within ~15 seconds. AWS Lambda cold starts + Bedrock API calls + S3 uploads can realistically exceed this, causing Twilio to mark the webhook as failed, trigger retries, and create duplicate processing or silent failures during live demo. Async Lambda-to-Lambda invocation also lacks durable queuing.  
**Decision:** Decouple intake and processing using 2 Lambdas and an AWS SQS queue (`cleanloop-messages`). Lambda 1 (`webhook_receiver.py`) receives the Twilio POST, sends a normalized JSON message to SQS, and immediately returns HTTP 200 OK (<500ms). Lambda 2 (`processor.py`) is SQS-triggered to do all heavy work (ACID DB writes, Bedrock Nova Lite classification, inline scoring, worker dispatch, and verification). Lambda 2 also serves API Gateway GET `/reports` for dashboard queries (and optional GET `/seed`).  
**Consequences:**
- **Gain:** Guaranteed <500ms webhook response. Zero risk of Twilio timeout. Durable message queuing via SQS. Natural backpressure and retry handling.
- **Tradeoff:** SQS queue to provision. Processing is fully asynchronous. Mitigated by SQS-Lambda event source mapping.

---

### AD-003: Amazon Bedrock Nova Lite Instead of Custom YOLOv8 Model
**Status:** Accepted  
**Context:** The original market research suggested a custom YOLOv8 model for waste classification. Training a custom model requires labeled datasets, GPU time, and model hosting infrastructure — none of which are viable in a 24-hour hackathon.  
**Decision:** Use Amazon Bedrock's Nova Lite model (`amazon.nova-lite-v1:0`) for multimodal image classification. Send the image base64 + a structured prompt, receive JSON back.  
**Consequences:**
- **Gain:** No training, no model hosting, no GPU dependencies. Sub-cent cost per report. Fast to implement (API call). Highly accurate for hackathon purposes.
- **Tradeoff:** No custom control over specific waste subclasses. Mitigated by prompt engineering.

---

### AD-004: Deterministic Fixed-Logic Scoring (Inline Math Inside Lambda 2)
**Status:** Accepted  
**Context:** Priority scoring could be done by an LLM, but "the model decided" is a weak answer in Q&A when a judge asks why a specific ticket was prioritized. Furthermore, making external function/module calls inside the core Lambda adds overhead.  
**Decision:** Priority score is computed by pure Python math using fixed weights (40/20/15/15/10) directly **inline inside Lambda 2** (5 lines of math). AI's only job is producing the raw signals (fill %, type, estimates).  
**Consequences:**
- **Gain:** Fully explainable. Defensible in Q&A. Deterministic. Ultra-fast execution with zero dependency overhead.
- **Tradeoff:** Less "magical" in a pitch. Mitigated by calling it "Explainable Operations Logic" — a feature, not a bug.

---

### AD-005: 2 Pure AWS Lambda Handlers + Local Scripts — No Web Framework
**Status:** Accepted  
**Context:** The backend needs to handle Twilio webhooks, heavy background processing, and dashboard queries. FastAPI or Flask could be used via Mangum, or 4 separate Lambdas could be deployed, but they add package size, cold starts, and management overhead.  
**Decision:** Consolidate backend compute into **exactly 2 pure AWS Lambda handlers**:
1. `webhook_receiver.py` (Lambda 1): POST `/webhook` → SQS → 200 OK.
2. `processor.py` (Lambda 2): SQS trigger (heavy work) + GET `/reports` (dashboard query) + optional GET `/seed`.
Seed data is run via a local Python script in `scripts/seed_data.py`. No FastAPI, no Flask, no Django.  
**Consequences:**
- **Gain:** Minimal cold start. Small package size. Simple architecture to maintain and explain. Exactly 2 Lambdas to deploy.
- **Tradeoff:** Lambda 2 handles dual event types (SQS records vs API Gateway proxy event). Mitigated by simple event inspection (`if "Records" in event ... else ...`).

---

### AD-006: Polling Instead of WebSockets for Admin Dashboard
**Status:** Accepted  
**Context:** Live admin dashboard needs to show real-time updates. WebSockets or Server-Sent Events (SSE) would provide push-based updates.  
**Decision:** Use 5-second polling via `setInterval` in React `useEffect`. Dashboard calls GET `/reports` every 5 seconds.  
**Consequences:**
- **Gain:** No WebSocket infrastructure (API Gateway WebSocket routes, connection management, reconnection logic). Trivial to implement. Works everywhere.
- **Tradeoff:** Dashboard updates lag by up to 5 seconds. For a 5-minute live demo, this is imperceptible.

---

### AD-007: Module Genericization — Modules 1 & 2 Decoupled, Module 3 Coupled
**Status:** Accepted  
**Context:** The M&A trading floor requires selling modules to other teams. Most other teams (PS-1, PS-5, PS-9) are building traditional web apps, not WhatsApp-native ones. If the Priority Engine or Image Classifier expect Twilio-shaped payloads, they're useless to buyers.  
**Decision:** 
- Module 1 (Priority Engine): Strictly generic. Accepts `{id, factors: {...}}`, returns ranked array. No domain-specific fields.
- Module 2 (Image Classifier): Strictly generic. Accepts base64/URL + text context. Returns `{category, fill_percent, urgency, ...}`. No domain-specific fields in interface.
- Module 3 (WhatsApp Intake): Stays Twilio-coupled. It packages Lambda 1's webhook handler standalone (Twilio POST → SQS → 200 OK).  
**Consequences:**
- **Gain:** Modules 1 and 2 are sellable to any team with a queue or image classification need. Module 3 is highly targeted but high-value to PS-1 and PS-9.
- **Tradeoff:** Main app implements scoring inline for speed, while Module 1 is preserved as a tradable asset.

---

### AD-008: DynamoDB Two-Table Design Instead of Single-Table
**Status:** Accepted  
**Context:** DynamoDB single-table design is optimal for production scale, but requires careful access pattern analysis and GSI design that takes hours to get right.  
**Decision:** Use two simple tables: `Reports` and `Workers`. One GSI on `status` + `created_at` (`status-index`) for the dashboard query.  
**Consequences:**
- **Gain:** Fast to implement. Easy to reason about. Easy to seed with demo data.
- **Tradeoff:** Slightly less efficient at massive scale (table scans for free workers). Irrelevant for hackathon demo with 3-5 workers.

---

### AD-009: Double-Photo Arrival Confirmation + Truth Percentage (Anti Fake-Work Engine)
**Status:** Accepted  
**Context:** Simply sending text "START" or trusting single timestamps leaves room for worker ghost-clocking and location fraud.  
**Decision:** 
1. Worker sends **PHOTO + LOCATION** upon arrival. System saves `start_photo_url` and verifies GPS distance $\le 50$m before setting `status = "in_progress"`.
2. Worker sends **after-PHOTO + LOCATION** upon completion.
3. System computes `truth_percentage = min(100, round((actual_duration / estimated_time_used) * 100))`.
4. If GPS $\le 50$m AND `truth_percentage >= 50%`, status is `resolved`. If GPS $> 50$m OR `truth_percentage < 50%`, status is flagged `needs_review` while freeing workers.  
**Consequences:**
- **Gain:** Mathematical, defensible audit score. Double GPS proof (arrival + finish). Eliminates fake work while remaining non-punitive (routes to review).
- **Tradeoff:** Requires worker to send 2 photos per ticket.

---

### AD-010: Simulated Reward Counter & Coupon Code (`CLEAN10`)
**Status:** Accepted  
**Context:** Full loyalty/coupon database systems add unnecessary backend surface for a 24-hour hackathon.  
**Decision:** Increment citizen's resolved report count and include an actionable promo code in the WhatsApp completion message: `"Cleaning completed! Here's your reward coupon: CLEAN10 - 10% off at [Local Store]. You've helped resolve {count} reports!"`  
**Consequences:**
- **Gain:** Instant gratification for citizens in demo.
- **Tradeoff:** No complex merchant redemption backend.

---

### AD-011: S3 Public-Readable Bucket Instead of Presigned URLs
**Status:** Accepted  
**Context:** Before/after photos need to be displayed in the admin dashboard. Presigned URLs add complexity (expiry management, regeneration logic).  
**Decision:** Make the S3 bucket public-readable for the hackathon. Store the full URL in DynamoDB.  
**Consequences:**
- **Gain:** Dashboard just renders `<img src={photo_url}>`. No auth, no expiry, no complexity.
- **Tradeoff:** Security risk in production. Narrative: "In production, this would use CloudFront + signed cookies. For demo, public bucket."

---

### AD-012: Twilio WhatsApp Sandbox Instead of Registered Business
**Status:** Accepted  
**Context:** Twilio WhatsApp Business API requires a Facebook Business Manager verification and Meta review — a multi-week process that is impossible during a hackathon.  
**Decision:** Use Twilio WhatsApp Sandbox. Sandbox allows testing without business verification.  
**Consequences:**
- **Gain:** Live demo works immediately. No verification wait.
- **Tradeoff:** Sandbox requires users to send a join code before interacting. For demo, the team's phones are pre-joined.

---

### AD-013: Multi-Worker Dynamic Assignment & Time Recalculation
**Status:** Accepted  
**Context:** Bedrock vision AI estimates how many workers are needed (1–4) and the cleaning duration. If 4 workers are needed but only 2 are free, single-worker dispatch leads to under-resourced jobs and false fake-work flags.  
**Decision:** System assigns $N = \min(\text{needed}, \text{free})$ workers. If $N < \text{needed}$, dynamically recalculates:
`recalculated_estimated_time = estimated_minutes_to_clean * (estimated_workers_needed / N)` and stores this in DynamoDB for the truth percentage calculation.  
**Consequences:**
- **Gain:** Mathematically sound capacity modeling. Truth percentage scales with team size.
- **Tradeoff:** Must notify and free multiple workers per job.

