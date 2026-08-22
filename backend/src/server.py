import os
import json
import logging
from decimal import Decimal
from typing import Any
from urllib.parse import parse_qs
from fastapi import FastAPI, Request, Response, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from config import settings
import webhook_receiver
import processor

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pingbin.server")

app = FastAPI(
    title="PingBin Local Dev Server",
    description="Local development & webhook receiver server for PingBin WhatsApp waste management system.",
    version="1.0.0",
)

# Enable CORS dynamically for frontend dashboard and deployed Vercel URL
cors_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
]
if settings.FRONTEND_URL and settings.FRONTEND_URL.strip():
    clean_origin = settings.FRONTEND_URL.strip().rstrip("/")
    if clean_origin not in cors_origins:
        cors_origins.append(clean_origin)
cors_origins.append("*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

IMAGES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../images"))
if not os.path.isdir(IMAGES_DIR):
    IMAGES_DIR = "/home/swyra/projects/garbage-collector/images"

if os.path.isdir(IMAGES_DIR):
    app.mount("/images", StaticFiles(directory=IMAGES_DIR), name="images")
    logger.info(f"Mounted local /images static directory: {IMAGES_DIR}")


@app.get("/media/{s3_key:path}")
def serve_media(s3_key: str):
    """Serve media either from local /images directory or direct S3 stream."""
    # 1. Check local images directory by filename
    base_name = os.path.basename(s3_key)
    local_path = os.path.join(IMAGES_DIR, base_name)
    if os.path.isfile(local_path):
        return FileResponse(local_path)

    # 2. Try fetching from AWS S3
    try:
        session = settings.get_boto3_session()
        s3 = session.client("s3")
        obj = s3.get_object(Bucket=settings.S3_BUCKET_IMAGES, Key=s3_key)
        return Response(
            content=obj["Body"].read(),
            media_type=obj.get("ContentType", "image/jpeg"),
            headers={"Cache-Control": "public, max-age=86400"}
        )
    except Exception as e:
        logger.warning(f"Media fetch failed for S3 key {s3_key}: {e}")

    # 3. Fallback to first available real image in /images/
    if os.path.isdir(IMAGES_DIR):
        files = [f for f in os.listdir(IMAGES_DIR) if f.endswith((".jpg", ".webp", ".png"))]
        if files:
            return FileResponse(os.path.join(IMAGES_DIR, files[0]))

    return Response(status_code=404)


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "region": settings.AWS_REGION,
        "profile": settings.AWS_PROFILE,
        "reports_table": settings.DYNAMODB_TABLE_REPORTS,
        "workers_table": settings.DYNAMODB_TABLE_WORKERS,
        "images_dir": IMAGES_DIR,
    }


def process_message_async(dev_msg: dict):
    """Background processor for local development when SQS-to-Lambda is simulated."""
    try:
        processor.route_sqs_message(dev_msg)
    except Exception as e:
        logger.warning(f"Background processor notice: {e}")


@app.post("/webhook")
async def twilio_webhook(request: Request, background_tasks: BackgroundTasks):
    """Twilio WhatsApp Inbound Webhook Endpoint.

    Simulates API Gateway POST /webhook and dispatches to webhook_receiver (Lambda 1).
    Guarantees instant response (<500ms).
    """
    raw_body = await request.body()
    body_str = raw_body.decode("utf-8")

    event = {
        "resource": "/webhook",
        "path": "/webhook",
        "httpMethod": "POST",
        "body": body_str,
        "headers": dict(request.headers),
    }

    # Execute Lambda 1 handler (<500ms)
    res = webhook_receiver.lambda_handler(event)

    # Queue background task for local dev processing without blocking webhook response
    try:
        parsed = parse_qs(body_str)
        sender = parsed.get("From", [""])[0].replace("whatsapp:", "").strip()
        media_url = parsed.get("MediaUrl0", [None])[0]
        lat = parsed.get("Latitude", [None])[0]
        lng = parsed.get("Longitude", [None])[0]
        body_text = parsed.get("Body", [""])[0]

        msg_type = "photo" if media_url else ("location" if lat and lng else "text")
        dev_msg = {
            "sender_phone": sender,
            "message_type": msg_type,
            "media_url": media_url,
            "latitude": float(lat) if lat else None,
            "longitude": float(lng) if lng else None,
            "body_text": body_text.strip(),
        }
        background_tasks.add_task(process_message_async, dev_msg)
    except Exception as e:
        logger.warning(f"Failed to queue local async processor: {e}")

    return Response(
        content=res.get("body", "<Response></Response>"),
        media_type="text/xml",
        status_code=res.get("statusCode", 200),
    )


@app.get("/reports")
def get_reports():
    """Admin Dashboard reports query endpoint."""
    event = {
        "resource": "/reports",
        "path": "/reports",
        "httpMethod": "GET",
    }
    res = processor.lambda_handler(event)
    return json.loads(res.get("body", "[]"))


def _serialize(obj):
    """Recursively convert Decimal to float for JSON serialization."""
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, dict):
        return {k: _serialize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_serialize(x) for x in obj]
    return obj


@app.get("/workers")
def list_workers():
    """Retrieve all workers for the Admin Dashboard."""
    from utils.dynamo import get_all_workers
    return [_serialize(w) for w in get_all_workers()]


@app.post("/workers")
def add_worker(payload: dict[str, Any]):
    """Add a new sanitation worker via Admin Dashboard."""
    from utils.dynamo import create_worker
    name = payload.get("fullname") or payload.get("name") or "Field Worker"
    phone = payload.get("phone") or payload.get("whatsapp_number", "")
    lat = float(payload.get("latitude") or payload.get("lat") or 12.9716)
    lng = float(payload.get("longitude") or payload.get("lng") or 77.5946)
    photo_url = payload.get("photo_url") or payload.get("photo", "")

    if not phone:
        return {"error": "WhatsApp phone number is required"}

    item = create_worker(name=name, phone=phone, lat=lat, lng=lng, photo_url=photo_url)
    return {
        "status": "created",
        "worker": {
            "worker_id": item["worker_id"],
            "name": item["name"],
            "phone": item["phone"],
            "photo_url": item["photo_url"],
            "status": item["status"],
            "last_known_location": {"lat": lat, "lng": lng},
        },
    }


@app.post("/dev/simulate-message")
def simulate_message(payload: dict[str, Any], background_tasks: BackgroundTasks):
    """Helper to simulate WhatsApp events directly for local testing without Twilio."""
    background_tasks.add_task(process_message_async, payload)
    return {"status": "queued", "payload": payload}


@app.post("/vendors")
def add_vendor(payload: dict[str, Any]):
    """Register a new vendor with optional coupon templates and location."""
    from utils.dynamo import create_vendor
    vendor_name = (payload.get("vendor_name") or "").strip()
    category = (payload.get("category") or "").strip()
    description = (payload.get("description") or "").strip()
    city = (payload.get("city") or "").strip()
    area = (payload.get("area") or "").strip()
    lat = float(payload["latitude"]) if "latitude" in payload and payload["latitude"] is not None else (float(payload["lat"]) if "lat" in payload and payload["lat"] is not None else None)
    lng = float(payload["longitude"]) if "longitude" in payload and payload["longitude"] is not None else (float(payload["lng"]) if "lng" in payload and payload["lng"] is not None else None)
    coupon_templates = payload.get("coupon_templates") or []
    if not vendor_name:
        return {"error": "vendor_name is required"}
    item = create_vendor(
        vendor_name=vendor_name,
        category=category,
        description=description,
        coupon_templates=coupon_templates,
        lat=lat,
        lng=lng,
        city=city,
        area=area,
    )
    return {"status": "created", "vendor": _serialize(item)}


@app.get("/vendors")
def list_vendors():
    """Return all registered vendors for the admin dashboard."""
    from utils.dynamo import get_all_vendors
    return [_serialize(v) for v in get_all_vendors()]


@app.post("/reports/{report_id}/reject")
def reject_report_endpoint(report_id: str):
    """Reject a low-confidence report from admin queue."""
    event = {
        "resource": "/reports/{id}/reject",
        "path": f"/reports/{report_id}/reject",
        "httpMethod": "POST",
    }
    res = processor.lambda_handler(event)
    return Response(content=res.get("body", "{}"), status_code=res.get("statusCode", 200), media_type="application/json")


@app.post("/reports/{report_id}/approve")
def approve_report_endpoint(report_id: str):
    """Approve a low-confidence report and trigger worker dispatch."""
    event = {
        "resource": "/reports/{id}/approve",
        "path": f"/reports/{report_id}/approve",
        "httpMethod": "POST",
    }
    res = processor.lambda_handler(event)
    return Response(content=res.get("body", "{}"), status_code=res.get("statusCode", 200), media_type="application/json")


@app.get("/warehouses")
def list_warehouses():
    """Return all recycling warehouses for the admin dashboard."""
    from utils.dynamo import get_all_warehouses
    return [_serialize(w) for w in get_all_warehouses()]


@app.get("/coupons")
def list_coupons():
    """Return all issued coupons for the admin dashboard."""
    from utils.dynamo import get_all_coupons
    return [_serialize(c) for c in get_all_coupons()]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)
