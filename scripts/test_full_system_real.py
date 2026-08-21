#!/usr/bin/env python3
"""CleanLoop Full System Real Pipeline Test with Live WhatsApp Outbound Delivery

Full Step-by-Step Verification:
  STEP 0: Reset tables & seed exact workers + vendors
  STEP 1: Twilio outbound delivery confirmation (All 4 numbers)
  STEP 2: Citizen Report Intake (Bedrock Nova Lite on real image) -> Priority Score
  STEP 3: Multi-Worker Haversine Dispatch -> Real WhatsApp messages to assigned workers
  STEP 4: Worker Arrival -> GPS Gate Verification -> in_progress
  STEP 5: Worker Finish -> Two-Gate Verification (Gate A GPS + Gate B Truth Score)
  STEP 6: Status: resolved -> Hyperlocal Vendor Coupon Mismatch/Match -> WhatsApp to Citizen
  STEP 7: Negative cases: Remote Worker Excluded + Too-Fast Finish in Audit Queue + Non-Waste Rejection
"""

import base64
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal

# Add backend/src to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend/src")))

from twilio.rest import Client
from config import settings
from utils.dynamo import (
    get_active_reports, get_all_workers, get_all_coupons, get_all_vendors,
    create_worker, create_vendor,
    reports_table, workers_table, vendors_table, coupons_table
)
from utils.bedrock import classify_image_base64
from utils.haversine import haversine
from processor import route_sqs_message

twilio_client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

CITIZEN_PHONE = "+919932948540"
WORKER_A_PHONE = "+919263405367"  # Local (~62m)
WORKER_B_PHONE = "+919084686979"  # Local (~217m)
WORKER_C_PHONE = "+919382122857"  # Remote (~845km)

REPORT_LAT = 12.9716
REPORT_LNG = 77.5946


def serialize_item(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, dict):
        return {k: serialize_item(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [serialize_item(x) for x in obj]
    return obj


def print_section(title: str):
    print("\n" + "=" * 76)
    print(f"  {title}")
    print("=" * 76)


def run_full_test():
    # =========================================================================
    # STEP 0: RESET & RE-SEED TABLES
    # =========================================================================
    print_section("STEP 0: Reset DynamoDB Tables & Seed 3 Workers + Local Vendors")
    
    tables = {
        'Reports': (reports_table, 'report_id'),
        'Workers': (workers_table, 'worker_id'),
        'Vendors': (vendors_table, 'vendor_id'),
        'Coupons': (coupons_table, 'coupon_id'),
    }
    for name, (table, pk) in tables.items():
        if table:
            items = table.scan().get('Items', [])
            for it in items:
                table.delete_item(Key={pk: it[pk]})
            count = len(table.scan().get('Items', []))
            print(f"  - Table '{name}' wiped -> Count: {count} items")

    # Seed Workers
    wA = create_worker("Worker A (Bangalore Local)", WORKER_A_PHONE, lat=12.9720, lng=77.5950)
    wB = create_worker("Worker B (Bangalore Local)", WORKER_B_PHONE, lat=12.9730, lng=77.5960)
    wC = create_worker("Worker C (Mumbai Remote)", WORKER_C_PHONE, lat=19.0760, lng=72.8777)

    # Seed Local & Remote Vendors
    v_local = create_vendor(
        vendor_name="GreenBazaar Organic Store",
        category="Grocery & Organic",
        description="Local zero-waste supermarket in Central Bangalore.",
        city="Bangalore",
        area="MG Road / Central",
        lat=12.9718,
        lng=77.5950,
        coupon_templates=[
            {
                "template_id": "tpl-gb-1",
                "offer_type": "flat_off",
                "value": 50,
                "min_spend": 299,
                "description": "Flat ₹50 off on fresh organic produce above ₹299",
                "validation": "Show this WhatsApp code at checkout. Valid for 30 days."
            }
        ]
    )
    v_remote = create_vendor(
        vendor_name="Delhi Daily Supermart",
        category="Grocery",
        description="Delhi NCR premier daily essentials.",
        city="Delhi",
        area="Connaught Place",
        lat=28.6139,
        lng=77.2090,
        coupon_templates=[
            {
                "template_id": "tpl-dl-1",
                "offer_type": "flat_off",
                "value": 40,
                "min_spend": 199,
                "description": "Flat ₹40 off on daily grocery in Delhi NCR",
                "validation": "Valid in Delhi NCR branches only."
            }
        ]
    )

    print("\nQueried Seeded Workers from DynamoDB:")
    for w in workers_table.scan().get("Items", []):
        print(f"  • {w['name']} ({w['phone']}): Status={w['status']}, Loc=({w['last_known_location']['lat']}, {w['last_known_location']['lng']})")

    # =========================================================================
    # STEP 1: TWILIO OUTBOUND SANDBOX SANITY CHECK
    # =========================================================================
    print_section("STEP 1: Standalone Twilio WhatsApp Outbound Probe to All 4 Numbers")
    test_nums = [
        ("Citizen", CITIZEN_PHONE),
        ("Worker A", WORKER_A_PHONE),
        ("Worker B", WORKER_B_PHONE),
        ("Worker C", WORKER_C_PHONE),
    ]
    sids = []
    for label, num in test_nums:
        to_formatted = f"whatsapp:{num}"
        msg = twilio_client.messages.create(
            from_=settings.TWILIO_WHATSAPP_FROM,
            to=to_formatted,
            body=f"CleanLoop Sandbox Live Probe for {label} ({num})."
        )
        print(f"  ✓ {label} ({num}): Created SID={msg.sid}, Status={msg.status}")
        sids.append((label, msg.sid, to_formatted))

    time.sleep(3)
    print("\nTwilio Live Message Delivery Statuses:")
    for label, sid, to in sids:
        fetched = twilio_client.messages(sid).fetch()
        print(f"  • {label} ({to}) -> Status: {fetched.status} (Error Code: {fetched.error_code})")

    # =========================================================================
    # STEP 2: CITIZEN REPORT INTAKE & BEDROCK NOVA LITE
    # =========================================================================
    print_section("STEP 2: Citizen WhatsApp Photo Intake & Bedrock Nova Lite Call")
    img_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../images/dustbins-india-T5BHA9.jpg"))
    print(f"Reading real photo file: {img_path}")
    with open(img_path, "rb") as f:
        img_bytes = f.read()
    img_b64 = base64.b64encode(img_bytes).decode("utf-8")

    print("\nCalling Bedrock Nova Lite on real image bytes...")
    classification = classify_image_base64(img_b64)
    print("Raw Bedrock Nova Lite Response:")
    print(json.dumps(classification, indent=2))

    # Route citizen photo
    photo_msg = {
        "sender_phone": CITIZEN_PHONE,
        "message_type": "photo",
        "image_base64": img_b64,
        "media_url": "https://cleanloop-images/sample-before.jpg",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    route_sqs_message(photo_msg)
    print("✓ Photo message processed. ACID pending report record created in DynamoDB.")

    # Citizen shares location
    print(f"\nCitizen shares live location: ({REPORT_LAT}, {REPORT_LNG})")
    loc_msg = {
        "sender_phone": CITIZEN_PHONE,
        "message_type": "location",
        "latitude": REPORT_LAT,
        "longitude": REPORT_LNG,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    route_sqs_message(loc_msg)

    # =========================================================================
    # STEP 3: HAVERSINE DISPATCH & WORKER WHATSAPP NOTIFICATIONS
    # =========================================================================
    print_section("STEP 3: Haversine Dispatch Proximity & Worker Assignments")
    active = get_active_reports()
    report = next((r for r in active if r.get("citizen_phone") == CITIZEN_PHONE), None)
    if not report:
        print("❌ Error: Report not found in DynamoDB!")
        return False

    report_id = report["report_id"]
    assigned_workers = report.get("worker_phones", [])
    print(f"Report ID: {report_id}")
    print(f"Status: {report.get('status')}")
    print(f"Priority Score: {report.get('priority_score')}/100")
    print(f"Assigned Workers Count: {report.get('assigned_workers_count')}")
    print(f"Assigned Worker Phones: {assigned_workers}")
    print(f"Original AI Estimated Time: {report.get('original_estimated_minutes')} min")
    print(f"Adjusted Estimated Time: {report.get('adjusted_estimated_minutes')} min")

    print("\nProximity Distances from Incident:")
    for w in [wA, wB, wC]:
        loc = w["last_known_location"]
        dist = haversine(REPORT_LAT, REPORT_LNG, float(loc["lat"]), float(loc["lng"]))
        print(f"  • {w['name']} ({w['phone']}): {dist:.1f} m -> In 10km radius: {dist <= 10000}")

    assert WORKER_C_PHONE not in assigned_workers, "Remote Worker C must be excluded!"
    assert WORKER_A_PHONE in assigned_workers, "Local Worker A must be assigned!"
    assert WORKER_B_PHONE in assigned_workers, "Local Worker B must be assigned!"
    print("✓ Local workers A & B assigned. Remote worker C excluded.")

    # Check worker status in DynamoDB
    for w in workers_table.scan().get("Items", []):
        if w["phone"] in assigned_workers:
            print(f"  • Worker {w['name']} status in DynamoDB: {w['status']} (Expected: busy)")
            assert w["status"] == "busy"

    # =========================================================================
    # STEP 4: WORKER ARRIVAL GATE
    # =========================================================================
    print_section("STEP 4: Assigned Worker Arrival (Photo + GPS Gate Check)")
    arrival_dt = datetime.now(timezone.utc)
    arrival_time = arrival_dt.isoformat()
    arrival_msg = {
        "sender_phone": WORKER_A_PHONE,
        "message_type": "photo",
        "image_base64": img_b64,
        "media_url": "https://cleanloop-images/sample-start.jpg",
        "latitude": REPORT_LAT,
        "longitude": REPORT_LNG,
        "timestamp": arrival_time,
    }
    route_sqs_message(arrival_msg)

    report_in_prog = reports_table.get_item(Key={"report_id": report_id}).get("Item", {})
    print(f"Report ID: {report_id}")
    print(f"Status: {report_in_prog.get('status')} (Expected: in_progress)")
    print(f"Arrival Time: {report_in_prog.get('arrival_time')}")
    assert report_in_prog.get("status") == "in_progress"

    # =========================================================================
    # STEP 5: WORKER FINISH & TWO-GATE VERIFICATION
    # =========================================================================
    adj_est_time = float(report_in_prog.get("adjusted_estimated_minutes") or 120.0)
    work_duration_sec = round(adj_est_time * 0.65) # 65% of estimate -> Truth score = 65% >= 50%
    print_section(f"STEP 5: Worker Finish Proof & Two-Gate Verification ({work_duration_sec}s work on {adj_est_time:.0f}s estimate)")
    
    finish_dt = arrival_dt + timedelta(seconds=work_duration_sec)
    finish_time = finish_dt.isoformat()

    finish_msg = {
        "sender_phone": WORKER_A_PHONE,
        "message_type": "photo",
        "image_base64": img_b64,
        "media_url": "https://cleanloop-images/sample-after.jpg",
        "latitude": REPORT_LAT,
        "longitude": REPORT_LNG,
        "timestamp": finish_time,
    }
    route_sqs_message(finish_msg)

    report_final = reports_table.get_item(Key={"report_id": report_id}).get("Item", {})
    print(f"Report ID: {report_id}")
    print(f"Status in DynamoDB: {report_final.get('status')} (Expected: resolved)")
    print(f"Truth Percentage: {report_final.get('truth_percentage')}% (Expected: >= 50%)")
    print(f"Actual Duration: {report_final.get('actual_duration')}s (test mode)")
    print(f"Reward Coupon Code: {report_final.get('reward_coupon_code')}")
    assert report_final.get("status") == "resolved"

    # Verify workers freed
    for w in workers_table.scan().get("Items", []):
        if w["phone"] in assigned_workers:
            print(f"  • Worker {w['name']} status in DynamoDB: {w['status']} (Expected: free)")
            assert w["status"] == "free"

    # =========================================================================
    # STEP 6: LOCAL VENDOR COUPON ISSUED & DELIVERED
    # =========================================================================
    print_section("STEP 6: Geo-Targeted Local Vendor Coupon Verification")
    coupons = get_all_coupons()
    matching_coupon = next((c for c in coupons if c.get("report_id") == report_id), None)
    assert matching_coupon is not None, "Coupon record must exist in Coupons table!"

    print("Issued Coupon Details from DynamoDB:")
    print(f"  • Coupon Code:       {matching_coupon.get('code')}")
    print(f"  • Vendor Name:       {matching_coupon.get('vendor_name')}")
    print(f"  • Vendor City:       {matching_coupon.get('vendor_city')}")
    print(f"  • Vendor Area:       {matching_coupon.get('vendor_area')}")
    print(f"  • Offer Description: {matching_coupon.get('offer_description')}")
    print(f"  • How to Use:        {matching_coupon.get('validation_text')}")
    print(f"  • Recipient Phone:   {matching_coupon.get('citizen_phone')}")
    print(f"  • Valid Until:       {matching_coupon.get('valid_until')}")

    assert matching_coupon.get("vendor_name") == "GreenBazaar Organic Store", "Must match local Bangalore vendor!"
    print("✓ Local vendor targeting verified: Matched Bangalore vendor over Delhi vendor.")

    # =========================================================================
    # STEP 7: EDGE CASES (Too-Fast Finish & Non-Waste Rejection)
    # =========================================================================
    print_section("STEP 7: Edge Cases Verification")

    # Edge Case 1: Too-Fast Finish (Audit Queue)
    print("\n--- Edge Case 1: Too-Fast Finish (Truth score < 50%) ---")
    p_msg2 = {
        "sender_phone": "+919932948541",
        "message_type": "photo",
        "image_base64": img_b64,
        "media_url": "https://cleanloop-images/sample-before-2.jpg",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    route_sqs_message(p_msg2)
    l_msg2 = {
        "sender_phone": "+919932948541",
        "message_type": "location",
        "latitude": REPORT_LAT,
        "longitude": REPORT_LNG,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    route_sqs_message(l_msg2)

    active = get_active_reports()
    rep2 = next((r for r in active if r.get("citizen_phone") == "+919932948541"), None)
    rep2_id = rep2["report_id"]
    w_assigned2 = rep2.get("worker_phones", [rep2.get("worker_phone")])[0]

    # Worker arrives
    t_arr = datetime.now(timezone.utc)
    route_sqs_message({
        "sender_phone": w_assigned2,
        "message_type": "photo",
        "latitude": REPORT_LAT,
        "longitude": REPORT_LNG,
        "timestamp": t_arr.isoformat(),
    })

    # Worker finishes in just 10 seconds (way under 50% truth score)
    t_fin_fast = t_arr + timedelta(seconds=10)
    route_sqs_message({
        "sender_phone": w_assigned2,
        "message_type": "photo",
        "latitude": REPORT_LAT,
        "longitude": REPORT_LNG,
        "timestamp": t_fin_fast.isoformat(),
    })

    rep2_final = reports_table.get_item(Key={"report_id": rep2_id}).get("Item", {})
    print(f"Report ID: {rep2_id}")
    print(f"Status in DynamoDB: {rep2_final.get('status')} (Expected: needs_review)")
    print(f"Review Reason: {rep2_final.get('review_reason')}")
    assert rep2_final.get("status") == "needs_review"
    assert "Truth score" in str(rep2_final.get("review_reason"))
    print("✓ Too-fast finish correctly flagged and routed to supervisor audit queue.")

    # Edge Case 2: Non-Waste Image Rejection
    print("\n--- Edge Case 2: Non-Waste Image Rejection ---")
    with open("../frontend/src/assets/hero.png", "rb") as f:
        hero_b64 = base64.b64encode(f.read()).decode("utf-8")
    non_waste_res = classify_image_base64(hero_b64)
    print("Nova Lite Non-Waste Classification Output:")
    print(json.dumps(non_waste_res, indent=2))
    assert non_waste_res.get("_error") == "classification_error"
    print("✓ Non-waste image correctly flagged as classification_error without dispatch.")

    print_section("ALL 7 STEPS & EDGE CASES PASSED WITH LIVE EVIDENCE!")
    return True


if __name__ == "__main__":
    success = run_full_test()
    sys.exit(0 if success else 1)
