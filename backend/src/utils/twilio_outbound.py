import logging
from twilio.rest import Client
from config import settings

logger = logging.getLogger(__name__)


def get_twilio_client():
    try:
        return Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
    except Exception as e:
        logger.warning(f"Failed to initialize Twilio Client: {e}")
        return None


def send_whatsapp(to_number: str, message_body: str) -> tuple[bool, str | None]:
    """Send an outbound WhatsApp message via Twilio REST API.

    Returns (success: bool, sid: str | None).
    """
    client = get_twilio_client()
    if not client:
        logger.warning(f"[MOCK WHATSAPP] To: {to_number} | Body: {message_body}")
        return True, None

    # Ensure to_number is prefixed with whatsapp:
    to_formatted = to_number if to_number.startswith("whatsapp:") else f"whatsapp:{to_number}"

    try:
        msg = client.messages.create(
            from_=settings.TWILIO_WHATSAPP_FROM,
            to=to_formatted,
            body=message_body,
        )
        logger.info(f"WhatsApp message queued to {to_formatted}: SID={msg.sid}, Status={msg.status}")
        return True, msg.sid
    except Exception as e:
        logger.error(f"Failed to send WhatsApp message to {to_formatted}: {e}")
        return False, None
