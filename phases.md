# `phases.md`

## Architecture Update: 2 Lambdas + SQS Queue

```
Citizen/Worker sends WhatsApp message
        ↓
   Twilio webhook POST
        ↓
┌──────────────────────────────┐
│  Lambda 1: webhook_receiver  │
│  1. Parse Twilio payload      │
│  2. Send message to SQS       │
│  3. Return 200 OK to Twilio   │  ← instant (<500ms)
└──────────────────────────────┘
        ↓ (SQS queue)
┌──────────────────────────────┐
│  Lambda 2: processor          │  ← SQS-triggered
│                              │
│  ACID FLOW:                  │
│  1. Save raw report to DB    │  ← status: "pending"
│  2. Download image → S3      │
│  3. Call Bedrock Nova Lite   │
│  4. Inline scoring (5 lines)  │  ← no separate function
│  5. Update DB with results   │
│  6. Find nearest worker      │
│  7. Send WhatsApp to worker  │
│  8. Update DB status: assigned│
│                              │
│  Also serves:                │
│  GET /reports (dashboard)    │  ← API Gateway trigger
└──────────────────────────────┘
```

---

## Phase 1: Infrastructure Setup (30 mins)

### What to do:
1. Create DynamoDB tables:
   - `Reports` (PK: `report_id`, GSI: `status-index` PK=`status` SK=`created_at`)
   - `Workers` (PK: `worker_id`)
2. Create SQS queue:
   - Name: `cleanloop-messages`
   - Visibility timeout: 300 seconds
   - Message retention: 1 hour
3. Create S3 bucket:
   - Name: `cleanloop-images`
   - Public read access (for demo)
4. Create API Gateway (HTTP API):
   - POST `/webhook` → Lambda 1
   - GET `/reports` → Lambda 2
   - GET `/seed` → Lambda 2 (optional, for seeding)
5. Create Lambda 1 and Lambda 2 (empty for now)

### Done when:
- DynamoDB tables exist and are queryable
- SQS queue URL is available
- S3 bucket is accessible
- API Gateway URL is live and returns 200 (even if empty response)

### Hard stop: 30 minutes. Move on.

---

## Phase 2: Lambda 1 — Webhook Receiver (45 mins)

### Files to create:
- `backend/src/webhook_receiver.py`
- `backend/.env`

### What to do:
1. Implement `lambda_handler(event, context)` that:
   - Parses `event["body"]` (URL-encoded form data) using `urllib.parse.parse_qs`
   - Extracts: `From`, `Body`, `MediaUrl0`, `Latitude`, `Longitude`
   - Constructs a clean message dict:
     ```python
     {
       "sender_phone": "+919876543210",
       "message_type": "photo" | "location" | "text",
       "media_url": "https://api.twilio.com/...",  # if photo
       "latitude": 12.9716,  # if location
       "longitude": 77.5946, # if location
       "body_text": "START", # if text
       "timestamp": "2026-08-21T22:30:00Z"
     }
     ```
   - Sends this dict to SQS via `boto3.client("sqs").send_message()`
   - Returns `{"statusCode": 200, "body": "<Response></Response>"}`
2. Wrap ENTIRE handler in try/except. On any error, still return 200. Log error to CloudWatch.

### Lambda 1 code structure (exact):
```python
import json
import boto3
import logging
from urllib.parse import parse_qs
from datetime import datetime, timezone

logger = logging.getLogger()
logger.setLevel(logging.INFO)

sqs = boto3.client("sqs")
SQS_QUEUE_URL = os.environ.get("SQS_QUEUE_URL", "")

def lambda_handler(event, context):
    try:
        body = event.get("body", "")
        parsed = parse_qs(body)
        
        sender = parsed.get("From", [""])[0].replace("whatsapp:", "")
        media_url = parsed.get("MediaUrl0", [None])[0]
        latitude = parsed.get("Latitude", [None])[0]
        longitude = parsed.get("Longitude", [None])[0]
        body_text = parsed.get("Body", [""])[0]
        
        if media_url:
            msg_type = "photo"
        elif latitude:
            msg_type = "location"
        else:
            msg_type = "text"
        
        message = {
            "sender_phone": sender,
            "message_type": msg_type,
            "media_url": media_url,
            "latitude": float(latitude) if latitude else None,
            "longitude": float(longitude) if longitude else None,
            "body_text": body_text,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        sqs.send_message(
            QueueUrl=SQS_QUEUE_URL,
            MessageBody=json.dumps(message)
        )
        
    except Exception as e:
        logger.error(f"Webhook error: {e}")
    
    return {"statusCode": 200, "body": "<Response></Response>"}
```

### Done when:
- Sending a WhatsApp photo triggers Lambda 1
- Lambda 1 returns 200 in under 500ms
- Message appears in SQS queue
- Twilio console shows webhook success (no retries)

### Hard stop: 45 minutes. Move on.

---

## Phase 3: Lambda 2 — The Processor (2 hours)

### Files to create:
- `backend/src/processor.py`
- `backend/src/utils/haversine.py`
- `backend/src/utils/bedrock.py`
- `backend/src/utils/dynamo.py`
- `backend/src/utils/twilio_outbound.py`

### What to do:

#### Step 1: SQS Handler (15 mins)
```python
def lambda_handler(event, context):
    for record in event["Records"]:
        message = json.loads(record["body"])
        route_message(message)

def route_message(msg):
    if msg["message_type"] == "photo":
        handle_photo(msg)
    elif msg["message_type"] == "location":
        handle_location(msg)
    elif msg["message_type"] == "text":
        if msg["body_text"].strip().upper() == "START":
            handle_start(msg)
        elif msg["body_text"].strip().upper() == "DONE":
            handle_done(msg)
```

#### Step 2: Handle Photo (ACID flow — 30 mins)
```python
def handle_photo(msg):
    # 1. SAVE TO DB FIRST (ACID: atomic write before any processing)
    report_id = str(uuid.uuid4())
    dynamodb.Table("Reports").put_item(
        Item={
            "report_id": report_id,
            "citizen_phone": msg["sender_phone"],
            "status": "pending",
            "created_at": msg["timestamp"],
            "photo_before_url": "",
            "location_before": {},
            "waste_type": "",
            "fill_percent": 0,
            "urgency": "",
            "priority_score": 0,
        }
    )
    
    # 2. Download image from Twilio (requires HTTP Basic Auth)
    image_bytes = download_twilio_media(msg["media_url"])
    
    # 3. Upload to S3
    s3_key = f"before/{report_id}.jpg"
    s3.put_object(Bucket="cleanloop-images", Key=s3_key, Body=image_bytes)
    photo_url = f"https://cleanloop-images.s3.amazonaws.com/{s3_key}"
    
    # 4. Call Bedrock Nova Lite
    result = classify_image_base64(base64.b64encode(image_bytes).decode())
    
    # 5. INLINE SCORING (no separate function, no module call)
    # Just 5 lines of math:
    overflow_score = result["fill_percent"] * 0.4
    wait_score = 50 * 0.2  # default mid
    crowd_score = 0 * 0.15  # default 0
    sensitive_score = 0 * 0.15  # default 0
    weather_score = 50 * 0.1  # default mid
    priority_score = round(overflow_score + wait_score + crowd_score + sensitive_score + weather_score, 2)
    
    # 6. Update DB with results
    dynamodb.Table("Reports").update_item(
        Key={"report_id": report_id},
        UpdateExpression="SET photo_before_url=:url, waste_type=:wt, fill_percent=:fp, urgency=:u, priority_score=:ps",
        ExpressionAttributeValues={
            ":url": photo_url, ":wt": result["waste_type"],
            ":fp": result["fill_percent"], ":u": result["urgency"],
            ":ps": priority_score
        }
    )
```

#### Step 3: Handle Location (15 mins)
```python
def handle_location(msg):
    # Find pending report from same sender within 2-min window
    two_min_ago = (datetime.now(timezone.utc) - timedelta(minutes=2)).isoformat()
    response = dynamodb.Table("Reports").query(
        IndexName="status-index",
        KeyConditionExpression="status = :s AND created_at > :t",
        FilterExpression="citizen_phone = :p",
        ExpressionAttributeValues={":s": "pending", ":t": two_min_ago, ":p": msg["sender_phone"]}
    )
    if response["Items"]:
        report = response["Items"][0]
        dynamodb.Table("Reports").update_item(
            Key={"report_id": report["report_id"]},
            UpdateExpression="SET location_before=:loc",
            ExpressionAttributeValues={":loc": {"lat": msg["latitude"], "lng": msg["longitude"]}}
        )
        # Trigger dispatch
        dispatch_worker(report["report_id"])
```

#### Step 4: Dispatch Worker (20 mins)
```python
def dispatch_worker(report_id):
    report = dynamodb.Table("Reports").get_item(Key={"report_id": report_id})["Item"]
    
    # Scan for free workers
    workers = dynamodb.Table("Workers").scan(
        FilterExpression="status = :s",
        ExpressionAttributeValues={":s": "free"}
    )["Items"]
    
    if not workers:
        return  # No workers, stays pending
    
    # Haversine to find nearest
    report_loc = report["location_before"]
    nearest = min(workers, key=lambda w: haversine(
        report_loc["lat"], report_loc["lng"],
        w["last_known_location"]["lat"], w["last_known_location"]["lng"]
    ))
    
    # Update report
    dynamodb.Table("Reports").update_item(
        Key={"report_id": report_id},
        UpdateExpression="SET #status=:s, worker_phone=:w",
        ExpressionAttributeNames={"#status": "status"},
        ExpressionAttributeValues={":s": "assigned", ":w": nearest["phone"]}
    )
    
    # Update worker
    dynamodb.Table("Workers").update_item(
        Key={"worker_id": nearest["worker_id"]},
        UpdateExpression="SET #status=:s",
        ExpressionAttributeNames={"#status": "status"},
        ExpressionAttributeValues={":s": "busy"}
    )
    
    # Send WhatsApp assignment
    send_whatsapp(
        nearest["phone"],
        f"New assignment: {report['waste_type']} waste, {report['fill_percent']}% full. "
        f"Location: https://maps.google.com/?q={report_loc['lat']},{report_loc['lng']}. "
        f"Reply START when you begin."
    )
    
    # Notify citizen
    send_whatsapp(
        report["citizen_phone"],
        "A worker has been dispatched to your reported location."
    )
```

#### Step 5: Handle START (10 mins)
```python
def handle_start(msg):
    # Find report where worker_phone = sender AND status = assigned
    response = dynamodb.Table("Reports").scan(
        FilterExpression="worker_phone = :p AND #status = :s",
        ExpressionAttributeNames={"#status": "status"},
        ExpressionAttributeValues={":p": msg["sender_phone"], ":s": "assigned"}
    )
    if response["Items"]:
        report = response["Items"][0]
        dynamodb.Table("Reports").update_item(
            Key={"report_id": report["report_id"]},
            UpdateExpression="SET #status=:s, start_time=:t",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={":s": "in_progress", ":t": msg["timestamp"]}
        )
```

#### Step 6: Handle DONE (30 mins)
```python
def handle_done(msg):
    # Find report where worker_phone = sender AND status = in_progress
    response = dynamodb.Table("Reports").scan(
        FilterExpression="worker_phone = :p AND #status = :s",
        ExpressionAttributeNames={"#status": "status"},
        ExpressionAttributeValues={":p": msg["sender_phone"], ":s": "in_progress"}
    )
    if not response["Items"]:
        return
    
    report = response["Items"][0]
    finish_time = msg["timestamp"]
    start_time = report.get("start_time")
    actual_duration = (datetime.fromisoformat(finish_time) - datetime.fromisoformat(start_time)).total_seconds() / 60
    
    # Download after-photo if present, upload to S3
    # (Assume photo comes in same message or correlated)
    
    # VERIFICATION (inline, no separate function)
    # 1. GPS check
    if msg.get("latitude") and report.get("location_before"):
        distance = haversine(
            report["location_before"]["lat"], report["location_before"]["lng"],
            msg["latitude"], msg["longitude"]
        )
        gps_ok = distance <= 50  # within 50 meters
    else:
        gps_ok = True  # skip if no data
    
    # 2. Time check
    estimated = report.get("estimated_minutes_to_clean", 30)
    time_ok = actual_duration >= (estimated * 0.3)  # at least 30% of estimate
    
    # 3. Decide status
    if gps_ok and time_ok:
        new_status = "resolved"
        # Free the worker
        dynamodb.Table("Workers").update_item(
            Key={"worker_id": report.get("worker_id")},
            UpdateExpression="SET #status=:s",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={":s": "free"}
        )
        # Send citizen confirmation
        send_whatsapp(
            report["citizen_phone"],
            f"The waste at your reported location has been cleared. You've helped resolve reports so far. Thank you!"
        )
    else:
        new_status = "needs_review"
        # Still free the worker (don't block them)
        dynamodb.Table("Workers").update_item(
            Key={"worker_id": report.get("worker_id")},
            UpdateExpression="SET #status=:s",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={":s": "free"}
        )
    
    # Update report
    dynamodb.Table("Reports").update_item(
        Key={"report_id": report["report_id"]},
        UpdateExpression="SET #status=:s, finish_time=:ft, actual_duration=:ad",
        ExpressionAttributeNames={"#status": "status"},
        ExpressionAttributeValues={":s": new_status, ":ft": finish_time, ":ad": actual_duration}
    )
```

#### Step 7: Dashboard Query Endpoint (15 mins)
```python
# Add to same Lambda 2, but handle API Gateway events differently
def lambda_handler(event, context):
    # Check if this is an SQS event or API Gateway event
    if "Records" in event and event["Records"][0].get("eventSource") == "aws:sqs":
        # SQS trigger
        for record in event["Records"]:
            message = json.loads(record["body"])
            route_message(message)
        return {"status": "processed"}
    
    elif event.get("httpMethod") == "GET" and event.get("resource") == "/reports":
        # API Gateway trigger — dashboard query
        response = dynamodb.Table("Reports").scan(
            FilterExpression="#status IN (:s1, :s2, :s3, :s4)",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={
                ":s1": "pending", ":s2": "assigned",
                ":s3": "in_progress", ":s4": "needs_review"
            }
        )
        return {
            "statusCode": 200,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps(response["Items"], default=str)
        }
    
    elif event.get("httpMethod") == "GET" and event.get("resource") == "/seed":
        # Seed data endpoint
        seed_demo_data()
        return {"statusCode": 200, "body": json.dumps({"status": "seeded"})}
```

### Done when:
- Send photo via WhatsApp → appears in DynamoDB with classification + priority score
- Send location → correlates with photo → worker dispatched
- Worker sends START → status changes to in_progress
- Worker sends DONE → verification runs → status changes to resolved or needs_review
- GET `/reports` returns JSON array of active reports

### Hard stop: 2 hours. Move on.

---

## Phase 4: Frontend Dashboard (1 hour)

### Files to create:
- `frontend/src/App.tsx`
- `frontend/src/components/ClusterMap.tsx`
- `frontend/src/components/PriorityQueue.tsx`
- `frontend/src/components/NeedsReviewQueue.tsx`
- `frontend/src/components/StatsBar.tsx`
- `frontend/src/hooks/useReports.ts`
- `frontend/.env`

### What to do:

#### Step 1: Setup (10 mins)
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npx shadcn@latest init
npx shadcn@latest add card table badge button
npx shadcn@latest add @mapcn/map
```

#### Step 2: Polling Hook (10 mins)
```typescript
// hooks/useReports.ts
import { useState, useEffect } from "react";

const API_URL = import.meta.env.VITE_API_URL;

export function useReports() {
  const [reports, setReports] = useState([]);
  
  useEffect(() => {
    const fetchReports = async () => {
      try {
        const res = await fetch(`${API_URL}/reports`);
        const data = await res.json();
        setReports(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchReports();
    const interval = setInterval(fetchReports, 5000);
    return () => clearInterval(interval);
  }, []);
  
  return reports;
}
```

#### Step 3: Stats Bar (10 mins)
- Total Pending
- Total Resolved
- Avg Resolution Time
- Active Workers (busy count)

#### Step 4: Cluster Map (20 mins)
- Use `@mapcn/map`
- Color pins by status: red=pending, yellow=assigned, blue=in_progress, green=resolved, orange=needs_review
- Only show reports that have `location_before` populated

#### Step 5: Tables (10 mins)
- PriorityQueue: sorted by `priority_score` descending, shows only pending/assigned
- NeedsReviewQueue: shows only needs_review status

### Done when:
- Dashboard loads and shows seeded data
- Map has color-coded pins
- Tables show sorted data
- New real reports appear within 5 seconds of being processed

### Hard stop: 1 hour. Move on.

---

## Phase 5: Seed Data Script (30 mins)

### Files to create:
- `scripts/seed_data.py`

### What to do:
- Python script (run locally with AWS credentials)
- Generates 50-100 reports with:
  - Random locations within 2km of venue
  - Random waste types, fill %, urgency
  - Mix of statuses: 60% resolved, 20% pending, 10% in_progress, 10% needs_review
  - Random timestamps within last 48 hours
- Generates 3-5 workers:
  - Phone numbers (fake)
  - Locations near venue
  - Mix of free/busy statuses
- Writes all to DynamoDB

### Done when:
- Run script: `uv run python scripts/seed_data.py`
- Dashboard shows 50+ pins on map
- Tables have data rows

### Hard stop: 30 minutes. Move on.

---

## Phase 6: Module Isolation (30 mins)

### What to do:

#### Module 1: Priority Engine
```bash
git checkout -b module/priority-engine
# Copy only /modules/priority-engine/ contents to root
# Delete everything else
# Write README.md with input/output example
# Write .env.example
git add . && git commit -m "feat: isolated priority engine module"
git push origin module/priority-engine
```

#### Module 2: Image Classifier
```bash
git checkout -b module/image-classifier
# Same process
```

#### Module 3: WhatsApp Intake Handler
```bash
git checkout -b module/whatsapp-intake
# Same process — this is Lambda 1's webhook handling logic
# packaged as a standalone, reusable Twilio→SQS handler
```

### Module 3 Contents:
The WhatsApp intake module is Lambda 1's webhook handler, packaged standalone. It:
- Receives Twilio webhook
- Parses URL-encoded body
- Detects message type (photo/location/text)
- Sends to SQS queue
- Returns 200 OK

Its value to buyers (PS-1, PS-9): they need WhatsApp intake and don't want to build the Twilio webhook parsing + SQS decoupling from scratch.

### Done when:
- 3 branches exist on GitHub
- Each branch has: module code, README.md, .env.example
- Main branch still has full application

### Hard stop: 30 minutes. Move on.

---

## Phase 7: Demo Videos (15 mins)

### What to do:
Record 3 screen recordings (30-45s each, no slides):

1. **Priority Engine:** Show input JSON → output ranked JSON
2. **Image Classifier:** Show image input → classification JSON output
3. **WhatsApp Intake:** Show Twilio webhook POST → SQS message → 200 OK response

### Done when:
- 3 videos recorded
- Linked in each module branch's README.md

### Hard stop: 15 minutes. Move on.

---

## Phase 8: Commit & Push (15 mins)

### What to do:
```bash
git checkout main
git add .
git commit -m "feat: complete CleanLoop application with 3 sellable modules"
git push origin main
```

### Done when:
- All code pushed to GitHub
- Main branch has full app
- 3 module branches exist
- Time is before 11:59 PM

### Hard stop: 11:59 PM. STOP. Walk away.

---

## Phase Summary

| Phase | Duration | What | Hard Stop |
|---|---|---|---|
| 1 | 30 min | Infra setup | 30 min |
| 2 | 45 min | Lambda 1 (webhook) | 1h 15m |
| 3 | 2 hr | Lambda 2 (processor) | 3h 15m |
| 4 | 1 hr | Frontend dashboard | 4h 15m |
| 5 | 30 min | Seed data | 4h 45m |
| 6 | 30 min | Module isolation | 5h 15m |
| 7 | 15 min | Demo videos | 5h 30m |
| 8 | 15 min | Commit & push | 5h 45m |
