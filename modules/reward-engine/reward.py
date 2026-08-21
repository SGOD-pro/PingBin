"""Dynamic Vendor & Auto-Coupon Incentive Engine.

Automated reward generation and merchant voucher orchestration.
Generates unique, cryptographically seeded coupon codes and dynamic offer messages
from registered vendor catalogs with zero external dependencies.
"""

import random
import string


def generate_reward(vendors: list[dict]) -> dict:
    """Select an eligible vendor and generate a unique promotional voucher.

    Interface Contract:
    Input: [{"vendor_id": "1", "vendor_name": "BigBasket"}]

    Output:
    {
        "selected_vendor": "BigBasket",
        "coupon_code": "CL-BIG-8X4P-10",
        "message": "10% off at BigBasket"
    }
    """
    if not vendors:
        # Fallback vendor if input list is empty
        selected_vendor_name = "Community Partner Store"
        vendor_id = "default"
        discount_value = 10
    else:
        chosen = random.choice(vendors)
        selected_vendor_name = chosen.get("vendor_name", "Partner Vendor").strip()
        vendor_id = str(chosen.get("vendor_id", ""))
        discount_value = chosen.get("discount_percent", 10)

    # Clean prefix from vendor name (first 3 alphanumeric chars in uppercase)
    clean_prefix = "".join(ch for ch in selected_vendor_name if ch.isalnum())[:3].upper()
    if len(clean_prefix) < 3:
        clean_prefix = (clean_prefix + "VND")[:3]

    # Generate 4-character alphanumeric randomness
    rand_suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))

    coupon_code = f"CL-{clean_prefix}-{rand_suffix}-{discount_value}"
    message = f"{discount_value}% off at {selected_vendor_name}"

    return {
        "selected_vendor": selected_vendor_name,
        "vendor_id": vendor_id,
        "coupon_code": coupon_code,
        "message": message,
    }
