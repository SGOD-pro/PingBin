from pathlib import Path
import boto3
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """PingBin backend environment configuration powered by Pydantic."""

    model_config = SettingsConfigDict(
        env_file=(
            str(Path(__file__).resolve().parent / ".env"),
            str(Path(__file__).resolve().parent.parent / ".env"),
            str(Path(__file__).resolve().parent.parent.parent / ".env"),
            ".env",
        ),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    ENV: str = "production"
    FRONTEND_URL: str = "https://ping-bin-qorc.vercel.app"

    # AWS Configuration
    AWS_REGION: str = "ap-south-1"
    AWS_PROFILE: str | None = None
    DYNAMODB_TABLE_REPORTS: str = "Reports"
    DYNAMODB_TABLE_WORKERS: str = "Workers"
    DYNAMODB_TABLE_VENDORS: str = "Vendors"
    DYNAMODB_TABLE_COUPONS: str = "Coupons"
    DYNAMODB_TABLE_WAREHOUSES: str = "Warehouses"
    S3_BUCKET_IMAGES: str = "cleanloop-images-ap-south-1"
    SQS_QUEUE_URL: str = "https://sqs.ap-south-1.amazonaws.com/123456789012/pingbin-messages"
    BEDROCK_MODEL_ID: str = "amazon.nova-lite-v1:0"

    # Thresholds
    WORKER_SEARCH_RADIUS_KM: float = 10.0
    VENDOR_LOCAL_RADIUS_KM: float = 15.0
    TEST_MODE_SECONDS: bool = False

    # Twilio WhatsApp
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_WHATSAPP_FROM: str = "whatsapp:+14155238886"

    def get_boto3_session(self) -> boto3.Session:
        """Create a boto3 Session.

        Always applies region_name (defaults to ap-south-1).
        If ENV == 'dev', applies local AWS_PROFILE if specified.
        """
        region = self.AWS_REGION or "ap-south-1"
        kwargs = {"region_name": region}
        if self.ENV and self.ENV.strip().lower() == "dev" and self.AWS_PROFILE and self.AWS_PROFILE.strip():
            kwargs["profile_name"] = self.AWS_PROFILE.strip()
        try:
            return boto3.Session(**kwargs)
        except Exception:
            try:
                return boto3.Session(region_name=region)
            except Exception:
                return boto3.Session()


settings = Settings()
