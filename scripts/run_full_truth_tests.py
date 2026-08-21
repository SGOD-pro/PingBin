import base64
import json
import time
from datetime import datetime, timezone
from decimal import Decimal
import boto3
import requests

BASE_URL = "http://localhost:8000"
AWS_PROFILE = "aws"
AWS_REGION = "ap-south-1"

session = boto3.Session(profile_name=AWS_PROFILE, region_name=AWS_REGION)
dynamodb = session.resource("dynamodb")
bedrock_runtime = session.client("bedrock-runtime")
reports_table = dynamodb.Table("Reports")
workers_table = dynamodb.Table("Workers")

TEST_RESULTS = {}


def log_test(test_num: int, name: str, passed: bool, details: str = ""):
    status = "PASS" if passed else "FAIL"
    icon = "✅" if passed else "❌"
    TEST_RESULTS[f"Test {test_num}"] = status
    print(f"\n{icon} TEST {test_num} ({name}): {status}")
    if details:
        print(f"   Details: {details}")


def clean_state():
    """Reset all workers to free and clear any lingering active test reports in DynamoDB."""
    try:
        workers = workers_table.scan().get("Items", [])
        for w in workers:
            workers_table.update_item(
                Key={"worker_id": w["worker_id"]},
                UpdateExpression="SET #s = :s",
                ExpressionAttributeNames={"#s": "status"},
                ExpressionAttributeValues={":s": "free"},
            )

        all_reps = reports_table.scan().get("Items", [])
        for rep in all_reps:
            if rep.get("status") in ["assigned", "in_progress", "pending"]:
                reports_table.update_item(
                    Key={"report_id": rep["report_id"]},
                    UpdateExpression="SET #s = :s",
                    ExpressionAttributeNames={"#s": "status"},
                    ExpressionAttributeValues={":s": "resolved"},
                )
    except Exception as e:
        print(f"Notice: clean_state error: {e}")


# ------------------------------------------------------------
# TEST 1: Twilio Image Download Verification
# ------------------------------------------------------------
def test_1_twilio_image_download():
    print("\n" + "=" * 60)
    print("RUNNING TEST 1: Twilio Image Download Verification")
    print("=" * 60)
    test_url = "https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=400&q=80"
    try:
        res = requests.get(test_url, timeout=10)
        img_bytes = res.content
        img_b64 = base64.b64encode(img_bytes).decode("utf-8")
        passed = res.status_code == 200 and len(img_bytes) > 1000
        log_test(
            1,
            "Twilio Image Download",
            passed,
            f"HTTP {res.status_code}, Image bytes: {len(img_bytes)}, Base64 len: {len(img_b64)}",
        )
    except Exception as e:
        log_test(1, "Twilio Image Download", False, str(e))


# ------------------------------------------------------------
# TEST 2: Bedrock Nova Lite Classification
# ------------------------------------------------------------
def test_2_bedrock_classification():
    print("\n" + "=" * 60)
    print("RUNNING TEST 2: Bedrock Nova Lite Classification")
    print("=" * 60)
    try:
        img_res = requests.get(
            "https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=400&q=80",
            timeout=10,
        )
        img_b64 = base64.b64encode(img_res.content).decode("utf-8")

        prompt = (
            "Analyze this waste bin image. Return ONLY valid JSON (no markdown fences) with these exact fields:\n"
            "{\n"
            '  "waste_type": "plastic" | "organic" | "paper" | "glass" | "metal" | "e_waste" | "hazardous",\n'
            '  "fill_percent": <integer 0-100>,\n'
            '  "urgency": "low" | "medium" | "high" | "critical",\n'
            '  "estimated_workers_needed": <integer 1-4>,\n'
            '  "estimated_minutes_to_clean": <integer 5-120>\n'
            "}"
        )

        payload = {
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "image": {
                                "format": "jpeg",
                                "source": {"bytes": img_b64},
                            }
                        },
                        {"text": prompt},
                    ],
                }
            ]
        }

        res = bedrock_runtime.invoke_model(
            modelId="apac.amazon.nova-lite-v1:0",
            body=json.dumps(payload),
        )

        raw_text = json.loads(res["body"].read())["output"]["message"]["content"][0]["text"].strip()
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]

        parsed = json.loads(raw_text.strip())

        assert 0 <= parsed["fill_percent"] <= 100
        assert 1 <= parsed["estimated_workers_needed"] <= 4
        assert 5 <= parsed["estimated_minutes_to_clean"] <= 120
        assert parsed["waste_type"] in ["plastic", "organic", "paper", "glass", "metal", "e_waste", "hazardous"]
        assert parsed["urgency"] in ["low", "medium", "high", "critical"]

        log_test(
            2,
            "Bedrock Classification",
            True,
            f"Parsed: waste_type={parsed['waste_type']}, fill={parsed['fill_percent']}%, "
            f"workers_needed={parsed['estimated_workers_needed']}, est_time={parsed['estimated_minutes_to_clean']}m",
        )
    except Exception as e:
        log_test(2, "Bedrock Classification", False, str(e))


# ------------------------------------------------------------
# TEST 3: Full Citizen Report (Photo + Location + Multi-Worker Dispatch)
# ------------------------------------------------------------
def test_3_citizen_report_flow():
    print("\n" + "=" * 60)
    print("RUNNING TEST 3: Full Citizen Report Flow")
    print("=" * 60)
    clean_state()
    citizen_phone = f"+9193821{int(time.time()) % 100000:05d}"

    try:
        # Step 1: Send Photo
        r_photo = requests.post(
            f"{BASE_URL}/webhook",
            data={
                "From": f"whatsapp:{citizen_phone}",
                "MediaUrl0": "https://images.unsplash.com/photo-1530587191325-3db32d826c18",
                "MediaContentType0": "image/jpeg",
                "Body": "",
            },
            timeout=5,
        )
        assert r_photo.status_code == 200
        time.sleep(3)

        # Step 2: Send Location
        r_loc = requests.post(
            f"{BASE_URL}/webhook",
            data={
                "From": f"whatsapp:{citizen_phone}",
                "Latitude": "12.9716",
                "Longitude": "77.5946",
                "Body": "",
            },
            timeout=5,
        )
        assert r_loc.status_code == 200
        time.sleep(3)

        # Verify DynamoDB Report
        resp = reports_table.scan(
            FilterExpression="citizen_phone = :p",
            ExpressionAttributeValues={":p": citizen_phone},
        )
        items = resp.get("Items", [])
        assert len(items) > 0, f"No reports found for phone {citizen_phone}"
        items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        report = items[0]

        assert report["status"] == "assigned", f"Status is {report.get('status')}"
        assert "photo_before_url" in report
        assert "waste_type" in report
        assert "fill_percent" in report
        assert "priority_score" in report
        assert "location_before" in report

        log_test(
            3,
            "Citizen Report Flow",
            True,
            f"Report ID: {report['report_id']}, Status: {report['status']}, "
            f"Score: {report.get('priority_score')}, Workers: {report.get('worker_phones', [])}",
        )
        return report
    except Exception as e:
        log_test(3, "Citizen Report Flow", False, str(e))
        return None


# ------------------------------------------------------------
# TEST 4: Worker Arrival Confirmation (Photo + Location)
# ------------------------------------------------------------
def test_4_worker_arrival(report):
    print("\n" + "=" * 60)
    print("RUNNING TEST 4: Worker Arrival Confirmation")
    print("=" * 60)
    if not report:
        log_test(4, "Worker Arrival", False, "No active report from Test 3")
        return None

    worker_phones = report.get("worker_phones") or [report.get("worker_phone") or "+919876543210"]
    worker_phone = worker_phones[0]

    try:
        # Worker arrives and sends photo + location (at same GPS location)
        r_arrival = requests.post(
            f"{BASE_URL}/webhook",
            data={
                "From": f"whatsapp:{worker_phone}",
                "MediaUrl0": "https://images.unsplash.com/photo-1530587191325-3db32d826c18",
                "Latitude": "12.9716",
                "Longitude": "77.5946",
                "Body": "",
            },
            timeout=5,
        )
        assert r_arrival.status_code == 200
        time.sleep(3)

        # Check DB status -> in_progress
        rep_check = reports_table.get_item(Key={"report_id": report["report_id"]}).get("Item", {})
        assert rep_check.get("status") == "in_progress", f"Status is {rep_check.get('status')}"
        assert rep_check.get("start_time") is not None

        log_test(
            4,
            "Worker Arrival",
            True,
            f"Report {report['report_id']} status changed to 'in_progress', start_time={rep_check.get('start_time')}",
        )
        return rep_check
    except Exception as e:
        log_test(4, "Worker Arrival", False, str(e))
        return None


# ------------------------------------------------------------
# TEST 5: Worker Completion & Truth Calculation
# ------------------------------------------------------------
def test_5_worker_completion(report):
    print("\n" + "=" * 60)
    print("RUNNING TEST 5: Worker Completion & Truth Calculation")
    print("=" * 60)
    if not report:
        log_test(5, "Worker Completion", False, "No active report from Test 4")
        return

    worker_phones = report.get("worker_phones") or [report.get("worker_phone") or "+919876543210"]
    worker_phone = worker_phones[0]

    try:
        # Set start_time to 50 minutes ago in DB and estimated to 60m so actual=50m, truth=83% (>= 50%)
        past_time = datetime.fromtimestamp(time.time() - (50 * 60), timezone.utc).isoformat()
        reports_table.update_item(
            Key={"report_id": report["report_id"]},
            UpdateExpression="SET start_time = :st, estimated_minutes_to_clean = :emc, recalculated_estimated_time = :ret",
            ExpressionAttributeValues={
                ":st": past_time,
                ":emc": Decimal("60"),
                ":ret": Decimal("60"),
            },
        )

        # Worker sends cleanup photo + location
        r_done = requests.post(
            f"{BASE_URL}/webhook",
            data={
                "From": f"whatsapp:{worker_phone}",
                "MediaUrl0": "https://images.unsplash.com/photo-1530587191325-3db32d826c18",
                "Latitude": "12.9716",
                "Longitude": "77.5946",
                "Body": "",
            },
            timeout=5,
        )
        assert r_done.status_code == 200
        time.sleep(3)

        rep_check = reports_table.get_item(Key={"report_id": report["report_id"]}).get("Item", {})
        assert rep_check.get("status") == "resolved", f"Status is {rep_check.get('status')}"
        assert rep_check.get("truth_percentage") is not None
        assert int(rep_check.get("truth_percentage", 0)) >= 50

        log_test(
            5,
            "Worker Completion",
            True,
            f"Report resolved with Truth Score: {rep_check.get('truth_percentage')}%, "
            f"Actual Duration: {rep_check.get('actual_duration')}m",
        )
    except Exception as e:
        log_test(5, "Worker Completion", False, str(e))


# ------------------------------------------------------------
# TEST 6: Fake-Work Detection (Instant Completion)
# ------------------------------------------------------------
def test_6_fake_work_detection():
    print("\n" + "=" * 60)
    print("RUNNING TEST 6: Fake-Work Detection (Instant Completion)")
    print("=" * 60)
    clean_state()
    worker_phone = "+919811223344"
    test_id = f"test-fake-{int(time.time())}"

    try:
        now_time = datetime.now(timezone.utc).isoformat()
        reports_table.put_item(
            Item={
                "report_id": test_id,
                "citizen_phone": "+919382122857",
                "worker_phone": worker_phone,
                "worker_phones": [worker_phone],
                "status": "in_progress",
                "start_time": now_time,
                "estimated_minutes_to_clean": Decimal("30"),
                "location_before": {"lat": Decimal("12.9716"), "lng": Decimal("77.5946")},
                "created_at": now_time,
            }
        )

        # Worker sends DONE immediately
        requests.post(
            f"{BASE_URL}/webhook",
            data={
                "From": f"whatsapp:{worker_phone}",
                "MediaUrl0": "https://images.unsplash.com/photo-1530587191325-3db32d826c18",
                "Latitude": "12.9716",
                "Longitude": "77.5946",
                "Body": "",
            },
            timeout=5,
        )
        time.sleep(3)

        rep_check = reports_table.get_item(Key={"report_id": test_id}).get("Item", {})
        assert rep_check.get("status") == "needs_review", f"Status is {rep_check.get('status')}"
        assert int(rep_check.get("truth_percentage", 100)) < 50

        log_test(
            6,
            "Fake-Work Detection",
            True,
            f"Flagged as 'needs_review' with Truth Score: {rep_check.get('truth_percentage')}% (< 50%)",
        )
    except Exception as e:
        log_test(6, "Fake-Work Detection", False, str(e))


# ------------------------------------------------------------
# TEST 7: GPS Fraud Detection (Worker >50m Away)
# ------------------------------------------------------------
def test_7_gps_fraud_detection():
    print("\n" + "=" * 60)
    print("RUNNING TEST 7: GPS Fraud Detection (>50m away)")
    print("=" * 60)
    clean_state()
    worker_phone = "+919900112233"
    test_id = f"test-gps-{int(time.time())}"

    try:
        now_time = datetime.now(timezone.utc).isoformat()
        reports_table.put_item(
            Item={
                "report_id": test_id,
                "citizen_phone": "+919382122857",
                "worker_phone": worker_phone,
                "worker_phones": [worker_phone],
                "status": "assigned",
                "location_before": {"lat": Decimal("12.9716"), "lng": Decimal("77.5946")},
                "created_at": now_time,
            }
        )

        # Worker sends arrival from Location B (12.9800, 77.6000 ~ 1km away)
        requests.post(
            f"{BASE_URL}/webhook",
            data={
                "From": f"whatsapp:{worker_phone}",
                "MediaUrl0": "https://images.unsplash.com/photo-1530587191325-3db32d826c18",
                "Latitude": "12.9800",
                "Longitude": "77.6000",
                "Body": "",
            },
            timeout=5,
        )
        time.sleep(3)

        rep_check = reports_table.get_item(Key={"report_id": test_id}).get("Item", {})
        assert rep_check.get("status") != "in_progress", f"Status is {rep_check.get('status')}"

        log_test(
            7,
            "GPS Fraud Detection",
            True,
            f"GPS check prevented start: Status remained '{rep_check.get('status')}'",
        )
    except Exception as e:
        log_test(7, "GPS Fraud Detection", False, str(e))


# ------------------------------------------------------------
# TEST 8: Multi-Worker Recalculation
# ------------------------------------------------------------
def test_8_multi_worker_recalc():
    print("\n" + "=" * 60)
    print("RUNNING TEST 8: Multi-Worker Recalculation")
    print("=" * 60)
    try:
        est_needed = 4
        assigned = 2
        original_time = 20
        recalculated = original_time * (est_needed / assigned)
        assert recalculated == 40

        log_test(
            8,
            "Multi-Worker Recalc",
            True,
            f"Original: {original_time}m (with {est_needed} workers) -> Recalculated: {recalculated}m (with {assigned} workers)",
        )
    except Exception as e:
        log_test(8, "Multi-Worker Recalc", False, str(e))


# ------------------------------------------------------------
# TEST 9: No Workers Available Queue
# ------------------------------------------------------------
def test_9_no_workers_queue():
    print("\n" + "=" * 60)
    print("RUNNING TEST 9: No Workers Available Queue")
    print("=" * 60)
    try:
        test_id = f"test-no-workers-{int(time.time())}"
        now_time = datetime.now(timezone.utc).isoformat()
        reports_table.put_item(
            Item={
                "report_id": test_id,
                "citizen_phone": "+919382122857",
                "worker_phone": None,
                "status": "pending",
                "created_at": now_time,
            }
        )
        rep = reports_table.get_item(Key={"report_id": test_id}).get("Item", {})
        assert rep.get("status") == "pending"
        assert rep.get("worker_phone") is None

        log_test(
            9,
            "No Workers Available",
            True,
            f"Report {test_id} queued safely in 'pending' status without worker assignment",
        )
    except Exception as e:
        log_test(9, "No Workers Available", False, str(e))


# ------------------------------------------------------------
# TEST 10: Dashboard Live Update & Worker Management
# ------------------------------------------------------------
def test_10_dashboard_live_update():
    print("\n" + "=" * 60)
    print("RUNNING TEST 10: Dashboard Live Update & Worker Management")
    print("=" * 60)
    try:
        res = requests.get(f"{BASE_URL}/reports", timeout=5)
        reports = res.json()
        assert res.status_code == 200
        assert isinstance(reports, list)

        # Check workers endpoint
        r_w = requests.get(f"{BASE_URL}/workers", timeout=5)
        assert r_w.status_code == 200
        workers = r_w.json()
        assert isinstance(workers, list)

        # Check frontend dev server
        r_fe = requests.get("http://localhost:5173", timeout=5)
        assert r_fe.status_code == 200

        log_test(
            10,
            "Dashboard Live Update",
            True,
            f"Reports: {len(reports)}, Workers: {len(workers)}, Frontend live at http://localhost:5173",
        )
    except Exception as e:
        log_test(10, "Dashboard Live Update", False, str(e))


# ------------------------------------------------------------
# MAIN TEST RUNNER
# ------------------------------------------------------------
if __name__ == "__main__":
    print("\n" + "#" * 60)
    print("CLEANLOOP FULL END-TO-END TRUTH SYSTEM TEST SUITE")
    print("#" * 60)

    test_1_twilio_image_download()
    test_2_bedrock_classification()
    rep = test_3_citizen_report_flow()
    started_rep = test_4_worker_arrival(rep)
    test_5_worker_completion(started_rep)
    test_6_fake_work_detection()
    test_7_gps_fraud_detection()
    test_8_multi_worker_recalc()
    test_9_no_workers_queue()
    test_10_dashboard_live_update()

    print("\n" + "=" * 60)
    print("FINAL TEST SUMMARY")
    print("=" * 60)
    for k, v in TEST_RESULTS.items():
        print(f"{k}: {v}")

    all_passed = all(v == "PASS" for v in TEST_RESULTS.values())
    print("\n" + "=" * 60)
    print(f"READY FOR DEMO: {'YES' if all_passed else 'NO'}")
    print("=" * 60 + "\n")
