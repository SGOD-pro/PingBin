#!/usr/bin/env python3
"""Seed 2 Bhubaneswar reports for live dashboard visualization."""

import sys
import os
import time
from decimal import Decimal

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend/src")))

from utils.dynamo import reports_table, workers_table

now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

# 1. Active Assigned Incident near KIIT Square, Patia
rep1 = {
    "report_id": "rep-patia-01",
    "citizen_phone": "+919084686979",
    "worker_phone": "+919263405367",
    "worker_phones": ["+919263405367"],
    "assigned_workers_count": 1,
    "status": "assigned",
    "waste_type": "mixed",
    "fill_percent": 85,
    "urgency": "high",
    "priority_score": Decimal("51.0"),
    "estimated_minutes_to_clean": Decimal("30"),
    "original_estimated_minutes": Decimal("30"),
    "adjusted_estimated_minutes": Decimal("30"),
    "recalculated_estimated_time": Decimal("30"),
    "photo_before_url": "http://localhost:8000/images/dustbins-india-T5BHA9.jpg",
    "location_before": {"lat": Decimal("20.3533"), "lng": Decimal("85.8197")},
    "created_at": now_iso,
    "started_at": now_iso,
}

# 2. Needs Review Anomaly Incident near Infocity
rep2 = {
    "report_id": "rep-infocity-02",
    "citizen_phone": "+919084686979",
    "worker_phone": "+919382122857",
    "worker_phones": ["+919382122857"],
    "assigned_workers_count": 1,
    "status": "needs_review",
    "waste_type": "plastic",
    "fill_percent": 90,
    "urgency": "high",
    "priority_score": Decimal("68.5"),
    "estimated_minutes_to_clean": Decimal("45"),
    "original_estimated_minutes": Decimal("45"),
    "truth_score": Decimal("22.0"),
    "review_reason": "Gate B failed: actual cleanup duration 10 min < 50% of estimated 45 min",
    "failed_gates": ["gate_b_truth"],
    "photo_before_url": "http://localhost:8000/images/mumbai-september-24-piles-garbage-600w-2238569423.webp",
    "photo_after_url": "http://localhost:8000/images/new-delhi-india-may-8-260nw-1974738929.webp",
    "location_before": {"lat": Decimal("20.3540"), "lng": Decimal("85.8200")},
    "location_after": {"lat": Decimal("20.3540"), "lng": Decimal("85.8200")},
    "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 3600)),
    "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 3000)),
    "finished_at": now_iso,
}

if reports_table:
    reports_table.put_item(Item=rep1)
    reports_table.put_item(Item=rep2)
    print("✅ Seeded 2 demo reports into DynamoDB:")
    print("   1. rep-patia-01: [assigned] @ Patia / KIIT (Priority: 51.0)")
    print("   2. rep-infocity-02: [needs_review] @ Infocity (Truth Score: 22.0% - Gate B Anomaly)")
