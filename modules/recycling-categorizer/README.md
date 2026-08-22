# Recycling Categorizer Module

Built in-house — the acquired ANOMALYCategorizer module was not delivered by the seller team by integration time.

## Overview
Evaluates post-cleanup images to determine the recycling material category (`plastic`, `organic`, `e_waste`, `paper`, `glass`, `metal`, `hazardous`, `mixed`) and a purity score (`0-100`) for municipal material recovery facility (MRF) logistics and recycling revenue calculations.

## Interface Contract
- **Function**: `categorize_for_recycling(image_bytes_or_b64: bytes | str, image_format: str = "jpeg") -> dict`
- **Output Schema**:
```json
{
  "recycling_category": "plastic",
  "purity_score": 85,
  "notes": "Sorted PET bottles ready for baling."
}
```
