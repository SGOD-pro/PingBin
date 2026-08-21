import random
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import boto3

# Initialize session
session = boto3.Session(profile_name="aws", region_name="ap-south-1")
dynamodb = session.resource("dynamodb")
reports_table = dynamodb.Table("Reports")
workers_table = dynamodb.Table("Workers")

# Center coordinates for demo (Bangalore Tech Hub / Campus)
BASE_LAT = 12.9716
BASE_LNG = 77.5946

WASTE_TYPES = ["plastic", "organic", "paper", "glass", "metal", "e_waste", "hazardous"]
URGENCY_LEVELS = ["low", "medium", "high", "critical"]
STATUS_POOL = ["resolved"] * 60 + ["pending"] * 20 + ["in_progress"] * 10 + ["needs_review"] * 10

WORKERS = [
    {"worker_id": "w-001", "phone": "+919382122857", "name": "Ramesh Kumar (Lead)", "status": "free", "lat_offset": 0.003, "lng_offset": 0.002},
    {"worker_id": "w-002", "phone": "+919876543210", "name": "Suresh Raina (Zone A)", "status": "busy", "lat_offset": -0.004, "lng_offset": 0.005},
    {"worker_id": "w-003", "phone": "+919811223344", "name": "Anil Verma (Zone B)", "status": "free", "lat_offset": 0.006, "lng_offset": -0.003},
    {"worker_id": "w-004", "phone": "+919900112233", "name": "Priya Sharma (Quick Response)", "status": "free", "lat_offset": -0.002, "lng_offset": -0.006},
]


def seed_workers():
    print("Seeding Workers table...")
    for w in WORKERS:
        worker_item = {
            "worker_id": w["worker_id"],
            "phone": w["phone"],
            "name": w["name"],
            "last_known_location": {
                "lat": Decimal(str(round(BASE_LAT + w["lat_offset"], 6))),
                "lng": Decimal(str(round(BASE_LNG + w["lng_offset"], 6))),
            },
            "status": w["status"],
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        workers_table.put_item(Item=worker_item)
    print(f"Seeded {len(WORKERS)} workers.")


def seed_reports(count: int = 60):
    print(f"Seeding {count} synthetic reports into DynamoDB Reports table...")
    now = datetime.now(timezone.utc)

    for i in range(count):
        report_id = str(uuid.uuid4())
        status = random.choice(STATUS_POOL)
        hours_ago = random.uniform(0.5, 48.0)
        created_at = (now - timedelta(hours=hours_ago)).isoformat()
        
        waste_type = random.choice(WASTE_TYPES)
        fill_percent = random.randint(25, 100)
        urgency = random.choice(URGENCY_LEVELS)
        est_workers = random.randint(1, 3)
        est_minutes = random.randint(15, 60)

        # Inline scoring formula (40/20/15/15/10)
        overflow_score = fill_percent * 0.4
        wait_score = min(hours_ago * 4, 100) * 0.2
        crowd_score = random.choice([0, 20, 50, 80]) * 0.15
        sensitive_score = random.choice([0, 100]) * 0.15
        weather_score = 50 * 0.1
        priority_score = round(overflow_score + wait_score + crowd_score + sensitive_score + weather_score, 2)

        # Jitter location around base coordinates (+- 2km)
        lat = round(BASE_LAT + random.uniform(-0.018, 0.018), 6)
        lng = round(BASE_LNG + random.uniform(-0.018, 0.018), 6)

        citizen_phone = f"+9198{random.randint(10000000, 99999999)}"
        worker_phone = random.choice(WORKERS)["phone"] if status in ["assigned", "in_progress", "resolved", "needs_review"] else None

        item = {
            "report_id": report_id,
            "citizen_phone": citizen_phone,
            "worker_phone": worker_phone,
            "photo_before_url": f"https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=400&q=80",
            "photo_after_url": f"https://images.unsplash.com/photo-1528323273322-d81458248d40?auto=format&fit=crop&w=400&q=80" if status == "resolved" else None,
            "location_before": {
                "lat": Decimal(str(lat)),
                "lng": Decimal(str(lng)),
            },
            "location_after": {
                "lat": Decimal(str(round(lat + random.uniform(-0.0001, 0.0001), 6))),
                "lng": Decimal(str(round(lng + random.uniform(-0.0001, 0.0001), 6))),
            } if status in ["resolved", "needs_review"] else None,
            "waste_type": waste_type,
            "fill_percent": Decimal(str(fill_percent)),
            "urgency": urgency,
            "priority_score": Decimal(str(priority_score)),
            "estimated_workers_needed": est_workers,
            "estimated_minutes_to_clean": est_minutes,
            "start_time": (now - timedelta(hours=hours_ago - 0.2)).isoformat() if status in ["in_progress", "resolved", "needs_review"] else None,
            "finish_time": (now - timedelta(hours=hours_ago - 0.7)).isoformat() if status in ["resolved", "needs_review"] else None,
            "actual_duration": Decimal(str(random.randint(10, 45))) if status in ["resolved", "needs_review"] else None,
            "status": status,
            "created_at": created_at,
        }

        reports_table.put_item(Item=item)

    print(f"Successfully seeded {count} reports into DynamoDB Reports table!")


if __name__ == "__main__":
    seed_workers()
    seed_reports(65)
