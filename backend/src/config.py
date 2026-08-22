import os
import boto3
from pathlib import Path


def _load_env_files():
    """Load key-value pairs from .env files if present (for local dev)."""
    current_dir = Path(__file__).resolve().parent
    candidates = [
        current_dir / ".env",
        current_dir.parent / ".env",
        current_dir.parent.parent / ".env",
    ]
    for env_path in candidates:
        if env_path.is_file():
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            k, v = k.strip(), v.strip().strip("'\"")
                            if k and k not in os.environ:
                                os.environ[k] = v
            except Exception:
                pass


_load_env_files()


class Settings:
    """PingBin backend environment configuration with zero external dependencies."""

    def __init__(self):
        self.ENV: str = os.environ.get("ENV", "production")
        self.FRONTEND_URL: str = os.environ.get("FRONTEND_URL", "https://ping-bin-qorc.vercel.app")

        # AWS Configuration
        self.AWS_REGION: str = os.environ.get("AWS_REGION", "ap-south-1")
        self.AWS_PROFILE: str | None = os.environ.get("AWS_PROFILE") or None
        self.DYNAMODB_TABLE_REPORTS: str = os.environ.get("DYNAMODB_TABLE_REPORTS", "Reports")
        self.DYNAMODB_TABLE_WORKERS: str = os.environ.get("DYNAMODB_TABLE_WORKERS", "Workers")
        self.DYNAMODB_TABLE_VENDORS: str = os.environ.get("DYNAMODB_TABLE_VENDORS", "Vendors")
        self.DYNAMODB_TABLE_COUPONS: str = os.environ.get("DYNAMODB_TABLE_COUPONS", "Coupons")
        self.DYNAMODB_TABLE_WAREHOUSES: str = os.environ.get("DYNAMODB_TABLE_WAREHOUSES", "Warehouses")
        self.S3_BUCKET_IMAGES: str = os.environ.get("S3_BUCKET_IMAGES", "cleanloop-images-ap-south-1")
        self.SQS_QUEUE_URL: str = os.environ.get(
            "SQS_QUEUE_URL",
            "https://sqs.ap-south-1.amazonaws.com/123456789012/pingbin-messages",
        )
        self.BEDROCK_MODEL_ID: str = os.environ.get("BEDROCK_MODEL_ID", "amazon.nova-lite-v1:0")

        # Thresholds
        self.WORKER_SEARCH_RADIUS_KM: float = float(os.environ.get("WORKER_SEARCH_RADIUS_KM", "10.0"))
        self.VENDOR_LOCAL_RADIUS_KM: float = float(os.environ.get("VENDOR_LOCAL_RADIUS_KM", "15.0"))
        self.TEST_MODE_SECONDS: bool = os.environ.get("TEST_MODE_SECONDS", "false").lower() in (
            "true",
            "1",
            "yes",
        )

        # Twilio WhatsApp
        self.TWILIO_ACCOUNT_SID: str = os.environ.get("TWILIO_ACCOUNT_SID", "")
        self.TWILIO_AUTH_TOKEN: str = os.environ.get("TWILIO_AUTH_TOKEN", "")
        self.TWILIO_WHATSAPP_FROM: str = os.environ.get("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")

    def get_boto3_session(self) -> boto3.Session:
        """Create a boto3 Session.

        If ENV == 'dev', applies local AWS_PROFILE and AWS_REGION.
        In production (AWS Lambda), directly creates boto3.Session() using IAM role.
        """
        if self.ENV and self.ENV.strip().lower() == "dev":
            kwargs = {}
            if self.AWS_PROFILE and self.AWS_PROFILE.strip():
                kwargs["profile_name"] = self.AWS_PROFILE.strip()
            if self.AWS_REGION and self.AWS_REGION.strip():
                kwargs["region_name"] = self.AWS_REGION.strip()
            try:
                return boto3.Session(**kwargs)
            except Exception:
                pass

        # Production / AWS Lambda direct IAM role session
        return boto3.Session()


settings = Settings()
