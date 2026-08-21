# 🚀 PingBin — Intelligent Municipal Logistics & Verification Network

**PingBin** is an enterprise-grade municipal logistics and civic verification network powered by real-time citizen WhatsApp intake, AWS Bedrock Nova Lite multimodal vision triage, deterministic two-gate anti-fake-work audit telemetry, and hyperlocal commercial coupon rewards.

---

## 🏛️ HACQUIRE M&A Trading Floor — Tradable Assets Catalog

According to HACQUIRE M&A trading floor rules, all modules below are packaged as **standalone, fully decoupled directories in `/modules/`** with zero imports from the core application, dedicated `pyproject.toml`, `.env.example`, standalone `README.md`, and strict interface contracts.

### 💰 Budget & Valuation Strategy
- **Core Feature Assets Budget Cap:** Up to **10.00 Cr Credits**
- **Auxiliary Modules Budget Cap:** Up to **5.00 Cr Credits**

---

## 📦 Summary of Tradable Modules

| # | Tradable Asset | Category | Directory | Asking Price | Interface Signature |
|:---:|---|---|---|:---:|---|
| **1** | **Truth Score Verification Engine** | Core Audit IP | [`/modules/truth-verification-engine/`](file:///home/swyra/projects/garbage-collector/modules/truth-verification-engine/) | **₹4.50 – 5.00 Cr** | `verify_work(data: dict) -> dict` |
| **2** | **Dynamic Vendor & Auto-Coupon Engine** | Commercial IP | [`/modules/reward-engine/`](file:///home/swyra/projects/garbage-collector/modules/reward-engine/) | **₹3.50 – 4.00 Cr** | `generate_reward(vendors: list[dict]) -> dict` |
| **3** | **WhatsApp Intake & Webhook Decoupler** | Ingestion IP | [`/modules/whatsapp-intake/`](file:///home/swyra/projects/garbage-collector/modules/whatsapp-intake/) | **₹3.00 – 3.50 Cr** | `handle_webhook(event: dict) -> dict` |

**Total Combined Portfolio Valuation:** **₹11.00 – 12.50 Cr Credits**

---

## 🔍 Deep-Dive Module Breakdown

### 1. Truth Score Verification Engine (`/modules/truth-verification-engine/`)
- **Asking Price:** ₹4.50 – ₹5.00 Cr
- **Description:** Deterministic 2-Gate Anti-Fake-Work & Field Telemetry Audit Engine. Validates spatial proximity ($\le 50\text{m}$) via inline Haversine math and temporal execution plausibility ($\ge 50\%$) with zero external dependencies.
- **Contract:**
  ```python
  from verifier import verify_work

  result = verify_work({
      "estimated_minutes": 40,
      "actual_minutes": 35,
      "start_lat": 12.9716, "start_lng": 77.5946,
      "end_lat": 12.9718, "end_lng": 77.5949
  })
  # Returns: {"truth_percentage": 87, "gps_distance_meters": 22.5, "status": "resolved", "reason": "..."}
  ```
- **Cross-PS Value:** Usable in PS-1 (Waste), PS-4 (E-Commerce Deliveries), PS-6 (Pothole Road Repair), and PS-9 (Disaster Aid Drop Verification).

---

### 2. Dynamic Vendor & Auto-Coupon Engine (`/modules/reward-engine/`)
- **Asking Price:** ₹3.50 – ₹4.00 Cr
- **Description:** Automated merchant voucher orchestration engine. Automatically matches eligible local sponsors and generates collision-resistant promo vouchers with zero database locking overhead.
- **Contract:**
  ```python
  from reward import generate_reward

  voucher = generate_reward([{"vendor_id": "1", "vendor_name": "BigBasket", "discount_percent": 10}])
  # Returns: {"selected_vendor": "BigBasket", "coupon_code": "CL-BIG-8X4P-10", "message": "10% off at BigBasket"}
  ```
- **Cross-PS Value:** Usable in PS-1 (Civic Waste Rewards), PS-4 (Eco-Packaging Return Incentives), PS-6 (Public Transit Commute Perks), and PS-9 (Volunteer Aid Tokens).

---

### 3. WhatsApp Intake & Webhook Decoupler (`/modules/whatsapp-intake/`)
- **Asking Price:** ₹3.00 – ₹3.50 Cr
- **Description:** Sub-100ms Twilio WhatsApp webhook intake processor for AWS Lambda. Decouples heavy downstream AI processing by immediately returning `<Response></Response>` XML ACK and dispatching normalized JSON to AWS SQS.
- **Contract:**
  ```python
  from handler import handle_webhook

  response = handle_webhook(event)
  # Returns: {"statusCode": 200, "headers": {"Content-Type": "application/xml"}, "body": "<Response></Response>"}
  ```
- **Cross-PS Value:** Usable in any real-time messaging pipeline requiring zero-friction citizen reporting without webhook timeouts.

---

## 🛠️ Verification & Testing

Run all standalone module unit tests with pure Python:

```bash
# 1. Test Truth Score Verification Engine
PYTHONPATH=modules/truth-verification-engine python3 -c "
from verifier import verify_work
res = verify_work({'estimated_minutes': 40, 'actual_minutes': 35, 'start_lat': 20.35, 'start_lng': 85.81, 'end_lat': 20.3501, 'end_lng': 85.8101})
print('✅ Verifier Test:', res['status'], f'(Truth: {res[\"truth_percentage\"]}%)')
assert res['status'] == 'resolved'
"

# 2. Test Dynamic Reward Engine
PYTHONPATH=modules/reward-engine python3 -c "
from reward import generate_reward
res = generate_reward([{'vendor_name': 'Puri Sweets', 'discount_percent': 20}])
print('✅ Reward Test:', res['selected_vendor'], 'Code:', res['coupon_code'])
assert 'CL-PUR-' in res['coupon_code']
"

# 3. Test WhatsApp Intake
PYTHONPATH=modules/whatsapp-intake python3 -c "
from handler import handle_webhook
res = handle_webhook({'body': 'From=whatsapp%3A%2B919084686979&Body=PingBin'})
print('✅ WhatsApp Intake Test: Status', res['statusCode'])
assert res['statusCode'] == 200
"
```
