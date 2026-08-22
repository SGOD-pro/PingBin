import json
import base64
import logging
import os
import time
from typing import Any
from urllib.parse import parse_qs
import boto3

logger = logging.getLogger("whatsapp-intake")

SQS_QUEUE_URL = os.getenv("SQS_QUEUE_URL", "")
AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")

TWILIO_EMPTY_ACK = (
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    "<Response></Response>"
)


def _detect_message_payload(parsed: dict[str, list[str]]) -> dict[str, Any]:
    """Parse raw URL-encoded Twilio webhook form fields into a normalized payload."""
    sender_raw = parsed.get("From", [""])[0]
    sender_phone = sender_raw.replace("whatsapp:", "").strip()

    num_media = int(parsed.get("NumMedia", ["0"])[0] or 0)
    media_url = parsed.get("MediaUrl0", [None])[0] if num_media > 0 else None
    body_text = (parsed.get("Body", [""])[0] or "").strip()

    lat = parsed.get("Latitude", [None])[0]
    lng = parsed.get("Longitude", [None])[0]

    if media_url:
        message_type = "photo"
    elif lat and lng:
        message_type = "location"
    else:
        message_type = "text"

    return {
        "sender_phone": sender_phone,
        "message_type": message_type,
        "media_url": media_url,
        "latitude": float(lat) if lat else None,
        "longitude": float(lng) if lng else None,
        "body_text": body_text,
        "received_at": int(time.time()),
        "message_sid": parsed.get("MessageSid", [""])[0],
        "account_sid": parsed.get("AccountSid", [""])[0],
    }


def handle_webhook(event: dict) -> dict:
    """Strict Interface Contract for WhatsApp Intake Handler (AWS Lambda 1).

    Input:
      event: AWS Lambda event dict (from API Gateway proxy integration)

    Output:
      {"statusCode": 200, "body": "<Response></Response>"}

    Side effects:
      Parses Twilio payload, detects message type (photo, location, text),
      sends normalized JSON message to AWS SQS queue, and returns 200 OK instantly (<500ms).
    """
    try:
        body_str = event.get("body", "")
        if event.get("isBase64Encoded") and isinstance(body_str, str):
            try:
                body_str = base64.b64decode(body_str).decode("utf-8")
            except Exception as b64_err:
                logger.warning(f"Failed to decode base64 body: {b64_err}")

        if not body_str:
            return {
                "statusCode": 200,
                "headers": {"Content-Type": "application/xml"},
                "body": TWILIO_EMPTY_ACK,
            }

        parsed = parse_qs(body_str)
        payload = _detect_message_payload(parsed)

        # Publish to AWS SQS if configured
        if SQS_QUEUE_URL:
            try:
                sqs = boto3.client("sqs", region_name=AWS_REGION)
                sqs.send_message(
                    QueueUrl=SQS_QUEUE_URL,
                    MessageBody=json.dumps(payload),
                )
            except Exception as e:
                logger.error(f"Failed to publish to SQS: {e}")

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/xml"},
            "body": TWILIO_EMPTY_ACK,
        }
    except Exception as e:
        logger.error(f"Error handling WhatsApp webhook: {e}")
        # Always ACK Twilio to prevent message retries
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/xml"},
            "body": TWILIO_EMPTY_ACK,
        }
