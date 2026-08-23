import os
import base64
import json
import logging
import requests
from requests.auth import HTTPBasicAuth
from config import settings

logger = logging.getLogger(__name__)

# Instantiate client at module level for Lambda container reuse
try:
    session = settings.get_boto3_session()
    bedrock_client = session.client("bedrock-runtime")
except Exception as e:
    logger.warning(f"Failed to initialize bedrock client: {e}")
    bedrock_client = None

# Sentinel dict that signals a classification failure — callers check for this
CLASSIFICATION_ERROR = {"_error": "classification_error"}

_SYSTEM_PROMPT = (
    "You are a waste-classification and report-integrity engine for a municipal "
    "cleanup dispatch system. You will receive one photo. Analyze it and return "
    "ONLY a single JSON object — no markdown code fences, no explanation, no text "
    "before or after the JSON. The output must be parseable directly by json.loads().\n\n"
    "Return exactly this schema:\n\n"
    "{\n"
    '  "is_valid_report": boolean,\n'
    '  "waste_type": string,\n'
    '  "fill_percent": integer,\n'
    '  "urgency": string,\n'
    '  "estimated_workers_needed": integer,\n'
    '  "estimated_minutes_to_clean": integer,\n'
    '  "confidence": integer,\n'
    '  "suspicious_flag": boolean,\n'
    '  "segregation_quality": string,\n'
    '  "notes": string\n'
    "}\n\n"
    "FIELD RULES:\n\n"
    "is_valid_report:\n"
    "- true if the image clearly shows waste, an overflowing bin, litter, or a dumping site.\n"
    "- false if the image shows something unrelated (people, selfies, unrelated objects, "
    "blank/blurry/dark image, or no visible waste at all).\n"
    "- If false, set waste_type=\"unknown\", fill_percent=0, urgency=\"unknown\", "
    "estimated_workers_needed=0, estimated_minutes_to_clean=0, confidence=0, "
    "suspicious_flag=true, segregation_quality=\"unknown\", and explain why in \"notes\".\n\n"
    "waste_type — choose exactly one from this list, based on the DOMINANT material visible:\n"
    "[\"plastic\", \"organic\", \"e_waste\", \"paper\", \"glass\", \"metal\", \"hazardous\", \"mixed\"]\n"
    "- Use \"mixed\" only if multiple materials are visibly present in comparable quantity.\n"
    "- Use \"hazardous\" only for visibly dangerous material — batteries, medical waste, "
    "chemical containers, broken glass in large quantity.\n\n"
    "fill_percent — integer 0-100:\n"
    "- If a bin/container is visible: estimate how full it is (0 = empty, 100 = overflowing).\n"
    "- If no bin is visible: estimate based on spread/volume — small pile ≈ 20-40, "
    "moderate ≈ 40-70, large/blocking-pathway ≈ 70-100.\n"
    "- Do not default to round numbers unless genuinely warranted.\n\n"
    "urgency — choose exactly one: [\"low\", \"medium\", \"high\"]\n"
    "- \"high\": hazardous material visible, waste blocking a walkway/road, or fill_percent >= 80.\n"
    "- \"medium\": fill_percent 40-79, no hazard visible.\n"
    "- \"low\": fill_percent < 40, no hazard, not blocking access.\n\n"
    "estimated_workers_needed — integer 1-4:\n"
    "- 1 for a standard single bin or small pile.\n"
    "- 2-3 for large spillage, multiple bins, or a wide dumping area.\n"
    "- 4 only for a clearly large-scale dumping site.\n\n"
    "estimated_minutes_to_clean — integer, realistic range 5-90:\n"
    "- Base this on fill_percent, waste_type, and estimated area — a single overflowing "
    "bin might be 10-15 min; a large mixed dumping site might be 45-90 min. This value "
    "assumes ONE worker.\n\n"
    "confidence — integer 0-100:\n"
    "- How confident you are this is a genuine, clear, unambiguous waste report.\n"
    "- Score LOW (under 25) for: blurry/dark/low-quality images, images that are "
    "technically waste but ambiguous or hard to assess, or anything that looks staged, "
    "reused, or inconsistent with a real on-the-ground report.\n"
    "- Score HIGH (70+) for clear, well-lit, unambiguous waste images.\n\n"
    "suspicious_flag — boolean:\n"
    "- true if the image looks staged, duplicated, screenshotted, or otherwise not a "
    "genuine first-hand photo of a real waste site. false otherwise.\n\n"
    "segregation_quality — choose exactly one: [\"proper\", \"mixed\", \"improper\"]\n"
    "- \"proper\": waste appears sorted by type (e.g. separated bins/piles by material).\n"
    "- \"mixed\": some separation visible but materials overlap.\n"
    "- \"improper\": no visible segregation, all waste types dumped together.\n\n"
    "notes — one short sentence. Keep it under 20 words.\n\n"
    "Return valid JSON only. Do not wrap it in ```json``` or any other formatting."
)

_VALID_WASTE_TYPES = {"plastic", "organic", "e_waste", "paper", "glass", "metal", "hazardous", "mixed", "unknown"}
_VALID_URGENCY = {"low", "medium", "high", "unknown"}
_VALID_SEGREGATION = {"proper", "mixed", "improper", "unknown"}



def detect_image_format(image_bytes: bytes) -> str:
    """Detect image format from header magic bytes for Nova Lite format requirement."""
    if not image_bytes or len(image_bytes) < 8:
        return "jpeg"
    if image_bytes.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if image_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if image_bytes.startswith(b"RIFF") and image_bytes[8:12] == b"WEBP":
        return "webp"
    if image_bytes.startswith(b"GIF87a") or image_bytes.startswith(b"GIF89a"):
        return "gif"
    return "jpeg"


def download_twilio_media(media_url: str) -> bytes:
    """Download image media from Twilio using HTTP Basic Auth, local /images/ disk, or public URL."""
    if not media_url:
        return b""

    # 1. Check if media_url is a local file or relative path
    clean_url = media_url.split("?")[0].strip()
    possible_paths = [
        media_url,
        clean_url,
        os.path.join(os.path.dirname(__file__), "../../../images", os.path.basename(clean_url)),
        os.path.join("/home/swyra/projects/garbage-collector/images", os.path.basename(clean_url)),
    ]
    for p in possible_paths:
        if os.path.isfile(p):
            try:
                with open(p, "rb") as f:
                    return f.read()
            except Exception as e:
                logger.warning(f"Failed to read local file {p}: {e}")

    # 2. If it's a Twilio API URL, use Twilio HTTP Basic Auth
    if "twilio.com" in media_url:
        try:
            response = requests.get(
                media_url,
                auth=HTTPBasicAuth(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
                timeout=15,
                headers={"User-Agent": "PingBin/1.0"}
            )
            if response.status_code == 200:
                return response.content
        except Exception as e:
            logger.warning(f"Twilio auth download failed for {media_url}: {e}")

    # 3. Standard public HTTP GET (e.g. Unsplash, S3, cloudflare tunnel, CDN)
    try:
        res = requests.get(
            media_url,
            timeout=12,
            headers={"User-Agent": "Mozilla/5.0 (compatible; PingBin/1.0)"}
        )
        if res.status_code == 200:
            return res.content
    except Exception as e:
        logger.error(f"Failed to download image from {media_url}: {e}")

    return b""


def _normalize_waste_type(raw_val) -> str:
    """Normalize whatever LLM returned into one of the canonical waste types."""
    if isinstance(raw_val, list):
        s = " ".join(str(x) for x in raw_val).lower()
    else:
        s = str(raw_val).lower()

    if "hazard" in s or "batter" in s or "chemic" in s:
        return "hazardous"
    if "mix" in s:
        return "mixed"
    if "plas" in s:
        return "plastic"
    if "org" in s or "food" in s or "bio" in s:
        return "organic"
    if "pap" in s or "card" in s:
        return "paper"
    if "gla" in s:
        return "glass"
    if "met" in s:
        return "metal"
    if "e_w" in s or "electr" in s:
        return "e_waste"
    if s in _VALID_WASTE_TYPES:
        return s
    return "mixed"


def _normalize_urgency(raw_val) -> str:
    """Normalize urgency string."""
    s = str(raw_val).lower().strip()
    if "high" in s or "crit" in s:
        return "high"
    if "med" in s:
        return "medium"
    if "low" in s:
        return "low"
    return "medium"


def classify_image_base64(image_base64: str, image_format: str = "jpeg") -> dict:
    """Send base64-encoded image to Bedrock Nova Lite and return structured classification.

    Returns CLASSIFICATION_ERROR sentinel dict if the call fails OR if the model
    marks is_valid_report=False.  Callers should check for "_error" key.
    """
    if not bedrock_client or not image_base64:
        logger.warning("Bedrock client or image unavailable — returning classification error.")
        return CLASSIFICATION_ERROR.copy()

    # If raw bytes were encoded, determine format if default jpeg
    try:
        raw_bytes = base64.b64decode(image_base64[:64])
        detected_fmt = detect_image_format(raw_bytes)
        if detected_fmt in ["jpeg", "png", "webp", "gif"]:
            image_format = detected_fmt
    except Exception:
        pass

    model_id = settings.BEDROCK_MODEL_ID
    if model_id == "amazon.nova-lite-v1:0" and settings.AWS_REGION == "ap-south-1":
        model_id = "apac.amazon.nova-lite-v1:0"

    payload = {
        "system": [{"text": _SYSTEM_PROMPT}],
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "image": {
                            "format": image_format,
                            "source": {"bytes": image_base64},
                        }
                    },
                    {"text": "Classify this waste image and return JSON only."},
                ],
            }
        ],
        # temperature=0 + topP=1.0 → greedy decoding → deterministic outputs for same image
        "inferenceConfig": {
            "temperature": 0.0,
            "topP": 1.0,
            "maxTokens": 512,
        },
    }

    try:
        logger.info(f"Invoking Bedrock Nova Lite ({model_id}) with format={image_format}, temperature=0 (deterministic)...")
        response = bedrock_client.invoke_model(
            modelId=model_id,
            body=json.dumps(payload),
        )
        response_body = json.loads(response["body"].read())
        raw_text = response_body["output"]["message"]["content"][0]["text"].strip()
        logger.info(f"Bedrock Nova Lite Raw Response:\n{raw_text}")

        # Strip markdown fences if present (defensive)
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        elif raw_text.startswith("```"):
            raw_text = raw_text[3:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]

        parsed = json.loads(raw_text.strip())

        # If model says not a valid waste report — fail closed
        if not parsed.get("is_valid_report", False):
            logger.info(f"Nova Lite rejected image as not a valid report: {parsed.get('notes', '')}")
            return CLASSIFICATION_ERROR.copy()

        waste_type = _normalize_waste_type(parsed.get("waste_type", "mixed"))
        urgency = _normalize_urgency(parsed.get("urgency", "medium"))
        fill_percent = int(parsed.get("fill_percent", 50))
        workers_needed = max(1, min(4, int(parsed.get("estimated_workers_needed", 1))))
        # Hard clamp to sane range [5, 90] as specified in the system prompt
        minutes_to_clean = max(5, min(90, int(parsed.get("estimated_minutes_to_clean", 30))))
        confidence = int(parsed.get("confidence", 85))
        suspicious_flag = bool(parsed.get("suspicious_flag", False))
        segregation_quality = str(parsed.get("segregation_quality", "mixed")).lower()
        if segregation_quality not in _VALID_SEGREGATION:
            segregation_quality = "mixed"
        notes = str(parsed.get("notes", ""))

        result = {
            "is_valid_report": True,
            "waste_type": waste_type,
            "fill_percent": fill_percent,
            "urgency": urgency,
            "estimated_workers_needed": workers_needed,
            "estimated_minutes_to_clean": minutes_to_clean,
            "confidence": confidence,
            "suspicious_flag": suspicious_flag,
            "segregation_quality": segregation_quality,
            "notes": notes,
        }
        logger.info(f"Bedrock classification parsed successfully: {result}")
        return result

    except Exception as e:
        logger.error(f"Error calling Bedrock Nova Lite: {e}")
        return CLASSIFICATION_ERROR.copy()
