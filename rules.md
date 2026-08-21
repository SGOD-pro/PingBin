# `rules.md`

## 1. General Coding Rules

- **RULE 1.1:** No commented-out dead code. If it's not used, delete it.
- **RULE 1.2:** No `print()` or `console.log()` left in final code. Use structured logging (`logging.info` in Python) if debugging is needed, but clean up before commit.
- **RULE 1.3:** No TODO comments without a timestamp and owner. Example: `# TODO [2026-08-21]: handle empty worker pool`. If you can't fill it in, delete the comment.
- **RULE 1.4:** No placeholder functions that return hardcoded data without a `# MOCK` comment. If it's mocked, label it. If it's real, it's real.
- **RULE 1.5:** Environment variables MUST be read via `os.environ.get("VAR_NAME", "default_value")`. Never assume the variable exists. Always have a fallback.
- **RULE 1.6:** No hardcoding of secrets, API keys, or tokens in source code. All secrets in `.env` files. `.env` files MUST be in `.gitignore`.
- **RULE 1.7:** All functions with more than 20 lines MUST have a docstring explaining what they do, inputs, and outputs.
- **RULE 1.8:** No nested `if` statements deeper than 3 levels. Refactor to early returns or helper functions.

---

## 2. Backend (Python) Rules

- **RULE 2.1:** ALL Python dependency management is done via `uv`. 
  - Initialize project: `uv init`
  - Add dependency: `uv add boto3 twilio requests`
  - Run script: `uv run python script.py`
  - DO NOT use `pip install`. DO NOT use `poetry`. DO NOT generate `requirements.txt`.
- **RULE 2.2:** Python version is 3.12. All type hints MUST use Python 3.12 syntax (e.g., `list[dict]` not `List[Dict]`, `str | None` not `Optional[str]`).
- **RULE 2.3:** Backend framework is **pure AWS Lambda handlers** (exactly 2 Lambdas: `webhook_receiver.py` and `processor.py`). 
  - DO NOT import or use FastAPI, Flask, Django, or any web framework.
  - Handler signature: `def lambda_handler(event: dict, context: dict) -> dict:`
  - Lambda 2 has dual triggers: SQS queue (`cleanloop-messages`) and API Gateway GET `/reports` (plus optional GET `/seed`).
- **RULE 2.4:** No global mutable state. Lambda containers are reused, but you MUST NOT rely on global variables for business logic. State goes in DynamoDB.
- **RULE 2.5:** All AWS service clients (boto3) MUST be instantiated at module level, not inside the handler. This enables container reuse and avoids cold-start overhead.
  ```python
  # CORRECT
  dynamodb = boto3.resource("dynamodb")
  table = dynamodb.Table("Reports")
  sqs = boto3.client("sqs")
  
  def lambda_handler(event, context):
      table.put_item(...)
  
  # WRONG
  def lambda_handler(event, context):
      dynamodb = boto3.resource("dynamodb")  # Do NOT do this
  ```
- **RULE 2.6:** JSON parsing MUST use `json.loads()` with try/except. Bedrock model responses are text strings that may contain markdown fences (```json). Strip them before parsing.
  ```python
  # Expected Bedrock response parsing pattern
  raw_text = response["output"]["message"]["content"][0]["text"]
  # Strip markdown fences if present
  if raw_text.startswith("```json"):
      raw_text = raw_text[7:-3]
  parsed = json.loads(raw_text)
  ```
- **RULE 2.7:** Haversine distance calculation MUST be implemented inline or in a utility file (`backend/src/utils/haversine.py`). Do NOT install `geopy` or `haversine` packages. It's a 10-line math function. Write it yourself.
- **RULE 2.8:** Priority scoring in the core pipeline is **INLINE inside Lambda 2** (5 lines of math). Do not make a separate module or function call for scoring in the main processing flow.

---

## 3. Frontend (React) Rules

- **RULE 3.1:** Frontend uses Vite + React + Tailwind CSS + shadcn/ui. 
  - Initialize: `npm create vite@latest frontend -- --template react-ts` (or `pnpm`)
  - DO NOT use Next.js. DO NOT use Create React App. DO NOT use Remix.
- **RULE 3.2:** All UI components MUST come from shadcn/ui. 
  - Install component: `npx shadcn@latest add button card table badge`
  - DO NOT install MUI, Ant Design, Chakra UI, or Mantine.
- **RULE 3.3:** Map component MUST be `@mapcn/map` installed via shadcn CLI:
  - `npx shadcn@latest add @mapcn/map`
  - DO NOT install `react-leaflet`, `react-map-gl`, or `react-google-maps` directly.
- **RULE 3.4:** Polling interval for admin dashboard is **5 seconds**. Use `setInterval` inside a `useEffect` with proper cleanup.
  ```javascript
  useEffect(() => {
    const interval = setInterval(fetchReports, 5000);
    return () => clearInterval(interval);
  }, []);
  ```
- **RULE 3.5:** No state management library (Redux, Zustand, MobX). Use React Context + `useState` + `useEffect` only. The app is not complex enough to justify it.
- **RULE 3.6:** All API calls MUST use `fetch()`. Do NOT install `axios`. 
- **RULE 3.7:** API responses MUST be typed with TypeScript interfaces. No `any` types.
- **RULE 3.8:** Tailwind classes only. No inline styles (`style={{...}}`). No CSS modules.

---

## 4. Sellable Module Isolation Rules (Critical)

These rules are non-negotiable. Violating them makes the assets unsellable on the M&A trading floor, which directly impacts the hackathon score.

- **RULE 4.1:** Each of the 3 modules MUST be in its own directory under `/modules/`:
  - `/modules/priority-engine/`
  - `/modules/image-classifier/`
  - `/modules/whatsapp-intake/`
- **RULE 4.2:** Modules MUST NOT import from `/backend/` or `/frontend/`. 
  - The main app can import from modules.
  - Modules CANNOT import from the main app.
  - Enforce this with a `README.md` in each module directory stating: "This module is standalone. It has zero dependencies on the parent application."
- **RULE 4.3:** Module 1 (Priority Engine) and Module 2 (Image Classifier) MUST NOT reference:
  - "waste", "report", "citizen", "worker", "bin", "garbage", "trash"
  - "WhatsApp", "Twilio", "message"
  - Any field name from the DynamoDB schema (e.g., `report_id`, `citizen_phone`)
- **RULE 4.4:** Module 3 (WhatsApp Intake) IS allowed to reference Twilio and WhatsApp. It is Lambda 1's webhook handler packaged standalone (Twilio POST → SQS → 200 OK).
- **RULE 4.5:** Each module MUST have:
  - `README.md` with a real input → output example.
  - `.env.example` with all required environment variables.
  - No external dependencies beyond what's listed in its own `pyproject.toml` or `package.json`.
- **RULE 4.6:** Module pricing is set at listing time and can only move DOWN:
  - Priority Engine: ₹4.5–5.0 Cr
  - Image Classifier: ₹3.5–4.0 Cr
  - WhatsApp Intake: ₹3.0–3.5 Cr
  - DO NOT discount on day one. Discount only if an asset isn't moving near close of trading window.

---

## 5. Error Handling Rules

- **RULE 5.1:** Lambda 1 (`webhook_receiver.py`) MUST NEVER throw an unhandled exception.
  ```python
  def lambda_handler(event, context):
      try:
          # parse Twilio body, send to SQS
          return {"statusCode": 200, "body": "<Response></Response>"}
      except Exception as e:
          logging.error(f"Webhook error: {e}")
          return {"statusCode": 200, "body": "<Response></Response>"}  # STILL return 200
  ```
- **RULE 5.2:** If Bedrock AI call fails, use fallback defaults (see FR-2 in requirements.md). Do NOT crash the pipeline.
- **RULE 5.3:** If DynamoDB write fails, retry once. If it fails again, log to CloudWatch and let the report stay in its previous state.
- **RULE 5.4:** If Twilio outbound message fails, retry once. If it fails again, the report still exists in DynamoDB as `pending` or `assigned`. The system doesn't crash.
- **RULE 5.5:** Frontend `fetch()` calls MUST have try/catch. On error, show a toast notification (shadcn `useToast`) and keep the last successful data on screen.
- **RULE 5.6:** Never show a blank screen or white screen of death. Always render the layout with an error state.

---

## 6. Dependency Management Rules

- **RULE 6.1:** Python backend dependencies are managed by `uv`. The `pyproject.toml` is the source of truth.
- **RULE 6.2:** Frontend dependencies are managed by `npm` or `pnpm` (pick one, stick with it). The `package.json` is the source of truth.
- **RULE 6.3:** Lock files (`uv.lock`, `package-lock.json` or `pnpm-lock.yaml`) MUST be committed to git.
- **RULE 6.4:** No global installations. All dependencies must be project-local.
- **RULE 6.5:** No dev dependencies for production code. `pytest`, `black`, `ruff` are dev dependencies and go in the dev section.

---

## 7. Git & Repository Rules

- **RULE 7.1:** Repository lock is tonight at 11:59 PM. All code MUST be committed and pushed before this deadline. No exceptions.
- **RULE 7.2:** Commit messages MUST follow conventional commits format:
  - `feat: add WhatsApp webhook receiver Lambda`
  - `feat: decouple webhook processing with SQS queue`
  - `chore: seed DynamoDB with synthetic reports via script`
  - `docs: update module README for priority engine`
- **RULE 7.3:** The 3 sellable modules MUST be in the same repository as the main app, but in isolated `/modules/` directories.
  - Branch strategy: `main`, `module/priority-engine`, `module/image-classifier`, `module/whatsapp-intake`.
  - Each module branch contains ONLY the module directory contents at root level.
- **RULE 7.4:** The main branch MUST contain the full application including the `/modules/` directory.
- **RULE 7.5:** Demo videos (30–45s screen recordings) MUST be included in each module branch's `README.md` or linked via Google Drive/YouTube.

---

## 8. AI Agent Behavior Rules

When building this project, the AI agent MUST:

- **RULE 8.1:** Read and acknowledge `architecture.md`, `project.md`, and `requirements.md` before writing any code.
- **RULE 8.2:** Use `uv` for all Python backend dependency management. If the agent tries to run `pip install`, stop and correct it.
- **RULE 8.3:** Use `npm` or `pnpm` for all frontend dependency management. If the agent tries to use `yarn`, stop and correct it.
- **RULE 8.4:** Isolate the 3 sellable modules in `/modules/` with zero imports from main backend. If the agent adds an import from `backend/` in a module, stop and correct it.
- **RULE 8.5:** Implement the 2-Lambda + SQS pattern (Lambda 1 sends to SQS and returns 200, Lambda 2 processes SQS messages and serves GET `/reports`). If the agent puts Bedrock or DynamoDB calls inside the Twilio webhook response cycle, stop and correct it.
- **RULE 8.6:** Use pure Lambda handlers — no FastAPI, no Flask, no Django. If the agent imports a web framework, stop and correct it.
- **RULE 8.7:** Use Nova Lite for all AI classification calls. If the agent suggests fine-tuning a YOLOv8 model or installing `ultralytics`, stop and correct it.
- **RULE 8.8:** Use inline scoring inside Lambda 2 (5 lines of math). If the agent creates a separate function call or imports external modules for core scoring, stop and correct it.
- **RULE 8.9:** Follow the exact interface contracts in `requirements.md` §3. If the agent changes the function signatures or field names, stop and correct it.
- **RULE 8.10:** Do not add features listed in `requirements.md` §6 (Out of Scope). If the agent suggests adding WebSockets, authentication, gamification, or QR codes, stop and correct it.

The agent MUST NOT:
- Create a `requirements.txt` file.
- Install packages via `pip install`.
- Add WebSocket infrastructure.
- Add authentication to the admin dashboard.
- Create separate `query_reports.py` or `seed_data.py` Lambdas (Lambda 2 handles queries; `scripts/seed_data.py` handles seeding).
- Couple Module 1 or Module 2 to WhatsApp/Twilio/waste-specific fields.
- Synchronously call Bedrock or DynamoDB inside the Twilio webhook handler.
- Add features listed in Section 6 of requirements.md.

---