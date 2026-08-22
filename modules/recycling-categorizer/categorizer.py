"""In-House Recycling Material & Purity Categorizer Module.

Evaluates post-cleanup images to determine the recycling category (plastic, metal,
paper, glass, e_waste, organic, mixed, hazardous) and purity score (0-100)
for municipal material recovery facility (MRF) logistics.
"""

import base64
import json
import logging
import os
import boto3

logger = logging.getLogger("recycling-categorizer")

_RECYCLING_SYSTEM_PROMPT = (
    "You are a municipal recycling material sorting and purity audit engine. "
    "You will receive one post-cleanup photo of collected waste/bins. "
    "Analyze the collected material and return ONLY a single JSON object — "
    "no markdown code fences, no text before or after the JSON.\n\n"
    "Return exactly this schema:\n"
    "{\n"
    '  "recycling_category": string,\n'
    '  "purity_score": integer,\n'
    '  "notes": string\n'
    "}\n\n"
    "FIELD RULES:\n"
    "recycling_category — choose exactly one: [\"plastic\", \"organic\", \"e_waste\", \"paper\", \"glass\", \"metal\", \"hazardous\", \"mixed\"]\n"
    "purity_score — integer 0-100 (how clean/uncontaminated the sorted material appears for recycling facility acceptance).\n"
    "notes — short description (under 20 words).\n"
)

_VALID_CATEGORIES = {"plastic", "organic", "e_waste", "paper", "glass", "metal", "hazardous", "mixed"}


def _get_bedrock_client():
    region = os.getenv("AWS_REGION", "ap-south-1")
    profile = os.getenv("AWS_PROFILE", "")
    env = os.getenv("ENV", "").lower()
    kwargs = {"region_name": region}
    if env == "dev" and profile:
        kwargs["profile_name"] = profile
    try:
        session = boto3.Session(**kwargs)
        return session.client("bedrock-runtime")
    except Exception as e:
        logger.warning(f"Failed to create bedrock client: {e}")
        return None


def categorize_for_recycling(image_bytes_or_b64: bytes | str, image_format: str = "jpeg") -> dict:
    """Categorize a post-cleanup photo for warehouse recycling logistics.

    Input: image bytes or base64 string
    Output:
    {
        "recycling_category": "plastic",
        "purity_score": 85,
        "notes": "Sorted PET bottles ready for baling."
    }
    """
    if isinstance(image_bytes_or_b64, bytes):
        image_b64 = base64.b64encode(image_bytes_or_b64).decode("utf-8")
    else:
        image_b64 = str(image_bytes_or_b64)

    if not image_b64:
        return {
            "recycling_category": "mixed",
            "purity_score": 70,
            "notes": "No image provided — defaulted to mixed recovery.",
        }

    client = _get_bedrock_client()
    if not client:
        logger.warning("Bedrock client unavailable for recycling categorization.")
        return {
            "recycling_category": "mixed",
            "purity_score": 75,
            "notes": "Offline heuristic categorization.",
        }

    model_id = os.getenv("BEDROCK_MODEL_ID", "amazon.nova-lite-v1:0")
    if model_id == "amazon.nova-lite-v1:0" and os.getenv("AWS_REGION", "ap-south-1") == "ap-south-1":
        model_id = "apac.amazon.nova-lite-v1:0"

    payload = {
        "system": [{"text": _RECYCLING_SYSTEM_PROMPT}],
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "image": {
                            "format": image_format,
                            "source": {"bytes": image_b64},
                        }
                    },
                    {"text": "Analyze collected waste material and categorize for recycling."},
                ],
            }
        ],
    }

    try:
        response = client.invoke_model(
            modelId=model_id,
            body=json.dumps(payload),
        )
        response_body = json.loads(response["body"].read())
        raw_text = response_body["output"]["message"]["content"][0]["text"].strip()

        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        elif raw_text.startswith("```"):
            raw_text = raw_text[3:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]

        parsed = json.loads(raw_text.strip())
        category = str(parsed.get("recycling_category", "mixed")).lower().strip()
        if category not in _VALID_CATEGORIES:
            category = "mixed"

        purity = int(parsed.get("purity_score", 80))
        purity = max(0, min(100, purity))
        notes = str(parsed.get("notes", ""))

        return {
            "recycling_category": category,
            "purity_score": purity,
            "notes": notes,
        }
    except Exception as e:
        logger.error(f"Error in recycling categorization: {e}")
        return {
            "recycling_category": "mixed",
            "purity_score": 75,
            "notes": f"Fallback categorization: {e}",
        }
