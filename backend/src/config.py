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
