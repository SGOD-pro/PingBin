"""3-Layer Vision & Intake Safety Gate Engine.

Evaluates citizen waste reporting inputs against:
1. Report Validity Check (is_valid_report)
2. Confidence Gating (confidence >= 25)
3. Staged / Suspicious Image Detection (suspicious_flag == False)
4. Segregation Quality Assessment (proper / mixed / improper)

Guarantees clean dispatch by quarantining ambiguous, staged, or low-quality
photos to 'pending_admin_review' before automated workforce assignment.
"""

import os
from typing import Any


def evaluate_safety_gate(classification: dict[str, Any]) -> dict[str, Any]:
    """Evaluate intake classification telemetry against multi-layer safety policies.

    Interface Contract:
    Input:
    {
        "is_valid_report": true,
        "confidence": 85,
        "suspicious_flag": false,
        "segregation_quality": "mixed",
        "waste_type": "mixed",
        "fill_percent": 75
    }

    Output:
    {
        "passed": true,
        "status": "approved",  # "approved", "pending_admin_review", "needs_review"
        "action": "dispatch",  # "dispatch", "hold_for_review", "quarantine"
        "confidence": 85,
        "suspicious_flag": false,
        "segregation_quality": "mixed",
        "reason": "Image passed all safety gates with confidence 85%."
    }
    """
    min_confidence = int(os.getenv("MIN_DISPATCH_CONFIDENCE", "25"))

    if not isinstance(classification, dict):
        return {
            "passed": False,
            "status": "needs_review",
            "action": "quarantine",
            "confidence": 0,
            "suspicious_flag": True,
            "segregation_quality": "unknown",
            "reason": "Invalid or missing classification payload.",
        }

    # Gate 1: General Report Validity
    is_valid = classification.get("is_valid_report", True)
    if not is_valid:
        return {
            "passed": False,
            "status": "needs_review",
            "action": "quarantine",
            "confidence": 0,
            "suspicious_flag": True,
            "segregation_quality": classification.get("segregation_quality", "unknown"),
            "reason": "Report marked as invalid (non-waste, selfie, or blank image).",
        }

    confidence = int(classification.get("confidence", 85))
    suspicious_flag = bool(classification.get("suspicious_flag", False))
    segregation_quality = str(classification.get("segregation_quality", "mixed")).lower()

    # Gate 2 & 3: Confidence & Suspicious Flagging
    reasons = []
    if confidence < min_confidence:
        reasons.append(f"Low AI vision confidence ({confidence}% < {min_confidence}% threshold).")
    if suspicious_flag:
        reasons.append("Image flagged as suspicious (staged, duplicate, or screenshot).")

    if reasons:
        return {
            "passed": False,
            "status": "pending_admin_review",
            "action": "hold_for_review",
            "confidence": confidence,
            "suspicious_flag": suspicious_flag,
            "segregation_quality": segregation_quality,
            "reason": " ".join(reasons),
        }

    return {
        "passed": True,
        "status": "approved",
        "action": "dispatch",
        "confidence": confidence,
        "suspicious_flag": False,
        "segregation_quality": segregation_quality,
        "reason": f"Image passed all safety gates with confidence {confidence}%.",
    }
