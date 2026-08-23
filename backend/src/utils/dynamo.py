import logging
import random
import string
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from boto3.dynamodb.conditions import Attr
from config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# DynamoDB table handles — module-level, reused across Lambda warm invocations
# ---------------------------------------------------------------------------
try:
    session = settings.get_boto3_session()
    dynamodb = session.resource("dynamodb")
    reports_table = dynamodb.Table(settings.DYNAMODB_TABLE_REPORTS)
    workers_table = dynamodb.Table(settings.DYNAMODB_TABLE_WORKERS)
    vendors_table = dynamodb.Table(settings.DYNAMODB_TABLE_VENDORS)
    coupons_table = dynamodb.Table(settings.DYNAMODB_TABLE_COUPONS)
    warehouses_table = dynamodb.Table(settings.DYNAMODB_TABLE_WAREHOUSES)
except Exception as e:
    logger.warning(f"Failed to initialize DynamoDB tables: {e}")
    dynamodb = None
    reports_table = None
    workers_table = None
    vendors_table = None
    coupons_table = None
    warehouses_table = None


# ===========================================================================
# REPORTS
# ===========================================================================

def save_raw_pending_report(report_id: str, citizen_phone: str, timestamp: str) -> dict:
    """ACID Step 1: Atomically insert initial raw pending report into DynamoDB."""
    item = {
        "report_id": report_id,
        "citizen_phone": citizen_phone,
        "worker_phone": None,
        "worker_phones": [],
        "assigned_workers_count": 0,
        "photo_before_url": "",
        "photo_after_url": None,
        "start_photo_url": None,
        "finish_photo_url": None,
        "location_before": {},
        "location_after": None,
        "start_location": None,
        "finish_location": None,
        "waste_type": "unknown",
        "fill_percent": Decimal("0"),
        "urgency": "medium",
        "priority_score": None,
        "estimated_workers_needed": 1,
        "estimated_minutes_to_clean": 30,
        "original_estimated_minutes": 30,
        "adjusted_estimated_minutes": None,
        "recalculated_estimated_time": None,
        "arrival_time": None,
        "finish_time": None,
        "actual_duration": None,
        "truth_percentage": None,
        "review_reason": None,
        "reward_coupon_code": None,
        "reward_coupon_id": None,
        "confidence": None,
        "suspicious_flag": False,
        "segregation_quality": "unknown",
        "recycling_category": None,
        "purity_score": None,
        "assigned_warehouse_id": None,
        "assigned_warehouse_name": None,
        "warehouse_status": None,
        "estimated_weight_kg": None,
        "estimated_revenue": None,
        "rejected_at": None,
        "has_photo": False,
        "has_location": False,
        "intake_started_at": timestamp,
        "status": "pending",
        "created_at": timestamp,
    }
    if reports_table:
        reports_table.put_item(Item=item)
    return item


def create_awaiting_location_report(
    report_id: str,
    citizen_phone: str,
    photo_before_url: str,
    classification: dict,
    timestamp: str,
) -> dict:
    """Create intake report when citizen sends PHOTO first."""
    confidence = int(classification.get("confidence", 85))
    suspicious_flag = bool(classification.get("suspicious_flag", False))
    status = "pending_admin_review" if (confidence < 25 or suspicious_flag) else "awaiting_location"

    item = {
        "report_id": report_id,
        "citizen_phone": citizen_phone,
        "worker_phone": None,
        "worker_phones": [],
        "assigned_workers_count": 0,
        "photo_before_url": photo_before_url,
        "photo_after_url": None,
        "start_photo_url": None,
        "finish_photo_url": None,
        "location_before": {},
        "location_after": None,
        "start_location": None,
        "finish_location": None,
        "waste_type": classification.get("waste_type", "mixed"),
        "fill_percent": Decimal(str(classification.get("fill_percent", 50))),
        "urgency": classification.get("urgency", "medium"),
        "priority_score": None,
        "estimated_workers_needed": int(classification.get("estimated_workers_needed", 1)),
        "estimated_minutes_to_clean": int(classification.get("estimated_minutes_to_clean", 30)),
        "original_estimated_minutes": int(classification.get("estimated_minutes_to_clean", 30)),
        "adjusted_estimated_minutes": None,
        "recalculated_estimated_time": None,
        "arrival_time": None,
        "finish_time": None,
        "actual_duration": None,
        "truth_percentage": None,
        "review_reason": None,
        "reward_coupon_code": None,
        "reward_coupon_id": None,
        "confidence": confidence,
        "suspicious_flag": suspicious_flag,
        "segregation_quality": str(classification.get("segregation_quality", "mixed")),
        "recycling_category": None,
        "purity_score": None,
        "assigned_warehouse_id": None,
        "assigned_warehouse_name": None,
        "warehouse_status": None,
        "estimated_weight_kg": None,
        "estimated_revenue": None,
        "rejected_at": None,
        "has_photo": True,
        "has_location": False,
        "intake_started_at": timestamp,
        "status": status,
        "created_at": timestamp,
    }
    if reports_table:
        reports_table.put_item(Item=item)
    return item


def create_awaiting_photo_report(
    report_id: str,
    citizen_phone: str,
    lat: float,
    lng: float,
    timestamp: str,
) -> dict:
    """Create intake report when citizen sends LOCATION first."""
    item = {
        "report_id": report_id,
        "citizen_phone": citizen_phone,
        "worker_phone": None,
        "worker_phones": [],
        "assigned_workers_count": 0,
        "photo_before_url": "",
        "photo_after_url": None,
        "start_photo_url": None,
        "finish_photo_url": None,
        "location_before": {
            "lat": Decimal(str(lat)),
            "lng": Decimal(str(lng)),
        },
        "location_after": None,
        "start_location": None,
        "finish_location": None,
        "waste_type": "unknown",
        "fill_percent": Decimal("0"),
        "urgency": "medium",
        "priority_score": None,
        "estimated_workers_needed": 1,
        "estimated_minutes_to_clean": 30,
        "original_estimated_minutes": 30,
        "adjusted_estimated_minutes": None,
        "recalculated_estimated_time": None,
        "arrival_time": None,
        "finish_time": None,
        "actual_duration": None,
        "truth_percentage": None,
        "review_reason": None,
        "reward_coupon_code": None,
        "reward_coupon_id": None,
        "confidence": None,
        "suspicious_flag": False,
        "segregation_quality": "unknown",
        "recycling_category": None,
        "purity_score": None,
        "assigned_warehouse_id": None,
        "assigned_warehouse_name": None,
        "warehouse_status": None,
        "estimated_weight_kg": None,
        "estimated_revenue": None,
        "rejected_at": None,
        "has_photo": False,
        "has_location": True,
        "intake_started_at": timestamp,
        "status": "awaiting_photo",
        "created_at": timestamp,
    }
    if reports_table:
        reports_table.put_item(Item=item)
    return item


def expire_report(report_id: str) -> None:
    """Mark an incomplete intake report as expired after 5-minute timeout."""
    if not reports_table:
        return
    reports_table.update_item(
        Key={"report_id": report_id},
        UpdateExpression="SET #s = :s",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":s": "expired"},
    )


def find_active_intake_by_phone(phone: str, timeout_seconds: int = 150) -> tuple[dict | None, bool]:
    """
    Find active intake report for a citizen (awaiting_photo, awaiting_location, pending_admin_review).
    If older than timeout_seconds (2.5 min), marks status='expired' and returns (None, True).
    """
    if not reports_table:
        return (None, False)
    try:
        response = reports_table.scan(
            FilterExpression=Attr("citizen_phone").eq(phone)
            & Attr("status").is_in(["awaiting_photo", "awaiting_location", "pending_admin_review"])
        )
        items = response.get("Items", [])
        if not items:
            return (None, False)

        # Sort by creation time desc
        items.sort(key=lambda x: x.get("intake_started_at") or x.get("created_at") or "", reverse=True)
        latest = items[0]

        # Check timeout for incomplete awaiting states
        if latest.get("status") in ["awaiting_photo", "awaiting_location"]:
            started_at_str = latest.get("intake_started_at") or latest.get("created_at")
            if started_at_str:
                try:
                    started_dt = datetime.fromisoformat(started_at_str.replace("Z", "+00:00"))
                    now_dt = datetime.now(timezone.utc)
                    if (now_dt - started_dt).total_seconds() > timeout_seconds:
                        logger.info(f"Report {latest['report_id']} timed out after 5 mins — marking expired")
                        expire_report(latest["report_id"])
                        return (None, True)
                except Exception as e:
                    logger.warning(f"Error parsing intake timestamp: {e}")

        return (latest, False)
    except Exception as e:
        logger.error(f"Error finding active intake for {phone}: {e}")
        return (None, False)


def complete_intake_photo_step(
    report_id: str,
    photo_before_url: str,
    classification: dict,
    priority_score: float | None = None,
) -> dict:
    """Record second piece (Photo) on an existing awaiting_photo report."""
    if not reports_table:
        return {}
    confidence = int(classification.get("confidence", 85))
    suspicious_flag = bool(classification.get("suspicious_flag", False))
    status = "pending_admin_review" if (confidence < 25 or suspicious_flag) else "pending"

    update_expr = (
        "SET photo_before_url = :pbu, waste_type = :wt, fill_percent = :fp, "
        "urgency = :u, estimated_workers_needed = :ewn, "
        "estimated_minutes_to_clean = :emc, original_estimated_minutes = :oem, "
        "confidence = :conf, suspicious_flag = :susp, segregation_quality = :seg, "
        "has_photo = :hp, #s = :s"
    )
    expr_vals: dict = {
        ":pbu": photo_before_url,
        ":wt": classification.get("waste_type", "mixed"),
        ":fp": Decimal(str(classification.get("fill_percent", 50))),
        ":u": classification.get("urgency", "medium"),
        ":ewn": int(classification.get("estimated_workers_needed", 1)),
        ":emc": int(classification.get("estimated_minutes_to_clean", 30)),
        ":oem": int(classification.get("estimated_minutes_to_clean", 30)),
        ":conf": confidence,
        ":susp": suspicious_flag,
        ":seg": str(classification.get("segregation_quality", "mixed")),
        ":hp": True,
        ":s": status,
    }
    if priority_score is not None and status != "pending_admin_review":
        update_expr += ", priority_score = :ps"
        expr_vals[":ps"] = Decimal(str(priority_score))

    reports_table.update_item(
        Key={"report_id": report_id},
        UpdateExpression=update_expr,
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues=expr_vals,
    )
    return get_report_by_id(report_id) or {}


def complete_intake_location_step(
    report_id: str,
    lat: float,
    lng: float,
    priority_score: float | None = None,
) -> dict:
    """Record second piece (Location) on an existing awaiting_location report."""
    if not reports_table:
        return {}
    current = get_report_by_id(report_id) or {}
    new_status = "pending_admin_review" if current.get("status") == "pending_admin_review" else "pending"

    update_expr = "SET location_before = :loc, has_location = :hl, #s = :s"
    expr_vals: dict = {
        ":loc": {
            "lat": Decimal(str(lat)),
            "lng": Decimal(str(lng)),
        },
        ":hl": True,
        ":s": new_status,
    }
    if priority_score is not None and new_status != "pending_admin_review":
        update_expr += ", priority_score = :ps"
        expr_vals[":ps"] = Decimal(str(priority_score))

    reports_table.update_item(
        Key={"report_id": report_id},
        UpdateExpression=update_expr,
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues=expr_vals,
    )
    return get_report_by_id(report_id) or {}


def update_report_classification(
    report_id: str,
    photo_before_url: str,
    waste_type: str,
    fill_percent: int,
    urgency: str,
    priority_score: float,
    estimated_workers_needed: int,
    estimated_minutes_to_clean: int,
    confidence: int = 85,
    suspicious_flag: bool = False,
    segregation_quality: str = "mixed",
) -> None:
    """Update DynamoDB report with AI classification results and computed priority score."""
    if not reports_table:
        return
    reports_table.update_item(
        Key={"report_id": report_id},
        UpdateExpression=(
            "SET photo_before_url = :pbu, waste_type = :wt, fill_percent = :fp, "
            "urgency = :u, priority_score = :ps, estimated_workers_needed = :ewn, "
            "estimated_minutes_to_clean = :emc, original_estimated_minutes = :oem, "
            "confidence = :conf, suspicious_flag = :susp, segregation_quality = :seg, "
            "has_photo = :hp, #s = :s"
        ),
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={
            ":pbu": photo_before_url,
            ":wt": waste_type,
            ":fp": Decimal(str(fill_percent)),
            ":u": urgency,
            ":ps": Decimal(str(priority_score)),
            ":ewn": estimated_workers_needed,
            ":emc": estimated_minutes_to_clean,
            ":oem": estimated_minutes_to_clean,
            ":conf": confidence,
            ":susp": suspicious_flag,
            ":seg": segregation_quality,
            ":hp": True,
            ":s": "pending",
        },
    )


def set_report_pending_admin_review(
    report_id: str,
    photo_before_url: str,
    classification: dict,
) -> None:
    """Mark report as pending_admin_review due to low confidence (<25%) or suspicion."""
    if not reports_table:
        return
    reports_table.update_item(
        Key={"report_id": report_id},
        UpdateExpression=(
            "SET photo_before_url = :pbu, waste_type = :wt, fill_percent = :fp, "
            "urgency = :u, estimated_workers_needed = :ewn, "
            "estimated_minutes_to_clean = :emc, original_estimated_minutes = :oem, "
            "confidence = :conf, suspicious_flag = :susp, segregation_quality = :seg, "
            "has_photo = :hp, #s = :s"
        ),
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={
            ":pbu": photo_before_url,
            ":wt": classification.get("waste_type", "mixed"),
            ":fp": Decimal(str(classification.get("fill_percent", 50))),
            ":u": classification.get("urgency", "medium"),
            ":ewn": int(classification.get("estimated_workers_needed", 1)),
            ":emc": int(classification.get("estimated_minutes_to_clean", 30)),
            ":oem": int(classification.get("estimated_minutes_to_clean", 30)),
            ":conf": int(classification.get("confidence", 0)),
            ":susp": bool(classification.get("suspicious_flag", True)),
            ":seg": str(classification.get("segregation_quality", "mixed")),
            ":hp": True,
            ":s": "pending_admin_review",
        },
    )


def reject_report(report_id: str) -> bool:
    """Permanently reject a pending_admin_review report."""
    if not reports_table:
        return False
    now_iso = datetime.now(timezone.utc).isoformat()
    reports_table.update_item(
        Key={"report_id": report_id},
        UpdateExpression="SET #s = :s, rejected_at = :ra",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={
            ":s": "rejected",
            ":ra": now_iso,
        },
    )
    return True


def approve_report(report_id: str, priority_score: float) -> bool:
    """Approve a pending_admin_review report and set status to pending with priority_score."""
    if not reports_table:
        return False
    reports_table.update_item(
        Key={"report_id": report_id},
        UpdateExpression="SET #s = :s, priority_score = :ps",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={
            ":s": "pending",
            ":ps": Decimal(str(priority_score)),
        },
    )
    return True


def flag_report_classification_error(report_id: str, reason: str = "classification_error") -> None:
    """Mark a report as needs_review with a classification-failure reason."""
    if not reports_table:
        return
    reports_table.update_item(
        Key={"report_id": report_id},
        UpdateExpression="SET #s = :s, review_reason = :rr",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":s": "needs_review", ":rr": reason},
    )


def find_pending_report_by_phone(phone: str, window_minutes: int = 5) -> dict | None:
    """Find the most recent pending or awaiting report from the given phone number within the time window."""
    active, is_timed_out = find_active_intake_by_phone(phone, timeout_seconds=window_minutes * 60)
    return active


def update_report_location(report_id: str, lat: float, lng: float) -> None:
    """Update report with citizen's shared location coordinates."""
    if not reports_table:
        return
    reports_table.update_item(
        Key={"report_id": report_id},
        UpdateExpression="SET location_before = :loc, has_location = :hl",
        ExpressionAttributeValues={
            ":loc": {
                "lat": Decimal(str(lat)),
                "lng": Decimal(str(lng)),
            },
            ":hl": True,
        },
    )

def get_report_by_id(report_id: str) -> dict | None:
    """Retrieve a single report item by its report_id."""
    if not reports_table:
        return None
    try:
        res = reports_table.get_item(Key={"report_id": report_id})
        return res.get("Item")
    except Exception as e:
        logger.error(f"Error fetching report {report_id}: {e}")
        return None


def assign_workers_to_report(
    report_id: str,
    worker_ids: list[str],
    worker_phones: list[str],
    assigned_count: int,
    original_estimated_minutes: float,
    adjusted_estimated_minutes: float | None = None,
    recalculated_estimated_time: float | None = None,
) -> None:
    """Assign multi-workers to report, store both original + adjusted estimates."""
    if reports_table:
        update_expr = (
            "SET #s = :s, worker_phone = :wp, worker_phones = :wps, "
            "assigned_workers_count = :awc, original_estimated_minutes = :oem"
        )
        expr_vals: dict = {
            ":s": "assigned",
            ":wp": worker_phones[0] if worker_phones else None,
            ":wps": worker_phones,
            ":awc": assigned_count,
            ":oem": Decimal(str(round(original_estimated_minutes, 2))),
        }
        if adjusted_estimated_minutes is not None:
            update_expr += ", adjusted_estimated_minutes = :aem"
            expr_vals[":aem"] = Decimal(str(round(adjusted_estimated_minutes, 2)))
        if recalculated_estimated_time is not None:
            update_expr += ", recalculated_estimated_time = :ret"
            expr_vals[":ret"] = Decimal(str(round(recalculated_estimated_time, 2)))

        reports_table.update_item(
            Key={"report_id": report_id},
            UpdateExpression=update_expr,
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues=expr_vals,
        )

    if workers_table:
        for wid in worker_ids:
            try:
                workers_table.update_item(
                    Key={"worker_id": wid},
                    UpdateExpression="SET #s = :s",
                    ExpressionAttributeNames={"#s": "status"},
                    ExpressionAttributeValues={":s": "busy"},
                )
            except Exception as e:
                logger.error(f"Error marking worker {wid} busy: {e}")


def find_assigned_report_for_worker(worker_phone: str) -> dict | None:
    """Find the active assigned report where worker_phone is assigned, prioritized by most recent."""
    if not reports_table:
        return None
    try:
        response = reports_table.scan(FilterExpression=Attr("status").eq("assigned"))
        items = response.get("Items", [])
        items_sorted = sorted(items, key=lambda x: x.get("created_at") or "", reverse=True)
        for item in items_sorted:
            phones = item.get("worker_phones", [])
            single = item.get("worker_phone")
            if worker_phone == single or worker_phone in phones:
                return item
    except Exception as e:
        logger.error(f"Error finding assigned report for worker: {e}")
    return None


def find_in_progress_report_for_worker(worker_phone: str) -> dict | None:
    """Find the in_progress report where worker_phone is working, prioritized by most recent."""
    if not reports_table:
        return None
    try:
        response = reports_table.scan(FilterExpression=Attr("status").eq("in_progress"))
        items = response.get("Items", [])
        items_sorted = sorted(items, key=lambda x: x.get("created_at") or "", reverse=True)
        for item in items_sorted:
            phones = item.get("worker_phones", [])
            single = item.get("worker_phone")
            if worker_phone == single or worker_phone in phones:
                return item
    except Exception as e:
        logger.error(f"Error finding in_progress report for worker: {e}")
    return None


def record_worker_arrival_step(
    report_id: str,
    start_photo_url: str | None = None,
    start_location: dict | None = None,
) -> dict:
    """Incrementally record arrival photo or arrival location step in DynamoDB."""
    if not reports_table:
        return {}
    set_clauses = []
    expr_vals: dict = {}
    if start_photo_url:
        set_clauses.append("start_photo_url = :spu")
        set_clauses.append("arrival_photo_received = :apr")
        expr_vals[":spu"] = start_photo_url
        expr_vals[":apr"] = True
    if start_location:
        set_clauses.append("start_location = :sloc")
        set_clauses.append("arrival_location = :sloc")
        set_clauses.append("arrival_location_received = :alr")
        expr_vals[":sloc"] = {
            "lat": Decimal(str(start_location.get("lat", 0))),
            "lng": Decimal(str(start_location.get("lng", 0))),
        }
        expr_vals[":alr"] = True

    if set_clauses:
        reports_table.update_item(
            Key={"report_id": report_id},
            UpdateExpression="SET " + ", ".join(set_clauses),
            ExpressionAttributeValues=expr_vals,
        )
    return get_report_by_id(report_id) or {}


def record_worker_finish_step(
    report_id: str,
    finish_photo_url: str | None = None,
    finish_location: dict | None = None,
) -> dict:
    """Incrementally record finish photo or finish location step in DynamoDB."""
    if not reports_table:
        return {}
    set_clauses = []
    expr_vals: dict = {}
    if finish_photo_url:
        set_clauses.append("finish_photo_url = :fpu")
        set_clauses.append("photo_after_url = :fpu")
        set_clauses.append("finish_photo_received = :fpr")
        expr_vals[":fpu"] = finish_photo_url
        expr_vals[":fpr"] = True
    if finish_location:
        set_clauses.append("finish_location = :floc")
        set_clauses.append("location_after = :floc")
        set_clauses.append("finish_location_received = :flr")
        expr_vals[":floc"] = {
            "lat": Decimal(str(finish_location.get("lat", 0))),
            "lng": Decimal(str(finish_location.get("lng", 0))),
        }
        expr_vals[":flr"] = True

    if set_clauses:
        reports_table.update_item(
            Key={"report_id": report_id},
            UpdateExpression="SET " + ", ".join(set_clauses),
            ExpressionAttributeValues=expr_vals,
        )
    return get_report_by_id(report_id) or {}


def set_report_worker_started(
    report_id: str,
    arrival_time: str,
    start_photo_url: str | None = None,
    start_location: dict | None = None,
) -> None:
    """Record worker arrival: photo, location, arrival_time. Status -> in_progress."""
    if not reports_table:
        return
    update_expr = "SET #s = :s, arrival_time = :at, start_time = :at, arrival_photo_received = :apr, arrival_location_received = :alr"
    expr_vals: dict = {
        ":s": "in_progress",
        ":at": arrival_time,
        ":apr": True,
        ":alr": True,
    }
    if start_photo_url:
        update_expr += ", start_photo_url = :spu"
        expr_vals[":spu"] = start_photo_url
    if start_location:
        update_expr += ", start_location = :sloc, arrival_location = :sloc"
        expr_vals[":sloc"] = {
            "lat": Decimal(str(start_location.get("lat", 0))),
            "lng": Decimal(str(start_location.get("lng", 0))),
        }

    reports_table.update_item(
        Key={"report_id": report_id},
        UpdateExpression=update_expr,
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues=expr_vals,
    )


def set_report_worker_finished(
    report_id: str,
    finish_time: str,
    finish_photo_url: str | None = None,
    finish_location: dict | None = None,
) -> None:
    """Record worker finish: photo, location, finish_time. Status -> pending_verification."""
    if not reports_table:
        return
    update_expr = "SET #s = :s, finish_time = :ft"
    expr_vals: dict = {
        ":s": "pending_verification",
        ":ft": finish_time,
    }
    if finish_photo_url:
        update_expr += ", finish_photo_url = :fpu, photo_after_url = :fpu"
        expr_vals[":fpu"] = finish_photo_url
    if finish_location:
        update_expr += ", finish_location = :fl, location_after = :fl"
        expr_vals[":fl"] = {
            "lat": Decimal(str(finish_location.get("lat", 0))),
            "lng": Decimal(str(finish_location.get("lng", 0))),
        }

    reports_table.update_item(
        Key={"report_id": report_id},
        UpdateExpression=update_expr,
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues=expr_vals,
    )


def complete_and_verify_report(
    report_id: str,
    worker_phones: list[str],
    finish_time: str,
    actual_duration: float,
    truth_percentage: int,
    final_status: str,
    review_reason: str | None = None,
    photo_after_url: str | None = None,
    location_after: dict | None = None,
    reward_coupon_code: str | None = None,
    reward_coupon_id: str | None = None,
) -> None:
    """Finalize report after verification — set resolved or needs_review, free workers."""
    if reports_table:
        update_expr = (
            "SET #s = :s, finish_time = :ft, actual_duration = :ad, "
            "truth_percentage = :tp"
        )
        expr_values: dict = {
            ":s": final_status,
            ":ft": finish_time,
            ":ad": Decimal(str(round(actual_duration, 2))),
            ":tp": truth_percentage,
        }
        if review_reason:
            update_expr += ", review_reason = :rr"
            expr_values[":rr"] = review_reason
        if photo_after_url:
            update_expr += ", photo_after_url = :pau, finish_photo_url = :pau"
            expr_values[":pau"] = photo_after_url
        if location_after:
            update_expr += ", location_after = :la, finish_location = :la"
            expr_values[":la"] = {
                "lat": Decimal(str(location_after.get("lat", 0))),
                "lng": Decimal(str(location_after.get("lng", 0))),
            }
        if reward_coupon_code:
            update_expr += ", reward_coupon_code = :rcc"
            expr_values[":rcc"] = reward_coupon_code
        if reward_coupon_id:
            update_expr += ", reward_coupon_id = :rci"
            expr_values[":rci"] = reward_coupon_id

        reports_table.update_item(
            Key={"report_id": report_id},
            UpdateExpression=update_expr,
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues=expr_values,
        )

    # Free all assigned workers
    if workers_table:
        for phone in worker_phones:
            try:
                res = workers_table.scan(FilterExpression=Attr("phone").eq(phone))
                for item in res.get("Items", []):
                    workers_table.update_item(
                        Key={"worker_id": item["worker_id"]},
                        UpdateExpression="SET #s = :s",
                        ExpressionAttributeNames={"#s": "status"},
                        ExpressionAttributeValues={":s": "free"},
                    )
            except Exception as e:
                logger.error(f"Error freeing worker {phone}: {e}")


def get_citizen_reward_count(citizen_phone: str) -> int:
    """Count total resolved reports for a citizen phone number."""
    if not reports_table:
        return 1
    try:
        response = reports_table.scan(
            FilterExpression=Attr("citizen_phone").eq(citizen_phone)
            & Attr("status").eq("resolved")
        )
        return len(response.get("Items", []))
    except Exception:
        return 1


def get_active_reports() -> list[dict]:
    """Scan and return all reports shown on the dashboard, excluding incomplete/expired intake states."""
    if not reports_table:
        return []
    try:
        response = reports_table.scan()
        items = response.get("Items", [])
        filtered = [
            item for item in items
            if item.get("status") not in ["awaiting_photo", "awaiting_location", "expired"]
        ]
        filtered.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return filtered
    except Exception as e:
        logger.error(f"Error scanning reports: {e}")
        return []


# ===========================================================================
# WORKERS
# ===========================================================================

def create_worker(name: str, phone: str, lat: float, lng: float, photo_url: str = "") -> dict:
    """Create a new worker in DynamoDB with unique phone number and UUID."""
    clean_phone = phone.strip()
    existing = get_worker_by_phone(clean_phone)
    if existing:
        raise ValueError(f"Worker with phone {clean_phone} is already registered (Worker ID: {existing.get('worker_id')})")

    worker_id = f"worker-{uuid.uuid4().hex[:8]}"
    item = {
        "worker_id": worker_id,
        "name": name.strip(),
        "phone": clean_phone,
        "photo_url": photo_url or "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80",
        "last_known_location": {
            "lat": Decimal(str(lat)),
            "lng": Decimal(str(lng)),
        },
        "status": "free",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if workers_table:
        workers_table.put_item(Item=item)
    return item


def get_all_workers() -> list[dict]:
    """Retrieve all workers from DynamoDB."""
    if not workers_table:
        return []
    response = workers_table.scan()
    return response.get("Items", [])


def get_free_workers() -> list[dict]:
    """Scan and return all free workers."""
    if not workers_table:
        return []
    response = workers_table.scan(FilterExpression=Attr("status").eq("free"))
    return response.get("Items", [])


def get_worker_by_phone(phone: str) -> dict | None:
    """Retrieve worker item by phone number."""
    if not workers_table:
        return None
    try:
        clean_phone = phone.strip()
        items = workers_table.scan().get("Items", [])
        for w in items:
            if w.get("phone", "").strip() == clean_phone:
                return w
        return None
    except Exception as e:
        logger.error(f"Error fetching worker by phone {phone}: {e}")
        return None


# ===========================================================================
# VENDORS
# ===========================================================================

def create_vendor(
    vendor_name: str,
    category: str,
    description: str = "",
    coupon_templates: list | None = None,
    lat: float | None = None,
    lng: float | None = None,
    city: str = "",
    area: str = "",
) -> dict:
    """Create a new vendor with optional coupon templates and location coordinates stored on the item."""
    vendor_id = f"vendor-{uuid.uuid4().hex[:8]}"
    item = {
        "vendor_id": vendor_id,
        "vendor_name": vendor_name.strip(),
        "category": category.strip(),
        "description": description.strip(),
        "city": city.strip() if city else "",
        "area": area.strip() if area else "",
        "coupon_templates": coupon_templates or [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if lat is not None and lng is not None:
        item["latitude"] = Decimal(str(lat))
        item["longitude"] = Decimal(str(lng))
        item["location"] = {"lat": Decimal(str(lat)), "lng": Decimal(str(lng))}

    if vendors_table:
        vendors_table.put_item(Item=item)
    return item


def get_all_vendors() -> list[dict]:
    """Retrieve all vendors from DynamoDB."""
    if not vendors_table:
        return []
    try:
        response = vendors_table.scan()
        return response.get("Items", [])
    except Exception as e:
        logger.error(f"Error fetching vendors: {e}")
        return []


# ===========================================================================
# COUPONS
# ===========================================================================

# Hardcoded fallback vendors used when the Vendors table is empty
_FALLBACK_VENDORS = [
    {
        "vendor_id": "fallback-0",
        "vendor_name": "BigBasket Local",
        "category": "Grocery",
        "city": "Bangalore",
        "area": "Central",
        "description": "India's largest online supermarket - Local Hub",
        "coupon_templates": [
            {
                "template_id": "tpl-bb-1",
                "offer_type": "flat_off",
                "value": 30,
                "min_spend": 199,
                "description": "Flat ₹30 off on orders above ₹199",
                "validation": "Valid once per user, expires 30 days from issue",
            }
        ],
    },
    {
        "vendor_id": "fallback-1",
        "vendor_name": "Swiggy Instamart Local",
        "category": "Grocery",
        "city": "Bangalore",
        "area": "Central",
        "description": "10-minute grocery delivery at your doorstep",
        "coupon_templates": [
            {
                "template_id": "tpl-si-1",
                "offer_type": "percent_off",
                "value": 10,
                "min_spend": None,
                "description": "10% off, no minimum order",
                "validation": "Valid once per user, expires 30 days from issue",
            }
        ],
    },
    {
        "vendor_id": "fallback-2",
        "vendor_name": "Blinkit Local",
        "category": "Grocery",
        "city": "Bangalore",
        "area": "Central",
        "description": "Rapid grocery delivery",
        "coupon_templates": [
            {
                "template_id": "tpl-bl-1",
                "offer_type": "min_spend_gift",
                "value": "Gift Hamper",
                "min_spend": 499,
                "description": "Free gift hamper on orders above ₹499",
                "validation": "Valid once per user, expires 30 days from issue",
            }
        ],
    },
]


def _generate_coupon_code(vendor_name: str, offer_type: str) -> str:
    """Generate a unique, human-readable coupon code."""
    prefix = vendor_name[:3].upper().replace(" ", "")
    random_part = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
    suffix_map = {"flat_off": "FLAT", "percent_off": "PCT", "min_spend_gift": "GIFT"}
    suffix = suffix_map.get(offer_type, "OFF")
    return f"CL-{prefix}-{random_part}-{suffix}"


def generate_and_save_coupon(
    report_id: str,
    citizen_phone: str,
    report_lat: float | None = None,
    report_lng: float | None = None,
) -> dict | None:
    """Pick a local vendor + template based on citizen location, generate a coupon, save to Coupons table."""
    from utils.haversine import haversine
    vendors = get_all_vendors()
    if not vendors:
        vendors = _FALLBACK_VENDORS

    # Filter vendors that have at least one coupon template
    eligible = [v for v in vendors if v.get("coupon_templates")]
    if not eligible:
        eligible = _FALLBACK_VENDORS

    # Local vendor selection by distance to citizen report location
    selected_vendor = None
    if report_lat is not None and report_lng is not None:
        local_vendors = []
        radius_m = settings.VENDOR_LOCAL_RADIUS_KM * 1000
        for v in eligible:
            v_lat = v.get("latitude") or (v.get("location", {}) or {}).get("lat")
            v_lng = v.get("longitude") or (v.get("location", {}) or {}).get("lng")
            if v_lat is not None and v_lng is not None:
                dist = haversine(float(report_lat), float(report_lng), float(v_lat), float(v_lng))
                if dist <= radius_m:
                    local_vendors.append((v, dist))
        if local_vendors:
            # Sort by proximity to citizen and choose from nearest local vendors
            local_vendors.sort(key=lambda x: x[1])
            selected_vendor = random.choice([x[0] for x in local_vendors[:3]])
            logger.info(f"Matched local vendor: {selected_vendor['vendor_name']} for report at ({report_lat},{report_lng})")

    if not selected_vendor:
        selected_vendor = random.choice(eligible)

    template = random.choice(selected_vendor["coupon_templates"])

    code = _generate_coupon_code(selected_vendor["vendor_name"], template["offer_type"])
    coupon_id = f"cpn-{uuid.uuid4().hex[:10]}"
    issued_at = datetime.now(timezone.utc)
    valid_until = issued_at + timedelta(days=30)

    coupon_item = {
        "coupon_id": coupon_id,
        "code": code,
        "report_id": report_id,
        "citizen_phone": citizen_phone,
        "vendor_id": str(selected_vendor.get("vendor_id", "")),
        "vendor_name": selected_vendor["vendor_name"],
        "vendor_category": selected_vendor.get("category", ""),
        "vendor_city": selected_vendor.get("city", ""),
        "vendor_area": selected_vendor.get("area", ""),
        "offer_type": template["offer_type"],
        "offer_description": template["description"],
        "validation_text": template.get("validation", "Valid for 30 days"),
        "status": "issued",
        "issued_at": issued_at.isoformat(),
        "valid_until": valid_until.isoformat(),
    }

    if coupons_table:
        try:
            coupons_table.put_item(Item=coupon_item)
        except Exception as e:
            logger.error(f"Failed to save coupon {coupon_id}: {e}")

    return coupon_item


def get_all_coupons() -> list[dict]:
    """Retrieve all coupons from DynamoDB."""
    if not coupons_table:
        return []
    try:
        response = coupons_table.scan()
        items = response.get("Items", [])
        items.sort(key=lambda x: x.get("issued_at", ""), reverse=True)
        return items
    except Exception as e:
        logger.error(f"Error fetching coupons: {e}")
        return []


# ===========================================================================
# Warehouses / MRF Facilities Module
# ===========================================================================

_DEFAULT_WAREHOUSES = [
    {
        "warehouse_id": "wh-patia-plastic",
        "name": "Patia Materials Recovery Facility",
        "category": "plastic",
        "rate_per_kg": Decimal("12.0"),
        "capacity_kg": Decimal("10000"),
        "current_stock_kg": Decimal("0"),
        "address": "Patia / Infocity, Bhubaneswar",
        "location": {"lat": Decimal("20.3580"), "lng": Decimal("85.8250")},
        "accepted_categories": ["plastic", "e_waste", "mixed"],
        "city": "Bhubaneswar",
        "area": "Patia / Infocity",
    },
    {
        "warehouse_id": "wh-rasulgarh-metal",
        "name": "Rasulgarh Industrial Recycling Hub",
        "category": "metal",
        "rate_per_kg": Decimal("16.0"),
        "capacity_kg": Decimal("15000"),
        "current_stock_kg": Decimal("0"),
        "address": "Rasulgarh Industrial Zone, Bhubaneswar",
        "location": {"lat": Decimal("20.3010"), "lng": Decimal("85.8600")},
        "accepted_categories": ["metal", "mixed"],
        "city": "Bhubaneswar",
        "area": "Rasulgarh",
    },
    {
        "warehouse_id": "wh-chandaka-organic",
        "name": "Chandaka Composting & Paper Depot",
        "category": "organic",
        "rate_per_kg": Decimal("6.0"),
        "capacity_kg": Decimal("8000"),
        "current_stock_kg": Decimal("0"),
        "address": "Chandaka Agricultural Hub, Bhubaneswar",
        "location": {"lat": Decimal("20.3700"), "lng": Decimal("85.7800")},
        "accepted_categories": ["organic", "paper", "glass", "mixed"],
        "city": "Bhubaneswar",
        "area": "Chandaka",
    },
    {
        "warehouse_id": "wh-mancheswar-hazmat",
        "name": "Mancheswar Hazardous & Chemical Disposal Facility",
        "category": "hazardous_medical",
        "rate_per_kg": Decimal("8.0"),
        "capacity_kg": Decimal("5000"),
        "current_stock_kg": Decimal("0"),
        "address": "Mancheswar Industrial Estate, Bhubaneswar",
        "location": {"lat": Decimal("20.3200"), "lng": Decimal("85.8450")},
        "accepted_categories": ["hazardous", "hazardous_medical", "mixed"],
        "city": "Bhubaneswar",
        "area": "Mancheswar IE",
    },
]


def seed_warehouses_if_empty() -> None:
    """Seed initial warehouse facilities in Bhubaneswar if table is empty."""
    if not warehouses_table:
        return
    try:
        res = warehouses_table.scan()
        items = res.get("Items", [])
        if not items:
            logger.info("Seeding initial Bhubaneswar warehouses...")
            for wh in _DEFAULT_WAREHOUSES:
                warehouses_table.put_item(Item=wh)
        else:
            # Backfill any missing rate_per_kg or category in existing warehouse items
            for wh in items:
                needs_update = False
                update_expr = []
                expr_vals = {}
                wid = wh.get("warehouse_id")
                if not wh.get("rate_per_kg"):
                    update_expr.append("rate_per_kg = :r")
                    expr_vals[":r"] = Decimal("8.0")
                    needs_update = True
                if not wh.get("category"):
                    cat = (wh.get("accepted_categories") or ["mixed"])[0]
                    update_expr.append("category = :c")
                    expr_vals[":c"] = cat
                    needs_update = True
                if not wh.get("capacity_kg"):
                    update_expr.append("capacity_kg = :cap")
                    expr_vals[":cap"] = Decimal("5000")
                    needs_update = True
                if needs_update and wid:
                    warehouses_table.update_item(
                        Key={"warehouse_id": wid},
                        UpdateExpression="SET " + ", ".join(update_expr),
                        ExpressionAttributeValues=expr_vals,
                    )
    except Exception as e:
        logger.warning(f"Failed to auto-seed / update warehouses: {e}")


def get_all_warehouses() -> list[dict]:
    """Retrieve all recycling warehouses from DynamoDB."""
    if not warehouses_table:
        return _DEFAULT_WAREHOUSES
    try:
        res = warehouses_table.scan()
        items = res.get("Items", [])
        if not items:
            seed_warehouses_if_empty()
            return _DEFAULT_WAREHOUSES
        
        # Ensure every warehouse object has category, rate_per_kg, capacity_kg
        sanitized = []
        for wh in items:
            wh_copy = dict(wh)
            if "rate_per_kg" not in wh_copy or wh_copy["rate_per_kg"] is None:
                wh_copy["rate_per_kg"] = Decimal(str(wh_copy.get("price_per_kg") or 8.0))
            if "category" not in wh_copy or not wh_copy["category"]:
                wh_copy["category"] = (wh_copy.get("accepted_categories") or ["mixed"])[0]
            if "capacity_kg" not in wh_copy or wh_copy["capacity_kg"] is None:
                wh_copy["capacity_kg"] = Decimal("5000")
            sanitized.append(wh_copy)
        return sanitized
    except Exception as e:
        logger.error(f"Error scanning warehouses: {e}")
        return _DEFAULT_WAREHOUSES


def update_report_warehouse_details(
    report_id: str,
    recycling_category: str,
    purity_score: int,
    assigned_warehouse_id: str | None,
    assigned_warehouse_name: str | None,
    warehouse_status: str,
    estimated_weight_kg: float,
    estimated_revenue: float,
) -> None:
    """Save post-resolution recycling categorization and warehouse revenue onto report."""
    if not reports_table:
        return
    update_expr = (
        "SET recycling_category = :rc, purity_score = :ps, "
        "warehouse_status = :ws, estimated_weight_kg = :ewk, "
        "estimated_revenue = :er"
    )
    expr_vals: dict = {
        ":rc": recycling_category,
        ":ps": purity_score,
        ":ws": warehouse_status,
        ":ewk": Decimal(str(estimated_weight_kg)),
        ":er": Decimal(str(estimated_revenue)),
    }
    if assigned_warehouse_id:
        update_expr += ", assigned_warehouse_id = :wid"
        expr_vals[":wid"] = assigned_warehouse_id
    if assigned_warehouse_name:
        update_expr += ", assigned_warehouse_name = :wname"
        expr_vals[":wname"] = assigned_warehouse_name

    reports_table.update_item(
        Key={"report_id": report_id},
        UpdateExpression=update_expr,
        ExpressionAttributeValues=expr_vals,
    )


def create_warehouse(
    name: str,
    category: str,
    rate_per_kg: float,
    capacity_kg: float,
    address: str = "",
    lat: float = 20.2961,
    lng: float = 85.8245,
    accepted_categories: list[str] | None = None,
    city: str = "Bhubaneswar",
    area: str = "Central",
) -> dict:
    """Create a new recycling warehouse / MRF facility in DynamoDB."""
    warehouse_id = f"wh-{uuid.uuid4().hex[:8]}"
    item = {
        "warehouse_id": warehouse_id,
        "name": name.strip(),
        "category": category.strip().lower(),
        "rate_per_kg": Decimal(str(rate_per_kg)),
        "capacity_kg": Decimal(str(capacity_kg)),
        "current_stock_kg": Decimal("0"),
        "address": address.strip(),
        "location": {
            "lat": Decimal(str(lat)),
            "lng": Decimal(str(lng)),
        },
        "accepted_categories": accepted_categories or [category.strip().lower()],
        "city": city,
        "area": area,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if warehouses_table:
        warehouses_table.put_item(Item=item)
    return item


def get_warehouse_by_id(warehouse_id: str) -> dict | None:
    """Fetch warehouse item by warehouse_id."""
    if not warehouses_table:
        return None
    try:
        res = warehouses_table.get_item(Key={"warehouse_id": warehouse_id})
        return res.get("Item")
    except Exception as e:
        logger.error(f"Error fetching warehouse {warehouse_id}: {e}")
        return None


def assign_report_to_warehouse(
    report_id: str,
    warehouse_id: str,
    actual_weight_kg: float,
) -> dict:
    """Assign a resolved report to a designated recycling warehouse with measured weight and calculated revenue."""
    if not reports_table:
        raise RuntimeError("Reports table not available")

    report_res = reports_table.get_item(Key={"report_id": report_id})
    report = report_res.get("Item")
    if not report:
        raise ValueError(f"Report {report_id} not found")

    warehouses = get_all_warehouses()
    warehouse = next((w for w in warehouses if w.get("warehouse_id") == warehouse_id), None)
    if not warehouse:
        raise ValueError(f"Warehouse {warehouse_id} not found")

    rate = float(warehouse.get("rate_per_kg", 8.0))
    purity = float(report.get("purity_score", 85))
    revenue = round(actual_weight_kg * rate * (purity / 100.0), 2)
    warehouse_name = warehouse.get("name", "Recycling Hub")

    update_report_warehouse_details(
        report_id=report_id,
        recycling_category=report.get("recycling_category") or warehouse.get("category", "mixed"),
        purity_score=int(purity),
        assigned_warehouse_id=warehouse_id,
        assigned_warehouse_name=warehouse_name,
        warehouse_status="assigned",
        estimated_weight_kg=actual_weight_kg,
        estimated_revenue=revenue,
    )

    return {
        "report_id": report_id,
        "assigned_warehouse_id": warehouse_id,
        "assigned_warehouse_name": warehouse_name,
        "actual_weight_kg": actual_weight_kg,
        "actual_revenue": revenue,
        "warehouse_status": "assigned",
    }
