# `api.md`

## 1. AWS Lambda Functions (2 Total + SQS Queue)

The backend consists of exactly 2 Lambda functions and 1 SQS queue.

```
WhatsApp message → Twilio → API Gateway POST /webhook
        ↓
┌──────────────────────────────────────────────┐
│  Lambda 1: webhook_receiver.py               │
│  - Parse Twilio URL-encoded payload          │
│  - Send normalized JSON to SQS queue         │
│  - Return 200 OK (<500ms)                    │
└──────────────────────────────────────────────┘
        ↓ (AWS SQS: pingbin-messages)
┌──────────────────────────────────────────────┐
│  Lambda 2: processor.py                      │
│                                              │
│  Trigger A: SQS Queue (Heavy Processing)     │
│   - ACID Step 1: Save raw report (pending)   │
│   - ACID Step 2: Download image → S3         │
│   - ACID Step 3: Call Bedrock Nova Lite      │
│   - ACID Step 4: Inline scoring (5 lines)    │
│   - ACID Step 5: Update DB with results      │
│   - Dispatch nearest free worker via Twilio  │
│   - Handle START / DONE + GPS/time verify    │
│                                              │
│  Trigger B: API Gateway GET /reports         │
│   - Scan DynamoDB Reports table              │
│   - Return active reports JSON to dashboard  │
│                                              │
│  Trigger C (Optional): API Gateway GET /seed │
│   - Trigger seed generator                   │
└──────────────────────────────────────────────┘
```

---

### Lambda 1: `webhook_receiver.py`
**Purpose:** Receive Twilio webhook, normalize event, send message to SQS, return 200 OK instantly.  
**Trigger:** API Gateway (HTTP API, POST `/webhook`).  
**Timeout:** 3 seconds (returns in <500ms).  

**Input Event (API Gateway Proxy):**
```json
{
  "resource": "/webhook",
  "path": "/webhook",
  "httpMethod": "POST",
  "body": "MediaContentType0=image%2Fjpeg&MediaUrl0=https%3A%2F%2Fapi.twilio.com%2F...&MessageSid=SM...&From=whatsapp%3A%2B919876543210&Body=&AccountSid=AC..."
}
```
**Note:** `event["body"]` is URL-encoded form data. Parse with `urllib.parse.parse_qs`.

**Output Contract:**
```json
{
  "statusCode": 200,
  "headers": {"Content-Type": "text/xml"},
  "body": "<Response></Response>"
}
```

**Message Sent to SQS (`pingbin-messages`):**
```json
{
  "sender_phone": "+919876543210",
  "message_type": "photo",
  "media_url": "https://api.twilio.com/...",
  "latitude": null,
  "longitude": null,
  "body_text": "",
  "timestamp": "2026-08-21T22:30:00Z"
}
```
- For location shares: `message_type: "location"`, `latitude: 12.9716`, `longitude: 77.5946`.
- For text messages: `message_type: "text"`, `body_text: "START"` or `"DONE"`.

---

### Lambda 2: `processor.py`
**Purpose:** Handle all heavy compute from SQS queue, and serve dashboard queries via API Gateway GET.  
**Triggers (Dual/Triple):**
1. **SQS Trigger:** Event from `pingbin-messages` queue (`event["Records"][0]["eventSource"] == "aws:sqs"`).
2. **API Gateway Trigger:** HTTP GET `/reports` (`event["httpMethod"] == "GET" and event["resource"] == "/reports"`).
3. **API Gateway Trigger (Optional):** HTTP GET `/seed` (`event["httpMethod"] == "GET" and event["resource"] == "/seed"`).  
**Timeout:** 60 seconds.

**SQS Input Event (Standard SQS Event):**
```json
{
  "Records": [
    {
      "messageId": "sqs-msg-id",
      "body": "{\"sender_phone\":\"+919876543210\",\"message_type\":\"photo\",\"media_url\":\"...\",\"timestamp\":\"...\"}",
      "eventSource": "aws:sqs"
    }
  ]
}
```

**Internal Flow for SQS Trigger:**
1. **Photo Message:**
   - **ACID Step 1:** Save raw report to DynamoDB `Reports` table (`report_id`, `citizen_phone`, `created_at`, `status: "pending"`).
   - **ACID Step 2:** Download image with Twilio Basic Auth, upload to S3 (`pingbin-images/before/{report_id}.jpg`).
   - **ACID Step 3:** Call Bedrock Nova Lite with image base64. Parse JSON (`waste_type`, `fill_percent`, `urgency`, `estimated_workers_needed` [1-4], `estimated_minutes_to_clean`).
   - **ACID Step 4 (Inline Score):** 5 lines of math:
     ```python
     overflow_score = result["fill_percent"] * 0.4
     wait_score = 50 * 0.2
     crowd_score = 0 * 0.15
     sensitive_score = 0 * 0.15
     weather_score = 50 * 0.1
     priority_score = round(overflow_score + wait_score + crowd_score + sensitive_score + weather_score, 2)
     ```
   - **ACID Step 5:** Update DynamoDB report with `photo_before_url`, `waste_type`, `fill_percent`, `urgency`, `priority_score`, `estimated_workers_needed`, `estimated_minutes_to_clean`.
2. **Location Message (Citizen):**
   - Find pending report from same sender within 5-min window.
   - Update report with `location_before`.
   - Find free workers in `Workers` table and assign $N = \min(\text{estimated\_workers\_needed}, \text{free\_workers\_available})$ nearest workers via Haversine.
   - If $N < \text{estimated\_workers\_needed}$, compute: `recalculated_estimated_time = estimated_minutes_to_clean * (estimated_workers_needed / N)`.
   - Update report `status: "assigned"`, `worker_phones`, `assigned_workers_count`, `recalculated_estimated_time`.
   - Update each assigned worker `status: "busy"`.
   - Send WhatsApp assignment to all assigned workers with estimated time and location link; notify citizen.
3. **Worker Arrival (Photo + Location from assigned worker):**
   - Upload start photo to S3 (`pingbin-images/start/{report_id}.jpg`), save `start_location`.
   - Verify GPS distance between `location_before` and `start_location` $\le 50$m.
   - If GPS $\le 50$m: update report `status: "in_progress"`, `start_time: timestamp`.
4. **Worker Completion (Photo + Location from in_progress worker):**
   - Upload after-photo to S3 (`pingbin-images/after/{report_id}.jpg`), save `location_after`.
   - Calculate `actual_duration = finish_time - start_time` (in minutes).
   - Calculate `truth_percentage = min(100, round((actual_duration / estimated_time_used) * 100))`.
   - Verify GPS distance $\le 50$m.
   - If GPS $\le 50$m AND `truth_percentage >= 50`: `status: "resolved"`, free all assigned workers, send citizen WhatsApp completion message with coupon `CLEAN10` and incremented report count.
   - If GPS $> 50$m OR `truth_percentage < 50`: `status: "needs_review"`, free workers to unblock them.

**API Gateway GET `/reports` Output Contract (Dashboard Query):**
```json
{
  "statusCode": 200,
  "headers": {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json"
  },
  "body": "[{\"report_id\":\"uuid-1\",\"status\":\"pending\",\"priority_score\":85.5,\"location_before\":{\"lat\":12.9716,\"lng\":77.5946},\"waste_type\":\"plastic\",\"fill_percent\":90,\"urgency\":\"high\",\"worker_phone\":null,\"worker_phones\":[],\"assigned_workers_count\":0,\"truth_percentage\":null,\"created_at\":\"2026-08-21T22:30:00Z\"}]"
}
```

---

### Local Seed Script: `scripts/seed_data.py`
**Purpose:** Populate DynamoDB with 50-100 synthetic reports and 3-5 workers for demo scale.  
**Execution:** `uv run python scripts/seed_data.py` (run locally with AWS credentials, not deployed as a Lambda).

---

## 2. External API Contracts

### Twilio WhatsApp API (Inbound Webhook)
Twilio sends POST requests with URL-encoded form data. Key fields:

| Field | Present When | Description |
|---|---|---|
| `From` | Always | Sender phone (E.164, `whatsapp:+91...`) |
| `Body` | Text messages | Message text |
| `MediaUrl0` | Photo messages | URL to download image (requires HTTP Basic Auth) |
| `MediaContentType0` | Photo messages | MIME type (e.g., `image/jpeg`) |
| `Latitude` | Location shares | Float |
| `Longitude` | Location shares | Float |
| `MessageSid` | Always | Unique message ID |

**Message Templates:**
- **Citizen (photo received):** "Thanks for reporting! Please share your location in WhatsApp so we can dispatch workers."
- **Citizen (dispatched):** "Dispatched {assigned_count} worker(s) to your reported location. Estimated cleanup: {time} min."
- **Citizen (resolved):** "Cleaning completed! Here's your reward coupon: CLEAN10 - 10% off at [Local Store]. You've helped resolve {count} reports!"
- **Citizen (queue):** "Thanks for reporting. All workers are currently busy. Your report is in the queue and will be assigned when a worker is free."
- **Worker (assignment):** "New assignment ({count} worker(s) assigned): {waste_type} waste, {fill_percent}% full. Estimated time: {time} min. Location: {maps_url}. Please send a PHOTO + LOCATION upon arrival to confirm start."
- **Worker (arrival verified):** "Arrival verified at location. Work started and time logged. When finished, send cleanup photo + location to complete."
- **Worker (resolved):** "Cleanup verified (Truth Score: {truth}%). Job marked resolved. Thank you!"

### Amazon Bedrock (Nova Lite) API
```python
import boto3
import json
import base64
import requests
from requests.auth import HTTPBasicAuth

client = boto3.client("bedrock-runtime", region_name="ap-south-1")

def classify_image(image_url: str) -> dict:
    response = requests.get(image_url, auth=HTTPBasicAuth(TWILIO_SID, TWILIO_AUTH_TOKEN))
    image_base64 = base64.b64encode(response.content).decode("utf-8")
    
    prompt = """Analyze this waste bin image. Return ONLY valid JSON (no markdown fences) with these exact fields:
    {
      "waste_type": "plastic" | "organic" | "paper" | "glass" | "metal" | "e_waste" | "hazardous",
      "fill_percent": <integer 0-100>,
      "urgency": "low" | "medium" | "high" | "critical",
      "estimated_workers_needed": <integer 1-4>,
      "estimated_minutes_to_clean": <integer 5-120>
    }"""

    response = client.invoke_model(
        modelId="amazon.nova-lite-v1:0",
        body=json.dumps({
            "messages": [{"role": "user", "content": [
                {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": image_base64}},
                {"type": "text", "text": prompt}
            ]}]
        })
    )
    
    raw_text = json.loads(response["body"].read())["output"]["message"]["content"][0]["text"].strip()
    
    if raw_text.startswith("```json"):
        raw_text = raw_text[7:]
    if raw_text.endswith("```"):
        raw_text = raw_text[:-3]
    
    return json.loads(raw_text.strip())
```

---

## 3. DynamoDB Access Patterns

### Table: `Reports`

| Operation | Key Condition | Used By |
|---|---|---|
| `PutItem` | PK: `report_id` | Lambda 2 (ACID initial write, `status: "pending"`) |
| `UpdateItem` | PK: `report_id` | Lambda 2 (update classification, score, location, worker, status) |
| `Scan` | Filter: `#status IN (:s1, :s2, :s3, :s4)` | Lambda 2 (dashboard GET `/reports` query) |
| `Query` (GSI) | PK: `status = "pending"`, SK: `created_at > :t` | Lambda 2 (find pending report for location correlation) |

**Critical Query — Find pending report for location correlation:**
```python
from boto3.dynamodb.conditions import Key
from datetime import datetime, timedelta, timezone

two_min_ago = (datetime.now(timezone.utc) - timedelta(minutes=2)).isoformat()

response = table.query(
    IndexName="status-index",
    KeyConditionExpression=Key("status").eq("pending") & Key("created_at").gt(two_min_ago),
    FilterExpression="citizen_phone = :phone",
    ExpressionAttributeValues={":phone": sender_phone}
)
```

### Table: `Workers`

| Operation | Key Condition | Used By |
|---|---|---|
| `Scan` | Filter: `status = "free"` | Lambda 2 (find free workers for haversine matching) |
| `UpdateItem` | PK: `worker_id` | Lambda 2 (mark busy/free, update location) |

---

## 4. S3 Storage Contract

### Bucket: `pingbin-images`

| Operation | Key Format | Used By |
|---|---|---|
| `PutObject` | `before/{report_id}.jpg` | Lambda 2 (store citizen photo) |
| `PutObject` | `after/{report_id}.jpg` | Lambda 2 (store worker after-photo) |

**URL Pattern:** `https://{bucket}.s3.amazonaws.com/{key}`
- Public-readable for hackathon demo.
- Store full URL in DynamoDB `photo_before_url` / `photo_after_url`.

---

## 5. Frontend API Contract

The React frontend calls exactly ONE endpoint.

### GET `/reports`
**Base URL:** API Gateway URL (set as `VITE_API_URL` in `.env`)  
**Response:**
```json
[
  {
    "report_id": "uuid-1",
    "status": "pending",
    "priority_score": 92.5,
    "location_before": {"lat": 12.9716, "lng": 77.5946},
    "waste_type": "plastic",
    "fill_percent": 90,
    "urgency": "high",
    "worker_phone": null,
    "created_at": "2026-08-21T22:30:00Z"
  },
  {
    "report_id": "uuid-2",
    "status": "needs_review",
    "priority_score": 45.0,
    "location_before": {"lat": 12.9720, "lng": 77.5940},
    "waste_type": "organic",
    "fill_percent": 30,
    "urgency": "low",
    "worker_phone": "+919876543210",
    "created_at": "2026-08-21T22:15:00Z"
  }
]
```

**Frontend polling:**
```javascript
const API_URL = import.meta.env.VITE_API_URL;

useEffect(() => {
  const fetchReports = async () => {
    try {
      const res = await fetch(`${API_URL}/reports`);
      const data = await res.json();
      setReports(data);
    } catch (err) {
      toast({ title: "Failed to fetch reports", variant: "destructive" });
    }
  };
  
  fetchReports(); // Initial fetch
  const interval = setInterval(fetchReports, 5000); // Poll every 5s
  return () => clearInterval(interval);
}, []);
```

---

| Method | Path | Integration | Description |
|---|---|---|---|
| POST | `/webhook` | Lambda 1 (`webhook_receiver.py`) | Twilio webhook intake |
| GET | `/reports` | Lambda 2 (`processor.py`) | List all reports |
| POST | `/reports/{id}/reject` | Lambda 2 (`processor.py`) | Reject low-confidence report |
| POST | `/reports/{id}/approve` | Lambda 2 (`processor.py`) | Approve low-confidence report & dispatch |
| GET | `/warehouses` | Lambda 2 (`processor.py`) | List recycling warehouses |
| GET | `/workers` | Lambda 2 (`processor.py`) | List sanitation workers |
| POST | `/workers` | Lambda 2 (`processor.py`) | Add new worker |
| GET | `/vendors` | Lambda 2 (`processor.py`) | List local vendors |
| POST | `/vendors` | Lambda 2 (`processor.py`) | Add vendor |
| GET | `/coupons` | Lambda 2 (`processor.py`) | List issued coupons |
| OPTIONS | `/{proxy+}` | Lambda 2 (`processor.py`) | CORS preflight |

**CORS Configuration (set at API Gateway level):**
```json
{
  "allowOrigins": ["*"],
  "allowMethods": ["GET", "POST", "OPTIONS"],
  "allowHeaders": ["Content-Type", "Authorization"]
}
```

---

## 7. Environment Variables

### Backend `.env`
```env
TWILIO_ACCOUNT_SID=AC_xxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
AWS_REGION=us-east-1
DYNAMODB_TABLE_REPORTS=Reports
DYNAMODB_TABLE_WORKERS=Workers
S3_BUCKET_IMAGES=pingbin-images
BEDROCK_MODEL_ID=amazon.nova-lite-v1:0
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/pingbin-messages
```

### Frontend `.env`
```env
VITE_API_URL=https://xxx.execute-api.us-east-1.amazonaws.com
```

### Module `.env.example` files
Each module in `/modules/` has its own `.env.example`:

**`/modules/priority-engine/.env.example`**
```env
WEIGHT_OVERFLOW=40
WEIGHT_WAITING_TIME=20
WEIGHT_CROWD_DENSITY=15
WEIGHT_SENSITIVE_PROXIMITY=15
WEIGHT_WEATHER=10
```

**`/modules/image-classifier/.env.example`**
```env
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=amazon.nova-lite-v1:0
```

**`/modules/whatsapp-intake/.env.example`**
```env
TWILIO_ACCOUNT_SID=AC_xxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxx
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/pingbin-messages
```

