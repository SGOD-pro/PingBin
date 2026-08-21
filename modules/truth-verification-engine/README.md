# 🛡️ Truth Score Verification Engine (Two-Gate Anti-Fake-Work Telemetry Engine)

> **M&A Trading Floor Asset ID:** `MOD-TRUTH-VERIFY-01`  
> **Target Asking Price:** **₹4.50 – ₹5.00 Cr Credits**  
> **Type:** Core Verification & Audit IP  
> **Dependencies:** Zero external dependencies (Pure Python 3.10+ Standard Library)

---

## 🎯 Executive Overview & Value Proposition

The **Truth Score Verification Engine** is a high-throughput, deterministic audit component designed to eliminate fraud, fake job completions, and spatial drift across distributed field operations.

Unlike fragile LLM-based verification prompts, this engine executes sub-millisecond, mathematical verification across two deterministic security gates:
1. **Gate A (Spatial Proximity)**: Validates arrival $\leftrightarrow$ completion GPS coordinates using high-precision Haversine math ($\le 50\text{ m}$).
2. **Gate B (Temporal Plausibility / Truth Ratio)**: Computes the actual execution duration against AI/operational estimated benchmarks ($\ge 50\%$).

Any failure instantly routes the transaction into an auditable `needs_review` quarantine queue with human-readable failure diagnostics.

---

## 📐 Interface Specification & Strict Contract

### Function Signature
```python
def verify_work(data: dict) -> dict:
```

### Input Contract
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

### Output Contract
```json
{
  "truth_percentage": 87,
  "gps_distance_meters": 22.5,
  "status": "resolved",
  "reason": "GPS within 50m (22.5m). Time plausibility passed (87%)."
}
```

---

## 🔌 Plug-and-Play Integration Across Problem Statements

### 1. Problem Statement 1 (Urban Waste & Sanitation Dispatch)
```python
from verifier import verify_work

audit_result = verify_work({
    "estimated_minutes": report["estimated_cleanup_time"],
    "actual_minutes": worker_session["duration_minutes"],
    "start_lat": worker_session["arrival_gps"]["lat"],
    "start_lng": worker_session["arrival_gps"]["lng"],
    "end_lat": worker_session["finish_gps"]["lat"],
    "end_lng": worker_session["finish_gps"]["lng"],
})

if audit_result["status"] == "resolved":
    trigger_citizen_reward(report["citizen_phone"])
else:
    quarantine_for_supervisor_review(report["id"], audit_result["reason"])
```

### 2. Problem Statement 4 (Last-Mile Delivery & Courier Proof-of-Delivery)
```python
# Verify courier did not falsely mark package as delivered from miles away
audit = verify_work({
    "estimated_minutes": order["eta_minutes"],
    "actual_minutes": courier["trip_duration_minutes"],
    "start_lat": customer_address["lat"],
    "start_lng": customer_address["lng"],
    "end_lat": courier_app["dropoff_gps"]["lat"],
    "end_lng": courier_app["dropoff_gps"]["lng"],
})
```

### 3. Problem Statement 6 (Civic Infrastructure & Road Repair Inspection)
```python
# Audit contractor pothole patching claims
audit = verify_work({
    "estimated_minutes": contract["benchmark_repair_time_minutes"],
    "actual_minutes": contractor["clock_time_minutes"],
    "start_lat": pothole_incident["lat"],
    "start_lng": pothole_incident["lng"],
    "end_lat": contractor["completion_gps"]["lat"],
    "end_lng": contractor["completion_gps"]["lng"],
})
```

### 4. Problem Statement 9 (Disaster Relief & Supply Drop Verification)
```python
# Ensure relief truck verified arrival at exact refugee shelter distribution coordinates
audit = verify_work({
    "estimated_minutes": mission["expected_unloading_time_minutes"],
    "actual_minutes": driver["on_site_unloading_minutes"],
    "start_lat": target_shelter["lat"],
    "start_lng": target_shelter["lng"],
    "end_lat": truck_telemetry["lat"],
    "end_lng": truck_telemetry["lng"],
})
```

---

## ⚡ Quick Test

```bash
python3 -c "
from verifier import verify_work
res = verify_work({
    'estimated_minutes': 40,
    'actual_minutes': 35,
    'start_lat': 12.9716, 'start_lng': 77.5946,
    'end_lat': 12.9718, 'end_lng': 77.5949
})
print('Test Output:', res)
assert res['status'] == 'resolved'
"
```
