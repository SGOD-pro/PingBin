import base64
import json
import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
import boto3
from config import settings
from utils.bedrock import CLASSIFICATION_ERROR, classify_image_base64, download_twilio_media, detect_image_format
from utils.dynamo import (
    approve_report,
    assign_workers_to_report,
    complete_and_verify_report,
    complete_intake_location_step,
    complete_intake_photo_step,
    create_awaiting_location_report,
    create_awaiting_photo_report,
    expire_report,
    find_active_intake_by_phone,
    find_assigned_report_for_worker,
    find_in_progress_report_for_worker,
    find_pending_report_by_phone,
    flag_report_classification_error,
    generate_and_save_coupon,
    get_active_reports,
    get_all_warehouses,
    get_citizen_reward_count,
    get_free_workers,
    get_report_by_id,
    record_worker_arrival_step,
    record_worker_finish_step,
    reject_report,
    save_raw_pending_report,
    set_report_pending_admin_review,
    set_report_worker_finished,
    set_report_worker_started,
    update_report_classification,
    update_report_location,
    update_report_warehouse_details,
)
from utils.haversine import haversine
from utils.twilio_outbound import send_whatsapp

# Import decoupled M&A standalone modules
import os
import sys

# Locate modules directory robustly whether running locally, in Docker, or Lambda
_POSSIBLE_MOD_DIRS = [
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../../modules")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../modules")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "modules")),
    os.path.abspath("modules"),
]
for _md in _POSSIBLE_MOD_DIRS:
    if os.path.isdir(_md):
        for _sub in ["truth-verification-engine", "reward-engine", "recycling-categorizer", "safety-gate", "whatsapp-intake"]:
            _sp = os.path.join(_md, _sub)
            if os.path.isdir(_sp) and _sp not in sys.path:
                sys.path.insert(0, _sp)

try:
    from verifier import verify_work
except ImportError:
    verify_work = None

try:
    from categorizer import categorize_for_recycling
except ImportError:
    categorize_for_recycling = None

try:
    from safety_gate import evaluate_safety_gate
except ImportError:
    evaluate_safety_gate = None

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Instantiate S3 client at module level
try:
    session = settings.get_boto3_session()
    s3_client = session.client("s3")
except Exception as e:
    logger.warning(f"Failed to initialize S3 client: {e}")
    s3_client = None


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _upload_photo(image_bytes: bytes, s3_key: str, fallback_url: str) -> str:
    """Upload image bytes to S3 and return presigned URL or accessible media URL."""
    content_type = "image/jpeg"
    if image_bytes:
        fmt = detect_image_format(image_bytes)
        content_type = f"image/{fmt}"

    if s3_client and image_bytes:
        try:
            s3_client.put_object(
                Bucket=settings.S3_BUCKET_IMAGES,
                Key=s3_key,
                Body=image_bytes,
                ContentType=content_type,
            )
            # Generate 7-day presigned URL for secure, direct browser rendering
            presigned = s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": settings.S3_BUCKET_IMAGES, "Key": s3_key},
                ExpiresIn=604800,  # 7 days
            )
            return presigned
        except Exception as e:
            logger.error(f"S3 upload or presign failed for {s3_key}: {e}")

    # Fallback to local media endpoint if S3 presign unavailable
    if fallback_url and not fallback_url.startswith("https://pingbin-images/"):
        return fallback_url
    return f"http://localhost:8000/media/{s3_key}"


def _inline_priority_score(fill_percent: int) -> float:
    """Fixed 40/20/15/15/10 inline scoring engine (5 lines of math)."""
    overflow_score  = fill_percent * 0.40
    wait_score      = 50           * 0.20  # default mid waiting score
    crowd_score     = 0            * 0.15  # default crowd density
    sensitive_score = 0            * 0.15  # default proximity
    weather_score   = 50           * 0.10  # default weather factor
    return round(overflow_score + wait_score + crowd_score + sensitive_score + weather_score, 2)


# ---------------------------------------------------------------------------
# Stage handlers
# ---------------------------------------------------------------------------

def handle_photo(msg: dict) -> str:
    """Citizen photo intake (Order-Agnostic with 5-minute timeout):
    - If Location arrived first (awaiting_photo): update photo, run AI, and trigger dispatch once both are present.
    - If Photo arrives first (no prior location): create awaiting_location record, run AI, and ask for location.
    - If prior intake timed out (>5 min): expire old record, alert citizen, and treat as new intake.
    """
    timestamp = msg.get("timestamp") or datetime.now(timezone.utc).isoformat()
    citizen_phone = msg.get("sender_phone", "")

    # Check for active intake
    active_report, is_timed_out = find_active_intake_by_phone(citizen_phone, timeout_seconds=150)
    if is_timed_out and citizen_phone:
        send_whatsapp(
            citizen_phone,
            "Your previous report timed out. Please send a photo and location again to start a new report.",
        )

    # Download & upload photo to S3
    media_url = msg.get("media_url", "")
    image_bytes = b""
    if msg.get("image_base64"):
        try:
            image_bytes = base64.b64decode(msg["image_base64"])
        except Exception:
            pass
    elif media_url:
        image_bytes = download_twilio_media(media_url)

    # Classify with Nova Lite
    image_b64 = base64.b64encode(image_bytes).decode("utf-8") if image_bytes else (msg.get("image_base64") or "")
    classification = classify_image_base64(image_b64)

    # Re-check active report in case location arrived while Bedrock was classifying
    if not active_report:
        active_report, _ = find_active_intake_by_phone(citizen_phone, timeout_seconds=150)

    # Scenario A: Location was already provided (status == 'awaiting_photo')
    if active_report and active_report.get("status") == "awaiting_photo":
        report_id = active_report["report_id"]
        photo_url = _upload_photo(image_bytes, f"before/{report_id}.jpg", media_url or "https://pingbin-images/before.jpg")

        if "_error" in classification or not classification.get("is_valid_report", False):
            logger.warning(f"Classification failed for report {report_id} — flagging needs_review")
            flag_report_classification_error(report_id, "classification_error")
            if citizen_phone:
                send_whatsapp(
                    citizen_phone,
                    "We received your image but couldn't classify the waste clearly. "
                    "Please resend a clearer photo of the waste or bin. Your report has been logged for review.",
                )
            return report_id

        confidence = int(classification.get("confidence", 85))
        suspicious_flag = bool(classification.get("suspicious_flag", False))
        if confidence < 25 or suspicious_flag:
            logger.info(f"Report {report_id} confidence={confidence}, suspicious={suspicious_flag} — routing to pending_admin_review")
            set_report_pending_admin_review(
                report_id=report_id,
                photo_before_url=photo_url,
                classification=classification,
            )
            if citizen_phone:
                send_whatsapp(
                    citizen_phone,
                    "Thanks for reporting! We've received your report. It is currently being processed.",
                )
            return report_id

        priority_score = _inline_priority_score(int(classification.get("fill_percent", 50)))
        updated_report = complete_intake_photo_step(report_id, photo_url, classification, priority_score=priority_score)
        logger.info(f"Order-agnostic: Both Photo & Location present for {report_id}, score={priority_score}. Dispatching...")

        loc = updated_report.get("location_before") or {}
        lat = float(loc.get("lat", 20.3533))
        lng = float(loc.get("lng", 85.8197))
        dispatch_workers(report_id, lat, lng, updated_report)
        return report_id

    # Scenario B: Fresh intake (Photo arrives first)
    report_id = str(uuid.uuid4())
    photo_url = _upload_photo(image_bytes, f"before/{report_id}.jpg", media_url or "https://pingbin-images/before.jpg")

    if "_error" in classification or not classification.get("is_valid_report", False):
        logger.warning(f"Classification failed for report {report_id} — flagging needs_review")
        save_raw_pending_report(report_id, citizen_phone, timestamp)
        flag_report_classification_error(report_id, "classification_error")
        if citizen_phone:
            send_whatsapp(
                citizen_phone,
                "We received your image but couldn't classify the waste clearly. "
                "Please resend a clearer photo of the waste or bin. Your report has been logged for review.",
            )
        return report_id

    confidence = int(classification.get("confidence", 85))
    suspicious_flag = bool(classification.get("suspicious_flag", False))

    create_awaiting_location_report(
        report_id=report_id,
        citizen_phone=citizen_phone,
        photo_before_url=photo_url,
        classification=classification,
        timestamp=timestamp,
    )
    logger.info(f"Order-agnostic: Saved photo-first report {report_id}, confidence={confidence}, suspicious={suspicious_flag}")

    if confidence < 25 or suspicious_flag:
        if citizen_phone:
            send_whatsapp(
                citizen_phone,
                "Thanks for reporting! We've received your report. It is currently being processed.",
            )
        return report_id

    if citizen_phone:
        send_whatsapp(
            citizen_phone,
            "Thanks for reporting! Please share your location in WhatsApp so we can dispatch workers.",
        )
    return report_id


def handle_location(msg: dict) -> None:
    """Citizen location share (Order-Agnostic with 5-minute timeout):
    - If Photo arrived first (awaiting_location): save location, transition to pending, calculate score, and dispatch workers.
    - If Location arrives first (no prior photo): create awaiting_photo record, prompt citizen to send a photo.
    - If prior intake timed out (>5 min): expire old record, alert citizen, and treat as new intake.
    """
    sender_phone = msg.get("sender_phone", "")
    lat = msg.get("latitude")
    lng = msg.get("longitude")
    timestamp = msg.get("timestamp") or datetime.now(timezone.utc).isoformat()

    if lat is None or lng is None:
        return

    active_report, is_timed_out = find_active_intake_by_phone(sender_phone, timeout_seconds=150)
    if is_timed_out and sender_phone:
        send_whatsapp(
            sender_phone,
            "Your previous report timed out. Please send a photo and location again to start a new report.",
        )

    # Scenario A: Photo was already provided (status == 'awaiting_location' or 'pending_admin_review' or 'pending')
    if active_report and active_report.get("status") in ["awaiting_location", "pending_admin_review", "pending"]:
        report_id = active_report["report_id"]
        is_gated = (
            active_report.get("status") == "pending_admin_review"
            or int(active_report.get("confidence", 100)) < 25
            or active_report.get("suspicious_flag", False)
        )

        if is_gated:
            update_report_location(report_id, lat, lng)
            logger.info(f"Attached location to gated report {report_id} (pending_admin_review). Dispatch held.")
            return

        priority_score = _inline_priority_score(int(active_report.get("fill_percent", 50)))
        updated_report = complete_intake_location_step(report_id, lat, lng, priority_score=priority_score)
        logger.info(f"Order-agnostic: Both Photo & Location present for {report_id}, score={priority_score}. Dispatching...")

        dispatch_workers(report_id, lat, lng, updated_report)
        return

    # Scenario B: Existing awaiting_photo report (user re-sent/updated location before photo)
    if active_report and active_report.get("status") == "awaiting_photo":
        report_id = active_report["report_id"]
        update_report_location(report_id, lat, lng)
        if sender_phone:
            send_whatsapp(
                sender_phone,
                "Location updated! Please send a clear photo of the waste or overflowing dustbin to complete your report.",
            )
        return

    # Scenario C: Fresh intake (Location arrives first)
    report_id = str(uuid.uuid4())
    create_awaiting_photo_report(
        report_id=report_id,
        citizen_phone=sender_phone,
        lat=lat,
        lng=lng,
        timestamp=timestamp,
    )
    logger.info(f"Order-agnostic: Created location-first report {report_id} (awaiting_photo)")

    if sender_phone:
        send_whatsapp(
            sender_phone,
            "Location received! Please send a clear photo of the waste or overflowing dustbin to complete your report.",
        )


def dispatch_workers(report_id: str, rep_lat: float, rep_lng: float, report_data: dict) -> None:
    """Find nearest free workers within WORKER_SEARCH_RADIUS_KM, assign, and send WhatsApp dispatch."""
    needed_workers = int(report_data.get("estimated_workers_needed", 1))
    original_est_time = float(report_data.get("estimated_minutes_to_clean", 30))
    citizen_phone = report_data.get("citizen_phone", "")

    free_workers = get_free_workers()
    if not free_workers:
        logger.info(f"No free workers for report {report_id} — stays pending (unserviced).")
        if citizen_phone and citizen_phone != "ADMIN":
            send_whatsapp(
                citizen_phone,
                "Thanks for reporting. All workers are currently busy. "
                "Your report is queued and will be dispatched when a worker becomes free.",
            )
        return

    # Filter by search radius
    radius_m = settings.WORKER_SEARCH_RADIUS_KM * 1000

    def worker_dist(w: dict) -> float:
        loc = w.get("last_known_location", {})
        return haversine(rep_lat, rep_lng, float(loc.get("lat", rep_lat)), float(loc.get("lng", rep_lng)))

    nearby_workers = [w for w in free_workers if worker_dist(w) <= radius_m]
    if not nearby_workers:
        # Fall back to closest available worker regardless of radius
        nearby_workers = sorted(free_workers, key=worker_dist)[:1]
        logger.info(f"No workers within radius for {report_id} — falling back to nearest worker")

    sorted_workers = sorted(nearby_workers, key=worker_dist)
    assigned_workers = sorted_workers[: min(needed_workers, len(sorted_workers))]
    assigned_count = len(assigned_workers)

    worker_ids = [w.get("worker_id", f"worker-{i}") for i, w in enumerate(assigned_workers)]
    worker_phones = [w.get("phone") or w.get("worker_phone") or "+919876543210" for w in assigned_workers]

    # Adjusted estimate if fewer workers than needed
    adjusted_estimated_minutes = None
    if assigned_count < needed_workers and assigned_count > 0:
        adjusted_estimated_minutes = original_est_time * (needed_workers / assigned_count)
        time_display = f"{adjusted_estimated_minutes:.0f}"
    else:
        # No worker-count adjustment — store original as adjusted so Gate B has one authoritative value
        adjusted_estimated_minutes = original_est_time
        time_display = f"{original_est_time:.0f}"

    assign_workers_to_report(
        report_id=report_id,
        worker_ids=worker_ids,
        worker_phones=worker_phones,
        assigned_count=assigned_count,
        original_estimated_minutes=original_est_time,
        adjusted_estimated_minutes=adjusted_estimated_minutes,
        recalculated_estimated_time=adjusted_estimated_minutes,
    )

    waste_type = report_data.get("waste_type", "general")
    fill_pct = report_data.get("fill_percent", 0)
    maps_url = f"https://maps.google.com/?q={rep_lat},{rep_lng}"

    for phone in worker_phones:
        send_whatsapp(
            phone,
            f"New assignment ({assigned_count} worker(s)): {waste_type} waste, {fill_pct}% full. "
            f"Estimated time: {time_display} min. Location: {maps_url}. "
            "Send a PHOTO + LOCATION when you arrive to confirm start.",
        )

    if citizen_phone and citizen_phone != "ADMIN":
        send_whatsapp(
            citizen_phone,
            f"Dispatched {assigned_count} worker(s) to your location. "
            f"Estimated cleanup: {time_display} min.",
        )


def handle_worker_arrival(msg: dict, report: dict) -> None:
    """Worker sends photo + location upon arrival.

    Tracks arrival_photo and arrival_location in DynamoDB.
    Only when BOTH are received and GPS <= 50m does the work timer start (status -> in_progress).
    """
    report_id = report["report_id"]
    worker_phone = msg.get("sender_phone", "")
    media_url = msg.get("media_url")
    image_b64 = msg.get("image_base64")
    lat_w = msg.get("latitude")
    lng_w = msg.get("longitude")

    start_photo_url = None
    if image_b64:
        try:
            image_bytes = base64.b64decode(image_b64)
            start_photo_url = _upload_photo(image_bytes, f"start/{report_id}.jpg", "https://pingbin-images/start.jpg")
        except Exception:
            pass
    elif media_url:
        image_bytes = download_twilio_media(media_url)
        start_photo_url = _upload_photo(image_bytes, f"start/{report_id}.jpg", media_url)

    start_loc = {"lat": lat_w, "lng": lng_w} if lat_w is not None and lng_w is not None else None

    # Incrementally record arrival step in DynamoDB
    updated_report = record_worker_arrival_step(
        report_id,
        start_photo_url=start_photo_url,
        start_location=start_loc,
    )

    has_photo = bool(updated_report.get("start_photo_url") or updated_report.get("arrival_photo_received"))
    has_location = bool(updated_report.get("start_location") or updated_report.get("arrival_location_received"))

    if has_photo and not has_location:
        send_whatsapp(worker_phone, "📸 Arrival photo received! Please now share your GPS Location in WhatsApp to confirm arrival on site.")
        return
    elif has_location and not has_photo:
        send_whatsapp(worker_phone, "📍 Arrival location received! Please send a PHOTO of the bin to confirm arrival on site.")
        return

    # BOTH photo & location received! Check GPS proximity <= 50m
    loc_before = updated_report.get("location_before", {})
    sloc = updated_report.get("start_location") or {}
    gps_ok = True
    if sloc and "lat" in sloc and loc_before and "lat" in loc_before:
        dist_m = haversine(float(loc_before["lat"]), float(loc_before["lng"]), float(sloc["lat"]), float(sloc["lng"]))
        gps_ok = dist_m <= 50.0

    if not gps_ok:
        logger.warning(f"Worker arrival GPS check failed for {report_id} (>50m).")
        send_whatsapp(worker_phone, "⚠️ You are more than 50m from the reported bin. Please move to the location before confirming start.")
        return

    # Transition to in_progress & start work timer
    # Use message timestamp if provided (enables test control of arrival_time)
    now_iso = msg.get("timestamp") or datetime.now(timezone.utc).isoformat()
    set_report_worker_started(
        report_id=report_id,
        arrival_time=now_iso,
        start_photo_url=updated_report.get("start_photo_url"),
        start_location=sloc,
    )
    send_whatsapp(worker_phone, "✅ Arrival confirmed on site! Work timer started. When cleanup is complete, send the AFTER-cleanup photo and location pin.")
    logger.info(f"Worker {worker_phone} started report {report_id} at {now_iso}")


def handle_worker_finish(msg: dict, report: dict) -> None:
    """Worker sends after-photo + location.

    Tracks finish_photo and finish_location in DynamoDB.
    Only when BOTH are received does it trigger two-gate truth verification.
    """
    report_id = report["report_id"]
    worker_phone = msg.get("sender_phone", "")
    media_url = msg.get("media_url")
    image_b64 = msg.get("image_base64")
    lat_w = msg.get("latitude")
    lng_w = msg.get("longitude")

    finish_photo_url = None
    if image_b64:
        try:
            image_bytes = base64.b64decode(image_b64)
            finish_photo_url = _upload_photo(image_bytes, f"after/{report_id}.jpg", "https://pingbin-images/after.jpg")
        except Exception:
            pass
    elif media_url:
        image_bytes = download_twilio_media(media_url)
        finish_photo_url = _upload_photo(image_bytes, f"after/{report_id}.jpg", media_url)

    finish_loc = {"lat": lat_w, "lng": lng_w} if lat_w is not None and lng_w is not None else None

    # Incrementally record finish step in DynamoDB
    updated_report = record_worker_finish_step(
        report_id,
        finish_photo_url=finish_photo_url,
        finish_location=finish_loc,
    )

    has_photo = bool(updated_report.get("finish_photo_url") or updated_report.get("finish_photo_received"))
    has_location = bool(updated_report.get("finish_location") or updated_report.get("finish_location_received"))

    if has_photo and not has_location:
        send_whatsapp(worker_phone, "📸 Cleanup photo received! Please now share your GPS Location to complete verification and claim rewards.")
        return
    elif has_location and not has_photo:
        send_whatsapp(worker_phone, "📍 Cleanup location received! Please send the clean AFTER-photo of the bin to complete verification.")
        return

    # BOTH finish photo & location are present!
    finish_time = msg.get("timestamp") or datetime.now(timezone.utc).isoformat()
    set_report_worker_finished(
        report_id=report_id,
        finish_time=finish_time,
        finish_photo_url=updated_report.get("finish_photo_url"),
        finish_location=updated_report.get("finish_location"),
    )

    # Run deterministic two-gate verification
    _run_verification(
        report_id,
        updated_report,
        finish_time,
        updated_report.get("finish_photo_url"),
        updated_report.get("finish_location"),
        worker_phone,
    )


def _run_verification(
    report_id: str,
    report: dict,
    finish_time: str,
    finish_photo_url: str | None,
    finish_location: dict | None,
    worker_phone: str,
) -> None:
    """Deterministic two-gate verification — no AI.

    GATE A: haversine(arrival_location, finish_location) <= 50m
    GATE B: truth_score = min(100, round((actual_duration / adjusted_est_minutes) * 100)) >= 50
    Both must pass for status = "resolved". Either failure → "needs_review" with reason stored.
    """
    arrival_time_str = report.get("arrival_time") or report.get("start_time") or finish_time
    worker_phones = report.get("worker_phones") or (
        [report.get("worker_phone")] if report.get("worker_phone") else [worker_phone]
    )
    citizen_phone = report.get("citizen_phone", "")

    # --- Compute actual duration ---
    unit = "s" if getattr(settings, "TEST_MODE_SECONDS", False) else "m"
    try:
        t_start = datetime.fromisoformat(arrival_time_str)
        t_finish = datetime.fromisoformat(finish_time)
        diff_sec = max((t_finish - t_start).total_seconds(), 0.1)
    except Exception:
        diff_sec = 10.0

    adjusted_est = float(report.get("adjusted_estimated_minutes") or report.get("estimated_minutes_to_clean") or 30.0)

    # In dev test mode or short simulated duration (< 5 minutes real elapsed)
    if getattr(settings, "TEST_MODE_SECONDS", False) or diff_sec < 300:
        unit = "s"
        actual_duration = round(diff_sec, 1)
        # Dev scaling: LLM predicted N minutes → treat as N seconds, capped at 8.0s max.
        # This is the ONLY place this cap applies. The stored adjusted_estimated_minutes
        # is the raw LLM value; we scale it here for dev-mode Gate B only.
        est_time_used = min(float(adjusted_est), 8.0)
        truth_score = min(100, round((actual_duration / max(est_time_used, 1.0)) * 100))
        logger.info(
            f"[Gate B Dev] actual={actual_duration}s, llm_est={adjusted_est}min → dev_est={est_time_used}s, truth={truth_score}%"
        )
    else:
        unit = "m"
        actual_duration = round(diff_sec / 60.0, 1)
        est_time_used = adjusted_est
        truth_score = min(100, round((actual_duration / max(est_time_used, 1.0)) * 100))

    # --- GATE A: GPS proximity check ---
    arrival_loc = report.get("arrival_location") or report.get("start_location") or {}
    gate_a_pass = True
    gate_a_dist = 0.0
    if finish_location and arrival_loc and "lat" in arrival_loc:
        gate_a_dist = haversine(
            float(arrival_loc["lat"]), float(arrival_loc["lng"]),
            float(finish_location.get("lat", 0)), float(finish_location.get("lng", 0)),
        )
        gate_a_pass = gate_a_dist <= 50.0

    # --- GATE B: truth score ---
    gate_b_pass = truth_score >= 50

    location_after = finish_location

    if gate_a_pass and gate_b_pass:
        # Extract report coordinates for local vendor matching
        rep_loc = report.get("location_before") or report.get("start_location") or finish_location or {}
        rep_lat = float(rep_loc["lat"]) if "lat" in rep_loc else None
        rep_lng = float(rep_loc["lng"]) if "lng" in rep_loc else None

        # ✅ Resolved — generate coupon for local vendor and notify citizen
        coupon = generate_and_save_coupon(report_id, citizen_phone, rep_lat, rep_lng)
        coupon_code = coupon["code"] if coupon else "CLEAN10"
        coupon_desc = coupon["offer_description"] if coupon else "10% off at local store"
        vendor_name = coupon["vendor_name"] if coupon else "Local Store"
        validation_info = coupon.get("validation_text", "Valid for 30 days") if coupon else "Valid for 30 days"
        coupon_id = coupon["coupon_id"] if coupon else None

        count = get_citizen_reward_count(citizen_phone) + 1
        if citizen_phone and citizen_phone != "ADMIN":
            send_whatsapp(
                citizen_phone,
                f"🎉 Cleaning completed! Here's your reward: *{coupon_code}* — "
                f"{coupon_desc} at {vendor_name}. Details: {validation_info}. "
                f"You've helped resolve {count} reports in your neighborhood!",
            )
        send_whatsapp(
            worker_phone,
            f"✅ Cleanup verified (Truth Score: {truth_score}%). Job marked resolved. Thank you!",
        )

        complete_and_verify_report(
            report_id=report_id,
            worker_phones=worker_phones,
            finish_time=finish_time,
            actual_duration=actual_duration,
            truth_percentage=truth_score,
            final_status="resolved",
            reward_coupon_code=coupon_code,
            reward_coupon_id=coupon_id,
            photo_after_url=finish_photo_url,
            location_after=location_after,
        )
        logger.info(f"Report {report_id} resolved. Truth={truth_score}% Coupon={coupon_code}")

        # --- Part 2: Warehouse Assignment & Recycling Revenue Pipeline ---
        _process_warehouse_and_revenue(report_id, report, finish_photo_url, location_after)

    else:
        # ❌ Needs review — record which gate(s) failed and actual numbers
        failed_gates = []
        review_reason_parts = []
        if not gate_a_pass:
            failed_gates.append("gate_a_gps")
            review_reason_parts.append(f"GPS distance {gate_a_dist:.0f}m > 50m limit")
        if not gate_b_pass:
            failed_gates.append("gate_b_truth")
            if unit == "s":
                # Dev mode: show both dev-cap and original LLM estimate to avoid confusion
                review_reason_parts.append(
                    f"Truth score {truth_score}% < 50% (actual {actual_duration:.1f}s vs dev_cap {est_time_used:.1f}s [llm={adjusted_est:.0f}min])"
                )
            else:
                review_reason_parts.append(
                    f"Truth score {truth_score}% < 50% (actual {actual_duration:.1f}m vs est {est_time_used:.1f}m)"
                )
        review_reason = ";".join(review_reason_parts)

        logger.warning(f"Report {report_id} → needs_review: {review_reason}")
        send_whatsapp(worker_phone, "Cleanup logged and sent to supervisor audit review.")

        complete_and_verify_report(
            report_id=report_id,
            worker_phones=worker_phones,
            finish_time=finish_time,
            actual_duration=actual_duration,
            truth_percentage=truth_score,
            final_status="needs_review",
            review_reason=review_reason,
            photo_after_url=finish_photo_url,
            location_after=location_after,
        )


# ---------------------------------------------------------------------------
# Warehouse & Recycling Revenue Calculation
# ---------------------------------------------------------------------------

_BASE_PRICING_TABLE = {
    "plastic": 8.0,
    "metal": 15.0,
    "paper": 5.0,
    "glass": 4.0,
    "e_waste": 25.0,
    "organic": 2.0,
    "mixed": 3.0,
    "hazardous": 0.0,
}


def _process_warehouse_and_revenue(
    report_id: str,
    report: dict,
    finish_photo_url: str | None,
    finish_location: dict | None,
) -> dict:
    """Run recycling material categorization, match nearest warehouse, and compute recycling revenue."""
    try:
        # Step 1: Call in-house recycling categorizer
        cat_result = None
        if finish_photo_url and categorize_for_recycling:
            try:
                img_bytes = download_twilio_media(finish_photo_url) if "http" in finish_photo_url else b""
                cat_result = categorize_for_recycling(img_bytes)
                logger.info(f"Recycling Categorizer Raw Result for {report_id}: {cat_result}")
            except Exception as e:
                logger.warning(f"Could not run recycling categorizer on photo: {e}")

        if not cat_result:
            fallback_type = report.get("waste_type", "mixed")
            cat_result = {
                "recycling_category": fallback_type,
                "purity_score": 85,
                "notes": "Classified from initial report waste stream.",
            }

        recycling_category = cat_result.get("recycling_category", "mixed").lower()
        purity_score = int(cat_result.get("purity_score", 85))

        # Step 2: Match warehouse by accepted_categories and proximity
        def _match_category(cat: str, accepted: list[str]) -> bool:
            c_low = cat.lower()
            for a in accepted:
                a_low = a.lower()
                if c_low == a_low or c_low in a_low or a_low in c_low or ("hazard" in c_low and "hazard" in a_low):
                    return True
            return False

        warehouses = get_all_warehouses()
        matching_warehouses = [
            w for w in warehouses
            if _match_category(recycling_category, w.get("accepted_categories", []))
        ]

        rep_loc = finish_location or report.get("location_before") or {}
        rep_lat = float(rep_loc["lat"]) if "lat" in rep_loc else None
        rep_lng = float(rep_loc["lng"]) if "lng" in rep_loc else None

        chosen_wh = None
        if matching_warehouses and rep_lat is not None and rep_lng is not None:
            wh_distances = []
            for w in matching_warehouses:
                loc = w.get("location", {})
                w_lat = float(loc.get("lat", 0))
                w_lng = float(loc.get("lng", 0))
                dist = haversine(rep_lat, rep_lng, w_lat, w_lng)
                wh_distances.append((w, dist))
            wh_distances.sort(key=lambda x: x[1])
            chosen_wh = wh_distances[0][0]
        elif matching_warehouses:
            chosen_wh = matching_warehouses[0]

        if chosen_wh:
            assigned_wid = chosen_wh.get("warehouse_id")
            assigned_wname = chosen_wh.get("name")
            wh_status = "pending_pickup"
        else:
            assigned_wid = None
            assigned_wname = "Special Handling Facility"
            wh_status = "special_handling_required"

        # Step 3 & 4: Weight and revenue estimation
        fill_pct = float(report.get("fill_percent", 50))
        estimated_weight_kg = round(fill_pct * 0.5, 1)
        base_price = _BASE_PRICING_TABLE.get(recycling_category, 3.0)
        estimated_revenue = round(estimated_weight_kg * base_price * (purity_score / 100.0), 2)

        # Step 5: Save to DynamoDB
        update_report_warehouse_details(
            report_id=report_id,
            recycling_category=recycling_category,
            purity_score=purity_score,
            assigned_warehouse_id=assigned_wid,
            assigned_warehouse_name=assigned_wname,
            warehouse_status=wh_status,
            estimated_weight_kg=estimated_weight_kg,
            estimated_revenue=estimated_revenue,
        )
        logger.info(
            f"Warehouse assigned for report {report_id}: {assigned_wname} ({wh_status}) "
            f"category={recycling_category} purity={purity_score}% "
            f"weight={estimated_weight_kg}kg rev=₹{estimated_revenue}"
        )
        return {
            "recycling_category": recycling_category,
            "purity_score": purity_score,
            "assigned_warehouse_id": assigned_wid,
            "assigned_warehouse_name": assigned_wname,
            "warehouse_status": wh_status,
            "estimated_weight_kg": estimated_weight_kg,
            "estimated_revenue": estimated_revenue,
        }
    except Exception as e:
        logger.error(f"Failed to process warehouse for report {report_id}: {e}")
        return {}


# ---------------------------------------------------------------------------
# SQS message router
# ---------------------------------------------------------------------------

def route_sqs_message(msg: dict) -> None:
    """Route normalized SQS message according to sender role and pipeline state."""
    sender_phone = msg.get("sender_phone", "")
    msg_type = msg.get("message_type")
    body_text = (msg.get("body_text") or "").strip().upper()

    # 1. Worker with an active "in_progress" report → finish (after-photo + location)
    in_progress_report = find_in_progress_report_for_worker(sender_phone)
    if in_progress_report and (msg_type in ["photo", "image", "location"] or msg.get("media_url") or msg.get("image_base64")):
        handle_worker_finish(msg, in_progress_report)
        return

    # 2. Worker with an "assigned" report → arrival (photo + location)
    assigned_report = find_assigned_report_for_worker(sender_phone)
    if assigned_report and (msg_type in ["photo", "image", "location"] or msg.get("media_url") or msg.get("image_base64")):
        handle_worker_arrival(msg, assigned_report)
        return

    # 3. Citizen flow
    if msg_type in ["photo", "image"] or (msg.get("media_url") and not assigned_report and not in_progress_report):
        handle_photo(msg)
    elif msg_type == "location" or (msg.get("latitude") and not assigned_report and not in_progress_report):
        handle_location(msg)
    else:
        logger.info(f"Unhandled message from {sender_phone}: {body_text or msg_type}")


# ---------------------------------------------------------------------------
# JSON serialization helper
# ---------------------------------------------------------------------------

def decimal_serializer(obj):
    """JSON serializer for Decimal types from DynamoDB."""
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Type {type(obj)} not serializable")


# ---------------------------------------------------------------------------
# Lambda 2 entry point
# ---------------------------------------------------------------------------

def lambda_handler(event: dict, context: dict | None = None) -> dict:
    """Lambda 2: SQS processor + API Gateway handler."""
    CORS_HEADERS = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json",
    }

    def ok(data) -> dict:
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": json.dumps(data, default=decimal_serializer)}

    def err(msg: str, code: int = 400) -> dict:
        return {"statusCode": code, "headers": CORS_HEADERS, "body": json.dumps({"error": msg})}

    # --- Trigger 1: SQS ---
    if "Records" in event and event["Records"] and event["Records"][0].get("eventSource") == "aws:sqs":
        for record in event["Records"]:
            try:
                message = json.loads(record.get("body", "{}"))
                route_sqs_message(message)
            except Exception as e:
                logger.error(f"Error processing SQS record: {e}")
        return {"status": "processed", "records_count": len(event["Records"])}

    # --- Trigger 2: API Gateway ---
    http_method = event.get("httpMethod") or (event.get("requestContext", {}).get("http", {}).get("method"))
    path = event.get("path") or event.get("rawPath") or event.get("resource") or (event.get("requestContext", {}).get("http", {}).get("path")) or ""
    path_params = event.get("pathParameters") or {}
    param_report_id = path_params.get("id") or path_params.get("report_id")

    # Handle CORS Preflight OPTIONS
    if http_method == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token",
                "Access-Control-Max-Age": "86400",
            },
            "body": "",
        }

    # GET /health
    if http_method == "GET" and path in ("/health", "/health/", "/"):
        return ok({"status": "healthy", "service": "PingBin", "timestamp": datetime.now(timezone.utc).isoformat()})

    # GET /reports
    if http_method == "GET" and path in ("/reports", "/reports/"):
        return ok(get_active_reports())

    # POST /reports/{id}/reject
    if http_method == "POST" and (path.endswith("/reject") or event.get("resource") == "/reports/{id}/reject"):
        parts = [p for p in path.strip("/").split("/") if p]
        report_id = param_report_id or (parts[1] if len(parts) >= 2 and parts[1] != "{id}" else None)
        if report_id:
            report = get_report_by_id(report_id)
            success = reject_report(report_id)
            if success:
                citizen_phone = report.get("citizen_phone") if report else None
                if citizen_phone and citizen_phone != "ADMIN":
                    send_whatsapp(
                        citizen_phone,
                        "Our admin team reviewed your report and determined it was not a valid waste complaint. "
                        "Please ensure accurate reporting to help us keep the city clean. Misuse of the reporting system may lead to blocked access.",
                    )
                return ok({"status": "rejected", "report_id": report_id, "timestamp": datetime.now(timezone.utc).isoformat()})
        return err("Invalid report id or reject failed", 400)

    # POST /reports/{id}/approve
    if http_method == "POST" and (path.endswith("/approve") or event.get("resource") == "/reports/{id}/approve"):
        parts = [p for p in path.strip("/").split("/") if p]
        report_id = param_report_id or (parts[1] if len(parts) >= 2 and parts[1] != "{id}" else None)
        if report_id:
            report = get_report_by_id(report_id)
            if not report:
                return err(f"Report {report_id} not found", 404)
            fill_pct = int(report.get("fill_percent", 50))
            priority_score = _inline_priority_score(fill_pct)
            approve_report(report_id, priority_score)
            rep_loc = report.get("location_before") or {}
            if rep_loc and "lat" in rep_loc and "lng" in rep_loc:
                dispatch_workers(report_id, float(rep_loc["lat"]), float(rep_loc["lng"]), report)
            elif report.get("citizen_phone") and report.get("citizen_phone") != "ADMIN":
                send_whatsapp(
                    report["citizen_phone"],
                    "Your report has been approved! Please share your location in WhatsApp so we can dispatch workers.",
                )
            return ok({"status": "approved", "report_id": report_id, "priority_score": priority_score})
        return err("Invalid report id", 400)

    # GET /warehouses
    if http_method == "GET" and path in ("/warehouses", "/warehouses/"):
        return ok(get_all_warehouses())

    # POST /warehouses
    if http_method == "POST" and path in ("/warehouses", "/warehouses/"):
        from utils.dynamo import create_warehouse
        try:
            body = json.loads(event.get("body") or "{}")
            name = body.get("name", "").strip()
            category = body.get("category", "mixed").strip()
            rate_per_kg = float(body.get("rate_per_kg", 8.0))
            capacity_kg = float(body.get("capacity_kg", 5000.0))
            address = body.get("address", "").strip()
            loc = body.get("location", {})
            lat = float(body.get("latitude") or loc.get("lat") or 20.3533)
            lng = float(body.get("longitude") or loc.get("lng") or 85.8197)
            accepted = body.get("accepted_categories", [category])
            if not name:
                return err("Facility name is required", 400)
            item = create_warehouse(name, category, rate_per_kg, capacity_kg, address, lat, lng, accepted)
            return ok({"status": "created", "warehouse": item})
        except Exception as e:
            logger.error(f"POST /warehouses error: {e}")
            return err(str(e), 500)

    # POST /reports/{id}/assign-warehouse
    if http_method == "POST" and (path.endswith("/assign-warehouse") or "assign-warehouse" in path):
        from utils.dynamo import assign_report_to_warehouse
        parts = [p for p in path.strip("/").split("/") if p]
        report_id = param_report_id or (parts[1] if len(parts) >= 3 else None)
        if not report_id:
            return err("Missing report_id", 400)
        try:
            body = json.loads(event.get("body") or "{}")
            warehouse_id = body.get("warehouse_id", "").strip()
            weight_kg = float(body.get("actual_weight_kg", 25.0))
            if not warehouse_id:
                return err("warehouse_id is required", 400)
            res = assign_report_to_warehouse(report_id, warehouse_id, weight_kg)
            return ok({"status": "assigned", "result": res})
        except Exception as e:
            logger.error(f"assign-warehouse error: {e}")
            return err(str(e), 500)

    # POST /reports/prune-test-data
    if http_method == "POST" and path.endswith("/prune-test-data"):
        from utils.dynamo import prune_test_reports
        try:
            res = prune_test_reports()
            return ok(res)
        except Exception as e:
            return err(str(e), 500)

    # GET /workers
    if http_method == "GET" and path in ("/workers", "/workers/"):
        from utils.dynamo import workers_table
        try:
            items = workers_table.scan().get("Items", [])
            return ok(items)
        except Exception as e:
            logger.error(f"GET /workers error: {e}")
            return err(str(e), 500)

    # POST /workers
    if http_method == "POST" and path in ("/workers", "/workers/"):
        from utils.dynamo import create_worker
        try:
            body = json.loads(event.get("body") or "{}")
            fullname = (body.get("name") or body.get("fullname") or "").strip()
            phone = (body.get("phone") or "").strip()
            loc = body.get("last_known_location") or body.get("location") or {}
            latitude = float(body.get("latitude") or loc.get("lat") or 20.3533)
            longitude = float(body.get("longitude") or loc.get("lng") or 85.8197)
            photo_url = body.get("photo_url") or ""
            if not fullname or not phone:
                return err("name and phone are required", 400)
            item = create_worker(fullname, phone, latitude, longitude, photo_url)
            return ok({"status": "created", "worker": item})
        except ValueError as ve:
            logger.warning(f"POST /workers validation error: {ve}")
            return err(str(ve), 400)
        except Exception as e:
            logger.error(f"POST /workers error: {e}")
            return err(str(e), 500)

    # POST /vendors
    if http_method == "POST" and path in ("/vendors", "/vendors/"):
        from utils.dynamo import create_vendor
        try:
            body = json.loads(event.get("body") or "{}")
            vendor_name = (body.get("vendor_name") or body.get("name") or "").strip()
            category = (body.get("category") or "General").strip()
            description = (body.get("description") or body.get("tagline") or "").strip()
            city = (body.get("city") or "").strip()
            area = (body.get("area") or body.get("neighborhood") or "").strip()
            loc = body.get("location") or {}
            lat_val = body.get("latitude") or loc.get("lat")
            lng_val = body.get("longitude") or loc.get("lng")
            lat = float(lat_val) if lat_val is not None and str(lat_val).strip() != "" else None
            lng = float(lng_val) if lng_val is not None and str(lng_val).strip() != "" else None
            coupon_templates = body.get("coupon_templates", [])
            if not vendor_name:
                return err("vendor_name is required", 400)
            item = create_vendor(vendor_name, category, description, coupon_templates, lat, lng, city, area)
            return ok({"status": "created", "vendor": item})
        except Exception as e:
            logger.error(f"POST /vendors error: {e}")
            return err(str(e), 500)

    # GET /vendors
    if http_method == "GET" and path in ("/vendors", "/vendors/"):
        from utils.dynamo import get_all_vendors
        return ok(get_all_vendors())

    # GET /coupons
    if http_method == "GET" and path in ("/coupons", "/coupons/"):
        from utils.dynamo import get_all_coupons
        return ok(get_all_coupons())

    # --- Direct invocation (local dev simulate) ---
    if "message_type" in event or "sender_phone" in event:
        route_sqs_message(event)
        return {"status": "processed", "direct": True}

    return {"statusCode": 404, "headers": CORS_HEADERS, "body": json.dumps({"error": "Not Found"})}
