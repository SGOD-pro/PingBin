# 🎟️ Dynamic Vendor & Auto-Coupon Reward Engine

> **M&A Trading Floor Asset ID:** `MOD-REWARD-ENGINE-02`  
> **Target Asking Price:** **₹3.50 – ₹4.00 Cr Credits**  
> **Type:** Core Commercial Gamification & Incentives IP  
> **Dependencies:** Zero external dependencies (Pure Python 3.10+ Standard Library)

---

## 🎯 Executive Overview & Value Proposition

The **Dynamic Vendor & Auto-Coupon Engine** is a high-performance gamification module that bridges citizen/user engagement with commercial local merchant partnerships.

Whenever an action or task is successfully verified (e.g. civic reporting, recycling dropoff, survey completion), this engine instantly matches eligible commercial sponsors and generates collision-resistant, human-readable promo vouchers with zero database locking overhead.

---

## 📐 Interface Specification & Strict Contract

### Function Signature
```python
def generate_reward(vendors: list[dict]) -> dict:
```

### Input Contract
```json
[
  {
    "vendor_id": "1",
    "vendor_name": "BigBasket",
    "discount_percent": 10
  }
]
```

### Output Contract
```json
{
  "selected_vendor": "BigBasket",
  "vendor_id": "1",
  "coupon_code": "CL-BIG-8X4P-10",
  "message": "10% off at BigBasket"
}
```

---

## 🔌 Plug-and-Play Integration Across Problem Statements

### 1. Problem Statement 1 (Smart Waste & Civic Gamification)
```python
from reward import generate_reward

# Reward citizen immediately upon verified waste report cleanup
active_vendors = fetch_local_vendors(city="Bhubaneswar")
voucher = generate_reward(active_vendors)

send_whatsapp_message(
    citizen_phone,
    f"🎉 Thanks for keeping our city clean! Here is your voucher: {voucher['coupon_code']} ({voucher['message']})."
)
```

### 2. Problem Statement 4 (E-Commerce Logistics & Sustainable Returns)
```python
# Reward customers who opt for consolidated eco-friendly packaging
eco_sponsors = [{"vendor_name": "GreenMart", "discount_percent": 15}]
voucher = generate_reward(eco_sponsors)
apply_discount_to_cart(cart_id, voucher["coupon_code"])
```

### 3. Problem Statement 6 (Public Transport & Micro-Mobility Incentives)
```python
# Reward commuters who complete off-peak metro or e-bike rides
transit_perks = [{"vendor_name": "CafeCoffeeDay", "discount_percent": 20}]
reward = generate_reward(transit_perks)
send_in_app_notification(user_id, f"Commute reward unlocked: {reward['coupon_code']}")
```

### 4. Problem Statement 9 (Disaster Volunteering & Community Action)
```python
# Issue food & grocery aid vouchers to community relief volunteers
relief_partners = [{"vendor_name": "Local Ration Depot", "discount_percent": 100}]
aid_voucher = generate_reward(relief_partners)
issue_sms_token(volunteer_phone, aid_voucher["coupon_code"])
```

---

## ⚡ Quick Test

```bash
python3 -c "
from reward import generate_reward
res = generate_reward([{'vendor_id': '1', 'vendor_name': 'BigBasket'}])
print('Test Output:', res)
assert 'CL-BIG-' in res['coupon_code']
assert res['selected_vendor'] == 'BigBasket'
"
```
