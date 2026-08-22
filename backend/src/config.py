from pydantic_settings import BaseSettings, SettingsConfigDict
import boto3
import os


class Settings(BaseSettings):
    """PingBin backend environment configuration using Pydantic BaseSettings."""

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env", "../../.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    ENV: str = "dev"

    # AWS
    AWS_REGION: str = "ap-south-1"
    AWS_PROFILE: str | None = None
    DYNAMODB_TABLE_REPORTS: str = "Reports"
    DYNAMODB_TABLE_WORKERS: str = "Workers"
    DYNAMODB_TABLE_VENDORS: str = "Vendors"
    DYNAMODB_TABLE_COUPONS: str = "Coupons"
    S3_BUCKET_IMAGES: str = "pingbin-images"
    SQS_QUEUE_URL: str = "https://sqs.ap-south-1.amazonaws.com/123456789012/pingbin-messages"
    BEDROCK_MODEL_ID: str = "amazon.nova-lite-v1:0"
    # Max radius (km) for free-worker search during dispatch
    WORKER_SEARCH_RADIUS_KM: float = 10.0
    # Max radius (km) for local vendor coupon matching
    VENDOR_LOCAL_RADIUS_KM: float = 15.0
    # Testing speedup flag: dynamically read from TEST_MODE_SECONDS in .env/environment (defaults to False in prod)
    TEST_MODE_SECONDS: bool = False

    # Twilio WhatsApp
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_WHATSAPP_FROM: str = "whatsapp:+14155238886"

    def get_boto3_session(self) -> boto3.Session:
        """Create a boto3 Session.

        If ENV == 'dev', applies local AWS_PROFILE and AWS_REGION.
        In production / Lambda deployment, directly creates boto3.Session() using the IAM role.
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

        # Production / Lambda direct IAM session
        return boto3.Session()


settings = Settings()
