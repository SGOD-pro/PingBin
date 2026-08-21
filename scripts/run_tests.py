import ast
import json
import time
from urllib.parse import urlencode
import boto3
import requests

BASE_URL = "http://localhost:8000"
AWS_PROFILE = "aws"
AWS_REGION = "ap-south-1"

session = boto3.Session(profile_name=AWS_PROFILE, region_name=AWS_REGION)
dynamodb = session.client("dynamodb")
sqs = session.client("sqs")
s3 = session.client("s3")


def log_result(test_name: str, passed: bool, details: str = ""):
    icon = "✅ PASS" if passed else "❌ FAIL"
    print(f"{icon} | {test_name} {f'({details})' if details else ''}")


def run_phase_1():
    print("\n" + "=" * 60)
    print("PHASE 1 TESTS: Infrastructure Setup")
    print("=" * 60)

    # 1. DynamoDB Reports
    try:
        r = dynamodb.describe_table(TableName="Reports")
        status = r["Table"]["TableStatus"]
        log_result("DynamoDB Reports Table", status == "ACTIVE", f"Status: {status}")
    except Exception as e:
        log_result("DynamoDB Reports Table", False, str(e))

    # 2. DynamoDB Workers
    try:
        r = dynamodb.describe_table(TableName="Workers")
        status = r["Table"]["TableStatus"]
        log_result("DynamoDB Workers Table", status == "ACTIVE", f"Status: {status}")
    except Exception as e:
        log_result("DynamoDB Workers Table", False, str(e))

    # 3. SQS Queue
    try:
        r = sqs.get_queue_url(QueueName="cleanloop-messages")
        url = r.get("QueueUrl", "")
        log_result("SQS Queue cleanloop-messages", bool(url), f"URL: {url}")
    except Exception as e:
        log_result("SQS Queue cleanloop-messages", False, str(e))

    # 4. S3 Bucket
    try:
        s3.head_bucket(Bucket="cleanloop-images-ap-south-1")
        log_result("S3 Bucket cleanloop-images-ap-south-1", True, "Accessible")
    except Exception as e:
        log_result("S3 Bucket cleanloop-images-ap-south-1", False, str(e))

    # 5. Webhook Server Health
    try:
        res = requests.get(f"{BASE_URL}/health", timeout=5)
        log_result("Backend Server /health Endpoint", res.status_code == 200, f"HTTP {res.status_code}")
    except Exception as e:
        log_result("Backend Server /health Endpoint", False, str(e))


def run_phase_2():
    print("\n" + "=" * 60)
    print("PHASE 2 TESTS: Lambda 1 — Webhook Receiver (<500ms)")
    print("=" * 60)

    # Test 1: Photo webhook
    t0 = time.time()
    res1 = requests.post(
        f"{BASE_URL}/webhook",
        data={
            "From": "whatsapp:+919876543210",
            "MediaUrl0": "https://images.unsplash.com/photo-1530587191325-3db32d826c18",
            "MediaContentType0": "image/jpeg",
            "Body": "",
        },
        timeout=5,
    )
    t1 = time.time() - t0
    log_result(
        "Photo Webhook Fast Return",
        res1.status_code == 200 and t1 < 0.5,
        f"HTTP {res1.status_code}, Latency: {t1 * 1000:.1f}ms",
    )

    # Test 2: Location webhook
    t0 = time.time()
    res2 = requests.post(
        f"{BASE_URL}/webhook",
        data={
            "From": "whatsapp:+919876543210",
            "Latitude": "12.9716",
            "Longitude": "77.5946",
            "Body": "",
        },
        timeout=5,
    )
    t2 = time.time() - t0
    log_result(
        "Location Webhook Fast Return",
        res2.status_code == 200 and t2 < 0.5,
        f"HTTP {res2.status_code}, Latency: {t2 * 1000:.1f}ms",
    )

    # Test 3: Text webhook
    t0 = time.time()
    res3 = requests.post(
        f"{BASE_URL}/webhook",
        data={"From": "whatsapp:+919876543210", "Body": "START"},
        timeout=5,
    )
    t3 = time.time() - t0
    log_result(
        "Text Webhook Fast Return",
        res3.status_code == 200 and t3 < 0.5,
        f"HTTP {res3.status_code}, Latency: {t3 * 1000:.1f}ms",
    )


def run_phase_3():
    print("\n" + "=" * 60)
    print("PHASE 3 TESTS: Lambda 2 — The Processor & Core Loop")
    print("=" * 60)

    # Test GET /reports
    try:
        res = requests.get(f"{BASE_URL}/reports", timeout=5)
        reports = res.json()
        log_result(
            "GET /reports Dashboard Endpoint",
            res.status_code == 200 and isinstance(reports, list),
            f"Returned {len(reports)} active reports",
        )
    except Exception as e:
        log_result("GET /reports Dashboard Endpoint", False, str(e))

    # Test End-to-End Simulation Flow
    test_phone = "+919876500001"
    worker_phone = "+919876543210"

    # Step 1: Photo Intake
    try:
        r1 = requests.post(
            f"{BASE_URL}/dev/simulate-message",
            json={
                "sender_phone": test_phone,
                "message_type": "photo",
                "media_url": "https://images.unsplash.com/photo-1530587191325-3db32d826c18",
            },
            timeout=10,
        )
        log_result("Processor Step 1: Photo Intake & Score", r1.status_code == 200)
    except Exception as e:
        log_result("Processor Step 1: Photo Intake & Score", False, str(e))

    # Step 2: Location Correlation & Dispatch
    try:
        r2 = requests.post(
            f"{BASE_URL}/dev/simulate-message",
            json={
                "sender_phone": test_phone,
                "message_type": "location",
                "latitude": 12.9716,
                "longitude": 77.5946,
            },
            timeout=10,
        )
        log_result("Processor Step 2: Location Correlation & Dispatch", r2.status_code == 200)
    except Exception as e:
        log_result("Processor Step 2: Location Correlation & Dispatch", False, str(e))

    # Step 3: Worker START
    try:
        r3 = requests.post(
            f"{BASE_URL}/dev/simulate-message",
            json={
                "sender_phone": worker_phone,
                "message_type": "text",
                "body_text": "START",
            },
            timeout=10,
        )
        log_result("Processor Step 3: Worker START", r3.status_code == 200)
    except Exception as e:
        log_result("Processor Step 3: Worker START", False, str(e))

    # Step 4: Worker DONE + Verification
    try:
        r4 = requests.post(
            f"{BASE_URL}/dev/simulate-message",
            json={
                "sender_phone": worker_phone,
                "message_type": "text",
                "body_text": "DONE",
                "latitude": 12.9716,
                "longitude": 77.5946,
            },
            timeout=10,
        )
        log_result("Processor Step 4: Worker DONE & Verification", r4.status_code == 200)
    except Exception as e:
        log_result("Processor Step 4: Worker DONE & Verification", False, str(e))


def run_phase_4():
    print("\n" + "=" * 60)
    print("PHASE 4 TESTS: Frontend Dashboard")
    print("=" * 60)

    try:
        res = requests.get("http://localhost:5173", timeout=5)
        log_result(
            "Frontend Dev Server Live",
            res.status_code == 200,
            f"HTTP {res.status_code} at http://localhost:5173",
        )
    except Exception as e:
        log_result("Frontend Dev Server Live", False, str(e))


def run_phase_5():
    print("\n" + "=" * 60)
    print("PHASE 5 TESTS: Seed Data in DynamoDB")
    print("=" * 60)

    try:
        r_rep = dynamodb.scan(TableName="Reports", Select="COUNT")
        rep_count = r_rep.get("Count", 0)
        log_result("Reports Table Seeded Count", rep_count >= 50, f"Total records: {rep_count}")
    except Exception as e:
        log_result("Reports Table Seeded Count", False, str(e))

    try:
        r_w = dynamodb.scan(TableName="Workers", Select="COUNT")
        w_count = r_w.get("Count", 0)
        log_result("Workers Table Seeded Count", w_count >= 3, f"Total workers: {w_count}")
    except Exception as e:
        log_result("Workers Table Seeded Count", False, str(e))


def run_phase_6():
    print("\n" + "=" * 60)
    print("PHASE 6 TESTS: Module Isolation")
    print("=" * 60)

    # Module 1: Priority Engine
    try:
        import sys
        sys.path.append("modules/priority-engine")
        from engine import score_reports

        m1_res = score_reports([
            {"id": "r1", "factors": {"overflow": 90, "waiting_time": 50}},
            {"id": "r2", "factors": {"overflow": 30, "waiting_time": 10}},
        ])
        log_result(
            "Module 1 (Priority Engine) Execution",
            len(m1_res) == 2 and m1_res[0]["id"] == "r1",
            f"Rank 1: {m1_res[0]['id']} (Score: {m1_res[0]['score']})",
        )
    except Exception as e:
        log_result("Module 1 (Priority Engine) Execution", False, str(e))

    # Check Module 1 & 2 AST cleanliness (no forbidden terms in interface)
    with open("modules/priority-engine/engine.py") as f:
        code1 = f.read().lower()
        forbidden = ["waste", "citizen", "garbage", "trash", "twilio", "whatsapp"]
        found = [w for w in forbidden if w in code1]
        log_result("Module 1 Domain Term Isolation", len(found) == 0, f"Forbidden matches: {found}")

    with open("modules/image-classifier/classifier.py") as f:
        tree = ast.parse(f.read())
        func_names = [n.name for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)]
        log_result(
            "Module 2 (Image Classifier) AST Cleanliness",
            "classify_image" in func_names,
            f"Public function: {func_names}",
        )

    with open("modules/whatsapp-intake/handler.py") as f:
        tree = ast.parse(f.read())
        func_names = [n.name for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)]
        log_result(
            "Module 3 (WhatsApp Intake) AST Cleanliness",
            "handle_webhook" in func_names,
            f"Public function: {func_names}",
        )


def run_phase_8():
    print("\n" + "=" * 60)
    print("PHASE 8 TESTS: Cleanliness, Git, & File Contracts")
    print("=" * 60)

    import os
    import glob

    req_txt = glob.glob("**/requirements.txt", recursive=True)
    log_result("No requirements.txt Allowed", len(req_txt) == 0, f"Matches: {req_txt}")

    with open(".gitignore") as f:
        gi = f.read()
        log_result(".env Gitignored", ".env" in gi)


if __name__ == "__main__":
    print("\n🚀 EXECUTING COMPLETE CLEANLOOP TEST SUITE\n")
    run_phase_1()
    run_phase_2()
    run_phase_3()
    run_phase_4()
    run_phase_5()
    run_phase_6()
    run_phase_8()
    print("\n" + "=" * 60)
    print("ALL TESTS COMPLETED")
    print("=" * 60 + "\n")
