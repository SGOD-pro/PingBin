#!/usr/bin/env python3
"""CleanLoop — Complete Database Reset & Bhubaneswar Live Judge Demo Seeder.

Prepares the system for a fresh live demonstration in front of judges in Bhubaneswar (Odisha).
- Wipes all test Reports and Coupons.
- Configures 3 Real WhatsApp Worker numbers in Bhubaneswar zones (Patia/KIIT, Saheed Nagar, Master Canteen).
- Seeds local Bhubaneswar vendor partners (Puri Bakers, Blinkit Patia, CCD Infocity).
"""

import sys
import os
from decimal import Decimal

# Add backend/src to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend/src")))

from config import settings
from utils.dynamo import (
    reports_table,
    workers_table,
    vendors_table,
    coupons_table,
    create_worker,
    create_vendor,
)

print("=" * 70)
print("  CLEANLOOP — BHUBANESWAR LIVE JUDGE DEMO RESET & INITIALIZER")
print("=" * 70)

# 1. Clear Reports table
print("\n[1/4] Clearing Reports Table...")
reports = reports_table.scan().get("Items", [])
for r in reports:
    reports_table.delete_item(Key={"report_id": r["report_id"]})
print(f"  ✅ Deleted {len(reports)} past test reports.")

# 2. Clear Coupons table
print("\n[2/4] Clearing Coupons Table...")
coupons = coupons_table.scan().get("Items", [])
for c in coupons:
    coupons_table.delete_item(Key={"coupon_id": c["coupon_id"]})
print(f"  ✅ Deleted {len(coupons)} past test coupons.")

# 3. Clear & Seed Workers in Bhubaneswar
print("\n[3/4] Initializing Bhubaneswar Field Worker Fleet...")
existing_workers = workers_table.scan().get("Items", [])
for w in existing_workers:
    workers_table.delete_item(Key={"worker_id": w["worker_id"]})

bhubaneswar_workers = [
    {
        "name": "Worker 1 (Field Unit - Patia)",
        "phone": "+919382122857",
        "lat": 20.3533,
        "lng": 85.8197,
        "photo_url": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
    },
    {
        "name": "Worker 2 (Field Unit - Patia)",
        "phone": "+919932948540",
        "lat": 20.3533,
        "lng": 85.8197,
        "photo_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
    },
    {
        "name": "Worker 3 (Auxiliary Fleet)",
        "phone": "+919263405367",
        "lat": 20.3533,
        "lng": 85.8197,
        "photo_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
    },
]

for w in bhubaneswar_workers:
    item = create_worker(
        name=w["name"],
        phone=w["phone"],
        lat=w["lat"],
        lng=w["lng"],
        photo_url=w["photo_url"],
    )
    print(f"  👷 Registered: {w['name']} ({w['phone']}) @ [{w['lat']}, {w['lng']}] - Status: FREE")

# 4. Clear & Seed Bhubaneswar Vendors
print("\n[4/4] Registering Local Bhubaneswar Reward Vendors...")
existing_vendors = vendors_table.scan().get("Items", [])
for v in existing_vendors:
    vendors_table.delete_item(Key={"vendor_id": v["vendor_id"]})

bhubaneswar_vendors = [
    {
        "vendor_name": "Puri Sweets & Bakery (Patia)",
        "category": "Bakery & Cafe",
        "description": "Artisan baked goods & authentic Odisha sweets near KIIT square",
        "city": "Bhubaneswar",
        "area": "Patia / KIIT",
        "lat": 20.3533,
        "lng": 85.8197,
        "coupon_templates": [
            {
                "offer_type": "flat_off",
                "value": Decimal("50"),
                "min_spend": Decimal("199"),
                "description": "Flat ₹50 OFF on orders above ₹199",
                "validation": "Valid for next 30 days at Patia branch",
            }
        ],
    },
    {
        "vendor_name": "Blinkit Dark Store (Patia Hub)",
        "category": "Quick Commerce",
        "description": "10-minute grocery delivery across Patia & Infocity",
        "city": "Bhubaneswar",
        "area": "Patia",
        "lat": 20.3550,
        "lng": 85.8180,
        "coupon_templates": [
            {
                "offer_type": "percent_off",
                "value": Decimal("20"),
                "min_spend": Decimal("299"),
                "description": "20% OFF on all grocery staples",
                "validation": "Use code on Blinkit app for Patia delivery",
            }
        ],
    },
    {
        "vendor_name": "Cafe Coffee Day (Infocity Road)",
        "category": "Cafe & Beverages",
        "description": "Coffee, beverages, and snacks near Infocity gate",
        "city": "Bhubaneswar",
        "area": "Infocity",
        "lat": 20.3570,
        "lng": 85.8150,
        "coupon_templates": [
            {
                "offer_type": "min_spend_gift",
                "value": Decimal("0"),
                "min_spend": Decimal("249"),
                "description": "Free Cappuccino on orders above ₹249",
                "validation": "Present WhatsApp voucher at billing counter",
            }
        ],
    },
]

for v in bhubaneswar_vendors:
    item = create_vendor(
        vendor_name=v["vendor_name"],
        category=v["category"],
        description=v["description"],
        city=v["city"],
        area=v["area"],
        lat=v["lat"],
        lng=v["lng"],
        coupon_templates=v["coupon_templates"],
    )
    print(f"  🏪 Registered: {v['vendor_name']} in {v['area']}, {v['city']}")

print("\n" + "=" * 70)
print("  🎯 SYSTEM IS 100% READY FOR BHUBANESWAR LIVE JUDGE DEMONSTRATION!")
print("=" * 70)
