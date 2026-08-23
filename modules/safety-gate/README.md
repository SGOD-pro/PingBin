# 🛡️ 3-Layer Vision & Intake Safety Gate Engine

> **Origin:** Built in-house — equivalent to planned Heavy Coding acquisition *(code not delivered by seller)*  
> **Type:** Intake Validation, Confidence Gating & Anti-Abuse IP  
> **Dependencies:** Zero external dependencies (Pure Python 3.10+ Standard Library)

---

## 🎯 Overview & Purpose

The **Safety Gate Engine** is a multi-layered intake protection module designed to prevent false dispatches, staged reports, and system abuse in municipal field operations.

It evaluates multimodal vision classification telemetry across 3 deterministic security gates:
1. **Report Validity Check (`is_valid_report`):** Rejects selfies, blurry/blank uploads, or non-waste imagery.
2. **Confidence Gating (`confidence < 25%`):** Automatically holds ambiguous reports in `pending_admin_review` to prevent unnecessary worker dispatch.
3. **Staged / Suspicious Detection (`suspicious_flag == True`):** Detects screenshots, internet duplicates, or staged waste incidents.
4. **Segregation Quality Assessment (`segregation_quality`):** Audits pre-collection sorting (`proper`, `mixed`, `improper`).

---

## 🔌 Interface Contract

### Function Signature
```python
def evaluate_safety_gate(classification: dict) -> dict:
```

### Input Contract
```json
{
  "is_valid_report": true,
  "confidence": 85,
  "suspicious_flag": false,
  "segregation_quality": "mixed",
  "waste_type": "mixed",
  "fill_percent": 75
}
```

### Output Contract
```json
{
  "passed": true,
  "status": "approved",
  "action": "dispatch",
  "confidence": 85,
  "suspicious_flag": false,
  "segregation_quality": "mixed",
  "reason": "Image passed all safety gates with confidence 85%."
}
```

---

## 🛠️ Standalone Quick Test

```bash
python3 -c "
from safety_gate import evaluate_safety_gate
res = evaluate_safety_gate({
    'is_valid_report': True,
    'confidence': 90,
    'suspicious_flag': False,
    'segregation_quality': 'mixed'
})
print('Test Output:', res)
assert res['passed'] == True
assert res['status'] == 'approved'
"
```
