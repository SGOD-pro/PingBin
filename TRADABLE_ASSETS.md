# 🏛️ HACQUIRE M&A Trading Floor — Tradable Assets (Sell-Side)

> **Team:** PingBin / CleanLoop (PS-03: Intelligent Waste Collection & Municipal Logistics Network)  
> **Portfolio Status:** Standalone Packaged IP Assets  
> **Location:** `/modules/`

---

## 📦 Sell-Side Asset Catalog

All modules listed below are packaged as **fully isolated, standalone directories** in `/modules/`. Each contains its own `pyproject.toml`, `.env.example`, standalone documentation `README.md`, and strict interface contracts with **zero imports from the main application**.

| Asset ID | Asset Name | Category | Directory | Asking / Registered Price | Interface Signature |
|:---:|---|---|---|:---:|---|
| **MOD-TRUTH-VERIFY-01** | **Truth Score Verification Engine** | Core Audit & Anti-Fraud IP | `/modules/truth-verification-engine/` | **₹4.50 – ₹5.00 Cr Credits** | `verify_work(data: dict) -> dict` |
| **MOD-REWARD-ENGINE-02** | **Dynamic Vendor & Auto-Coupon Engine** | Commercial Gamification IP | `/modules/reward-engine/` | **₹3.50 – ₹4.00 Cr Credits** | `generate_reward(vendors: list[dict]) -> dict` |
| **MOD-WHATSAPP-INTAKE-03** | **WhatsApp Intake & Webhook Decoupler** | Ingestion & Async Decoupling IP | `/modules/whatsapp-intake/` | **₹3.00 – ₹3.50 Cr Credits** | `handle_webhook(event: dict) -> dict` |

**Total Combined Portfolio Valuation:** **₹11.00 – ₹12.50 Cr Credits**

---

## 🔍 Detailed Asset Specifications

### 1. Truth Score Verification Engine (`MOD-TRUTH-VERIFY-01`)
- **Directory:** `modules/truth-verification-engine/`
- **Target Asking Price:** ₹4.50 – ₹5.00 Cr Credits
- **Buyer Team:** *Listed on Trading Floor Catalog (No external trade executed)*
- **Dependencies:** Pure Python Standard Library (`math`, `os`). Zero external dependencies.
- **Description:** Deterministic 2-Gate Anti-Fake-Work & Field Telemetry Audit Engine. Validates spatial proximity ($\le 50\text{m}$) via inline Haversine math and temporal execution plausibility ($\ge 50\%$) without relying on non-deterministic LLM calls.
- **Real Function Signature:**
  ```python
  def verify_work(data: dict) -> dict:
  ```
- **Input Contract:**
  ```json
  {
    "estimated_minutes": 40,
    "actual_minutes": 35,
    "start_lat": 12.9716,
    "start_lng": 77.5946,
    "end_lat": 12.9718,
    "end_lng": 77.5949
  }
  ```
- **Output Contract:**
  ```json
  {
    "truth_percentage": 87,
    "gps_distance_meters": 22.5,
    "status": "resolved",
    "reason": "GPS within 50m (22.5m). Time plausibility passed (87%)."
  }
  ```
- **Cross-PS Value:** Usable in PS-1 (Waste), PS-4 (E-Commerce Deliveries), PS-6 (Pothole Road Repair), and PS-9 (Disaster Aid Drop Verification).

---

### 2. Dynamic Vendor & Auto-Coupon Reward Engine (`MOD-REWARD-ENGINE-02`)
- **Directory:** `modules/reward-engine/`
- **Target Asking Price:** ₹3.50 – ₹4.00 Cr Credits
- **Buyer Team:** *Listed on Trading Floor Catalog (No external trade executed)*
- **Dependencies:** Pure Python Standard Library (`random`, `string`). Zero external dependencies.
- **Description:** Automated merchant voucher orchestration engine. Matches eligible local sponsors and generates collision-resistant promo vouchers (`CL-{PREFIX}-{RAND}-{DISCOUNT}`) with zero database locking overhead.
- **Real Function Signature:**
  ```python
  def generate_reward(vendors: list[dict]) -> dict:
  ```
- **Input Contract:**
  ```json
  [
    {
      "vendor_id": "1",
      "vendor_name": "BigBasket",
      "discount_percent": 10
    }
  ]
  ```
- **Output Contract:**
  ```json
  {
    "selected_vendor": "BigBasket",
    "vendor_id": "1",
    "coupon_code": "CL-BIG-8X4P-10",
    "message": "10% off at BigBasket"
  }
  ```
- **Cross-PS Value:** Usable in PS-1 (Civic Waste Rewards), PS-4 (Eco-Packaging Return Incentives), PS-6 (Public Transit Commute Perks), and PS-9 (Volunteer Aid Tokens).

---

### 3. WhatsApp Intake & Webhook Decoupler (`MOD-WHATSAPP-INTAKE-03`)
- **Directory:** `modules/whatsapp-intake/`
- **Target Asking Price:** ₹3.00 – ₹3.50 Cr Credits
- **Buyer Team:** *Listed on Trading Floor Catalog (No external trade executed)*
- **Dependencies:** `boto3` (AWS Lambda Built-in / Python 3.10+)
- **Description:** Sub-100ms Twilio WhatsApp webhook intake processor for AWS Lambda. Solves the 15-second Twilio webhook timeout by immediately returning `<Response></Response>` XML ACK (<100ms) while pushing normalized JSON to AWS SQS.
- **Real Function Signature:**
  ```python
  def handle_webhook(event: dict) -> dict:
  ```
- **Input Contract (API Gateway Proxy Event):**
  ```json
  {
    "resource": "/webhook",
    "path": "/webhook",
    "httpMethod": "POST",
    "headers": {"Content-Type": "application/x-www-form-urlencoded"},
    "body": "From=whatsapp%3A%2B919084686979&To=whatsapp%3A%2B14155238886&NumMedia=1&MediaUrl0=https%3A%2F%2Fapi.twilio.com%2F...&MessageSid=SM123"
  }
  ```
- **Output Contract (API Gateway HTTP Response):**
  ```json
  {
    "statusCode": 200,
    "headers": {"Content-Type": "application/xml"},
    "body": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<Response></Response>"
  }
  ```
- **Downstream SQS Normalized Message:**
  ```json
  {
    "sender_phone": "+919084686979",
    "message_type": "photo",
    "media_url": "https://api.twilio.com/...",
    "latitude": null,
    "longitude": null,
    "body_text": "",
    "received_at": 1755787000,
    "message_sid": "SM123"
  }
  ```
- **Cross-PS Value:** Usable in any real-time messaging pipeline requiring zero-friction citizen reporting without webhook timeouts.
