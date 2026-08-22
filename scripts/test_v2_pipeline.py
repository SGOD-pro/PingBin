"""V2 Pipeline Automated Verification Suite with Zero Twilio API Calls.

Mocks WhatsApp notifications and media downloads to strictly test:
1. Clear valid waste photo -> confidence >= 25 -> normal scoring + dispatch.
2. Ambiguous photo -> confidence < 25 -> status = pending_admin_review -> NO priority_score -> NO dispatch.
3. Reject endpoint -> status = rejected.
4. Approve endpoint -> scores priority + dispatches.
5. Resolved report -> runs categorize_for_recycling on after-photo -> warehouse assigned + weight/revenue math verified.
6. Hazardous category -> correctly routed to Mancheswar Hazmat unit.
"""

import os
import sys
import uuid
from decimal import Decimal
from datetime import datetime, timezone

# Add backend/src to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend/src")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../modules/recycling-categorizer")))

import processor
from utils.dynamo import (
    get_report_by_id,
    save_raw_pending_report,
    update_report_location,
    set_report_pending_admin_review,
    reject_report,
    approve_report,
    get_all_warehouses,
    _DEFAULT_WAREHOUSES,
)

# ---------------------------------------------------------------------------
# Zero-Twilio Mocks
# ---------------------------------------------------------------------------
outbound_messages = []

def mock_send_whatsapp(to_phone: str, body: str) -> None:
    outbound_messages.append({"to": to_phone, "body": body})
    preview = body.replace("\n", " ")[:70]
    print(f"    📱 [MOCK WHATSAPP OUTBOUND] to={to_phone} msg='{preview}...'")

processor.send_whatsapp = mock_send_whatsapp
processor.download_twilio_media = lambda url: b"fake-jpeg-bytes"
processor._upload_photo = lambda img_bytes, s3_key, fallback: fallback or "https://cleanloop-images-ap-south-1.s3.ap-south-1.amazonaws.com/test.jpg"


def run_v2_verification():
    print("=" * 70)
    print("🚀 STARTING V2 SAFETY GATE & RECYCLING PIPELINE VERIFICATION SUITE")
    print("   (Twilio API calls completely mocked — zero rate limits/charges)")
    print("=" * 70)

    # -----------------------------------------------------------------------
    # TEST 1: Clear Valid Waste Photo (High Confidence >= 25)
    # -----------------------------------------------------------------------
    print("\n[TEST 1] Testing Valid Report with High Confidence (>= 25)...")
    msg_valid = {
        "message_type": "photo",
        "sender_phone": "+919084686979",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "media_url": "https://pingbin-images/before.jpg",
    }
    # Mock classify_image_base64 to return confidence 88
    original_classify = processor.classify_image_base64
    processor.classify_image_base64 = lambda img, fmt="jpeg": {
        "is_valid_report": True,
        "waste_type": "plastic",
        "fill_percent": 80,
        "urgency": "high",
        "estimated_workers_needed": 1,
        "estimated_minutes_to_clean": 20,
        "confidence": 88,
        "suspicious_flag": False,
        "segregation_quality": "mixed",
        "notes": "Large pile of plastic bottles overflowing from municipal bin.",
    }

    report_id_1 = processor.handle_photo(msg_valid)
    rep1 = get_report_by_id(report_id_1)
    
    assert rep1 is not None, "Report 1 not saved in DB"
    assert rep1["status"] == "awaiting_location", f"Expected status 'awaiting_location', got '{rep1.get('status')}'"
    assert rep1.get("confidence") == 88, f"Expected confidence 88, got {rep1.get('confidence')}"

    # Send Location to complete intake and trigger priority calculation
    processor.handle_location({
        "sender_phone": "+919084686979",
        "latitude": 20.3533,
        "longitude": 85.8197,
    })
    rep1_after = get_report_by_id(report_id_1)
    assert rep1_after["status"] in ["pending", "assigned"], f"Expected status 'pending'/'assigned', got '{rep1_after.get('status')}'"
    assert rep1_after.get("priority_score") is not None and float(rep1_after["priority_score"]) > 0, "Priority score must be computed for confidence >= 25"
    print(f" -> ✅ PASSED! Report {report_id_1[:8]} completed with status='{rep1_after['status']}', confidence={rep1_after['confidence']}%, priority_score={rep1_after['priority_score']}")

    # -----------------------------------------------------------------------
    # TEST 2: Ambiguous / Low-Confidence Photo (< 25)
    # -----------------------------------------------------------------------
    print("\n[TEST 2] Testing Ambiguous Photo with Low Confidence (< 25)...")
    msg_low_conf = {
        "message_type": "photo",
        "sender_phone": "+919084686979",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "media_url": "https://pingbin-images/blurry_dark.jpg",
    }
    processor.classify_image_base64 = lambda img, fmt="jpeg": {
        "is_valid_report": True,
        "waste_type": "mixed",
        "fill_percent": 30,
        "urgency": "low",
        "estimated_workers_needed": 1,
        "estimated_minutes_to_clean": 15,
        "confidence": 18,  # Below 25 gate
        "suspicious_flag": True,
        "segregation_quality": "improper",
        "notes": "Blurry low-light image with ambiguous objects.",
    }

    report_id_2 = processor.handle_photo(msg_low_conf)
    rep2 = get_report_by_id(report_id_2)

    assert rep2 is not None, "Report 2 not saved in DB"
    assert rep2["status"] == "pending_admin_review", f"Expected 'pending_admin_review', got '{rep2.get('status')}'"
    assert rep2.get("confidence") == 18, f"Expected confidence 18, got {rep2.get('confidence')}"
    assert rep2.get("priority_score") is None, f"Expected priority_score to be None, got {rep2.get('priority_score')}"
    assert rep2.get("worker_phone") is None, f"Expected 0 workers dispatched, got {rep2.get('worker_phone')}"
    print(f" -> ✅ PASSED! Report {report_id_2[:8]} routed to status='{rep2['status']}', confidence={rep2['confidence']}%, priority_score={rep2.get('priority_score')}, workers=0")

    # -----------------------------------------------------------------------
    # TEST 3: Reject Action on Low-Confidence Report
    # -----------------------------------------------------------------------
    print("\n[TEST 3] Testing POST /reports/{id}/reject...")
    reject_res = processor.lambda_handler({
        "httpMethod": "POST",
        "path": f"/reports/{report_id_2}/reject",
    })
    assert reject_res["statusCode"] == 200, f"Reject failed: {reject_res}"
    rep2_rejected = get_report_by_id(report_id_2)
    assert rep2_rejected["status"] == "rejected", f"Expected 'rejected', got '{rep2_rejected.get('status')}'"
    assert rep2_rejected.get("rejected_at") is not None, "Expected rejected_at timestamp"
    print(f" -> ✅ PASSED! Report {report_id_2[:8]} status='{rep2_rejected['status']}', rejected_at='{rep2_rejected.get('rejected_at')}'")

    # -----------------------------------------------------------------------
    # TEST 4: Approve & Dispatch Action on Low-Confidence Report
    # -----------------------------------------------------------------------
    print("\n[TEST 4] Testing POST /reports/{id}/approve...")
    # Create another low-confidence report to approve
    report_id_3 = processor.handle_photo(msg_low_conf)
    update_report_location(report_id_3, 20.3533, 85.8197)
    
    approve_res = processor.lambda_handler({
        "httpMethod": "POST",
        "path": f"/reports/{report_id_3}/approve",
    })
    assert approve_res["statusCode"] == 200, f"Approve failed: {approve_res}"
    rep3_approved = get_report_by_id(report_id_3)
    assert rep3_approved["status"] in ["assigned", "pending"], f"Expected 'assigned' or 'pending', got '{rep3_approved.get('status')}'"
    assert rep3_approved.get("priority_score") is not None, "Priority score must be computed after approval"
    print(f" -> ✅ PASSED! Report {report_id_3[:8]} approved: status='{rep3_approved['status']}', priority_score={rep3_approved['priority_score']}, assigned_workers={rep3_approved.get('assigned_workers_count')}")

    # -----------------------------------------------------------------------
    # TEST 5: Resolved Report -> Recycling Categorizer & Warehouse Revenue
    # -----------------------------------------------------------------------
    print("\n[TEST 5] Testing Post-Resolution Recycling Categorization & Warehouse Assignment...")
    report_id_4 = str(uuid.uuid4())
    save_raw_pending_report(report_id_4, "+919084686979", datetime.now(timezone.utc).isoformat())
    update_report_location(report_id_4, 20.3533, 85.8197) # Patia area
    
    # Mock recycling categorizer call
    processor.categorize_for_recycling = lambda img, fmt="jpeg": {
        "recycling_category": "plastic",
        "purity_score": 90,
        "notes": "Sorted clean PET bottles.",
    }
    
    rep4 = get_report_by_id(report_id_4)
    rep4["fill_percent"] = Decimal("70")
    rep4["waste_type"] = "plastic"
    
    # Run warehouse assignment
    res_wh = processor._process_warehouse_and_revenue(
        report_id=report_id_4,
        report=rep4,
        finish_photo_url="https://pingbin-images/after_clean.jpg",
        finish_location={"lat": Decimal("20.3533"), "lng": Decimal("85.8197")},
    )
    
    rep4_updated = get_report_by_id(report_id_4)
    
    # Weight: 70 * 0.5 = 35.0 kg
    # Revenue: 35.0 kg * 8.0 (plastic) * (90 / 100) = 252.00 INR
    expected_weight = 35.0
    expected_rev = 252.00
    
    assert rep4_updated.get("recycling_category") == "plastic", f"Expected category 'plastic', got '{rep4_updated.get('recycling_category')}'"
    assert rep4_updated.get("assigned_warehouse_id") == "wh-patia-plastic", f"Expected 'wh-patia-plastic', got '{rep4_updated.get('assigned_warehouse_id')}'"
    assert float(rep4_updated.get("estimated_weight_kg", 0)) == expected_weight, f"Expected weight {expected_weight}, got {rep4_updated.get('estimated_weight_kg')}"
    assert float(rep4_updated.get("estimated_revenue", 0)) == expected_rev, f"Expected revenue {expected_rev}, got {rep4_updated.get('estimated_revenue')}"
    assert rep4_updated.get("warehouse_status") == "pending_pickup", f"Expected 'pending_pickup', got '{rep4_updated.get('warehouse_status')}'"
    
    print(f" -> ✅ PASSED! Report {report_id_4[:8]} assigned to '{rep4_updated.get('assigned_warehouse_name')}': category='{rep4_updated['recycling_category']}', purity={rep4_updated['purity_score']}%, weight={rep4_updated['estimated_weight_kg']}kg, rev=₹{rep4_updated['estimated_revenue']}, status='{rep4_updated['warehouse_status']}'")

    # -----------------------------------------------------------------------
    # TEST 6: Hazardous Waste Category Routing
    # -----------------------------------------------------------------------
    print("\n[TEST 6] Testing Hazardous Waste Category Routing...")
    report_id_5 = str(uuid.uuid4())
    save_raw_pending_report(report_id_5, "+919084686979", datetime.now(timezone.utc).isoformat())
    update_report_location(report_id_5, 20.3200, 85.8450) # Mancheswar area
    
    processor.categorize_for_recycling = lambda img, fmt="jpeg": {
        "recycling_category": "hazardous",
        "purity_score": 100,
        "notes": "Medical and chemical discarded containers.",
    }
    
    rep5 = get_report_by_id(report_id_5)
    rep5["fill_percent"] = Decimal("40")
    rep5["waste_type"] = "hazardous"
    
    res_haz = processor._process_warehouse_and_revenue(
        report_id=report_id_5,
        report=rep5,
        finish_photo_url="https://pingbin-images/after_haz.jpg",
        finish_location={"lat": Decimal("20.3200"), "lng": Decimal("85.8450")},
    )
    
    rep5_updated = get_report_by_id(report_id_5)
    assert rep5_updated.get("recycling_category") == "hazardous"
    assert rep5_updated.get("assigned_warehouse_id") == "wh-mancheswar-hazmat", f"Expected 'wh-mancheswar-hazmat', got '{rep5_updated.get('assigned_warehouse_id')}'"
    print(f" -> ✅ PASSED! Hazardous Report {report_id_5[:8]} correctly routed to '{rep5_updated.get('assigned_warehouse_name')}' (ID: {rep5_updated.get('assigned_warehouse_id')})")

    # Restore original classify function
    processor.classify_image_base64 = original_classify

    print("\n" + "=" * 70)
    print("🎉 ALL 6 V2 PIPELINE INTEGRATION TESTS PASSED (100% SUCCESS)")
    print("=" * 70)

if __name__ == "__main__":
    run_v2_verification()
