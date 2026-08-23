# 🏭 Post-Cleanup Warehouse Routing & Recycling Logistics Module

> **Asset Name:** Warehouse Service & Recycling Logistics Integration  
> **Target Acquisition Story:** Acquired on the M&A trading floor to integrate downstream municipal warehouse logistics into PingBin — routing collected garbage post-cleanup to specialized recycling warehouses (MRFs) for monetization instead of dumping it in landfills.  
> **Origin:** Built in-house — the acquired ANOMALY module was not delivered by the seller team by integration time.

---

## 🎯 Executive Overview & Purpose

The **Warehouse Routing & Recycling Logistics Module** bridges physical cleanup operations with downstream circular economy infrastructure.

Once a waste report is cleaned and verified by workers on site, this module inspects the collected material and determines:
1. **Recycling Stream:** (`plastic`, `organic`, `e_waste`, `paper`, `glass`, `metal`, `hazardous`, `mixed`)
2. **Batch Purity Score ($0-100\%$):** How well segregated and clean the collected waste is for facility processing.

This telemetry directly drives:
- **Automated Warehouse Routing:** Assigns the collection batch to the nearest specialized Materials Recovery Facility (MRF) (e.g. Patia MRF for Plastic, Chandrasekharpur for Organics, Rasulgarh for E-Waste).
- **Municipal Recycling Revenue:** Calculates recovery revenue:
  $$\text{Revenue (₹)} = \text{Estimated Weight (kg)} \times \text{Facility Rate (₹/kg)} \times \left(\frac{\text{Purity \%}}{100}\right)$$

---

## 🔌 Interface Contract

### Function Signature
```python
def categorize_for_recycling(image_bytes_or_b64: bytes | str, image_format: str = "jpeg") -> dict:
```

### Input Contract
- `image_bytes_or_b64`: Raw bytes or base64 encoded string of the worker's post-cleanup photo.
- `image_format`: `"jpeg"`, `"png"`, or `"webp"`.

### Output Contract (Warehouse Allocation Payload)
```json
{
  "recycling_category": "plastic",
  "purity_score": 85,
  "notes": "Sorted PET bottles ready for baling and warehouse transfer."
}
```

---

## 🛠️ Standalone Quick Test

```bash
python3 -c "
from categorizer import categorize_for_recycling
res = categorize_for_recycling('')
print('✅ Warehouse Logistics Test:', res['recycling_category'], f'Purity: {res[\"purity_score\"]}%')
assert res['recycling_category'] == 'mixed'
"
```
