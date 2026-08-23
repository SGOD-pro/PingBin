# 📚 Modules & Features Master Index — Single Source of Truth

> **System:** PingBin / CleanLoop (PS-03: Intelligent Waste Collection & Municipal Logistics Network)  
> **Purpose:** Authoritative cross-reference index for all in-house standalone modules, operational pipelines, and M&A IP assets.

---

## 📋 Comprehensive System Modules Table

| Item | Category | Location | Origin | Live Pipeline Status | Description & Interface |
|---|---|---|---|:---:|---|
| **Safety Gate (Confidence, Suspicious Flag & Segregation Audit)** | 🛠️ In-house standalone module *(Replaces Heavy Coding target)* | [`modules/safety-gate/`](modules/safety-gate/) | Replaces undelivered Heavy Coding acquisition | 🟢 **LIVE** | 3-Layer Vision & Intake Safety Gate. Evaluates `confidence`, `suspicious_flag`, and `segregation_quality`. Quarantines low-confidence (`<25%`) or suspicious reports to `pending_admin_review`. `evaluate_safety_gate(classification: dict) -> dict` |
| **Warehouse Routing & Recycling Logistics Module** | 🛠️ In-house standalone module *(Replaces ANOMALY target)* | [`modules/recycling-categorizer/`](modules/recycling-categorizer/) | Replaces undelivered ANOMALY acquisition | �� **LIVE** | Post-cleanup warehouse service integration. Inspects collected garbage post-cleanup to route material to specialized recycling warehouses (MRFs) and calculate municipal recycling revenue. `categorize_for_recycling(image_bytes_or_b64, image_format) -> dict` |
| **Truth Score Verification Engine** | 🔄 Tradable IP / Built In-House | [`modules/truth-verification-engine/`](modules/truth-verification-engine/) | Built in-house (`MOD-TRUTH-VERIFY-01`, Asking ₹4.50–5.00 Cr) | 🟢 **LIVE** | Deterministic Two-Gate Anti-Fake-Work Telemetry (Gate A: GPS Haversine $\le 50$m, Gate B: Duration plausibility $\ge 50\%$). `verify_work(data: dict) -> dict` |
| **Dynamic Vendor & Auto-Coupon Engine** | 🔄 Tradable IP / Built In-House | [`modules/reward-engine/`](modules/reward-engine/) | Built in-house (`MOD-REWARD-ENGINE-02`, Asking ₹3.50–4.00 Cr) | 🟢 **LIVE** | Hyperlocal commercial sponsor coupon voucher generator with collision-resistant codes (`CL-{PREFIX}-{RAND}-{DISCOUNT}`). `generate_reward(vendors: list[dict]) -> dict` |
| **WhatsApp Intake & Webhook Decoupler** | 🔄 Tradable IP / Built In-House | [`modules/whatsapp-intake/`](modules/whatsapp-intake/) | Built in-house (`MOD-WHATSAPP-INTAKE-03`, Asking ₹3.00–3.50 Cr) | 🟢 **LIVE** | Sub-100ms Twilio WhatsApp webhook intake processor with async AWS SQS queue decoupling for AWS Lambda. `handle_webhook(event: dict) -> dict` |

---

## 🏛️ Architectural Taxonomy & Directory Layout

All 5 core system modules are packaged under [`/modules/`](modules/) with standalone `pyproject.toml`, `.env.example`, `README.md`, and strict interface contracts:

```text
modules/
├── safety-gate/                # 3-Layer Vision Intake Safety Gate (Confidence, Staged Detection, Segregation)
├── recycling-categorizer/      # Post-Cleanup Warehouse Routing & Recycling Logistics Module
├── truth-verification-engine/  # Deterministic 2-Gate Telemetry Audit Engine (GPS Proximity + Duration Plausibility)
├── reward-engine/              # Automated Hyperlocal Merchant Voucher Orchestration Engine
└── whatsapp-intake/            # Sub-100ms Twilio WhatsApp Webhook Decoupler & SQS Dispatcher
```

---

## 🤝 M&A Acquisition & Delivery Audit

- **Heavy Coding Acquisition Target (Vision Safety Gate):** Intended for fake/staged citizen report detection. Code not delivered by seller team $\rightarrow$ Engineered in-house as [`modules/safety-gate/`](modules/safety-gate/) and wired into the live intake pipeline.
- **Team ANOMALY Acquisition Target (Warehouse Service Integration):** Intended for sending collected garbage post-cleanup to specialized recycling warehouses (MRFs) for monetization. Code not delivered by seller team $\rightarrow$ Engineered in-house as [`modules/recycling-categorizer/`](modules/recycling-categorizer/) and wired into the live warehouse dispatch pipeline.
