import json
import base64
import logging
from datetime import datetime, timezone
from urllib.parse import parse_qs
from config import settings

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Instantiate SQS client at module level using session
try:
    session = settings.get_boto3_session()
    sqs_client = session.client("sqs")
except Exception as e:
    logger.warning(f"Failed to initialize SQS client: {e}")
    sqs_client = None


def lambda_handler(event: dict, context: dict | None = None) -> dict:
    """Lambda 1: Fast webhook receiver for Twilio WhatsApp webhooks (<500ms).

    Parses URL-encoded body, normalizes payload, pushes to AWS SQS, and returns 200 OK.
    """
    try:
        body = event.get("body", "")
        # Decode base64 if encoded by AWS API Gateway
        if event.get("isBase64Encoded") and isinstance(body, str):
            try:
                body = base64.b64decode(body).decode("utf-8")
            except Exception as b64_err:
                logger.warning(f"Failed to decode base64 body: {b64_err}")

        if isinstance(body, str):
            parsed = parse_qs(body)
        elif isinstance(body, dict):
            parsed = body
        else:
            parsed = {}

        sender_raw = parsed.get("From", [""])[0] if isinstance(parsed.get("From"), list) else parsed.get("From", "")
        sender = sender_raw.replace("whatsapp:", "").strip()

        media_url = parsed.get("MediaUrl0", [None])[0] if isinstance(parsed.get("MediaUrl0"), list) else parsed.get("MediaUrl0")
        latitude = parsed.get("Latitude", [None])[0] if isinstance(parsed.get("Latitude"), list) else parsed.get("Latitude")
        longitude = parsed.get("Longitude", [None])[0] if isinstance(parsed.get("Longitude"), list) else parsed.get("Longitude")
        body_text = parsed.get("Body", [""])[0] if isinstance(parsed.get("Body"), list) else parsed.get("Body", "")

        if media_url:
            msg_type = "photo"
        elif latitude and longitude:
            msg_type = "location"
        else:
            msg_type = "text"

        message = {
            "sender_phone": sender,
            "message_type": msg_type,
            "media_url": media_url,
            "latitude": float(latitude) if latitude else None,
            "longitude": float(longitude) if longitude else None,
            "body_text": body_text.strip() if body_text else "",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        if sqs_client and settings.SQS_QUEUE_URL:
            sqs_client.send_message(
                QueueUrl=settings.SQS_QUEUE_URL,
                MessageBody=json.dumps(message),
            )
            logger.info(f"Queued {msg_type} message from {sender} to SQS")
        else:
            logger.warning(f"SQS queue not configured; message logged: {message}")

    except Exception as e:
        logger.error(f"Error in webhook_receiver: {e}")

    # ALWAYS return 200 OK to Twilio within <500ms
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "text/xml"},
        "body": "<Response></Response>",
    }
