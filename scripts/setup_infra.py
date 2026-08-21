import logging
import sys
import boto3

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("setup_infra")

session = boto3.Session(profile_name="aws", region_name="ap-south-1")
dynamodb = session.client("dynamodb")
sqs = session.client("sqs")
s3 = session.client("s3")


def setup_dynamodb():
    existing_tables = dynamodb.list_tables().get("TableNames", [])
    
    # 1. Reports Table
    if "Reports" not in existing_tables:
        logger.info("Creating DynamoDB table: Reports...")
        dynamodb.create_table(
            TableName="Reports",
            KeySchema=[
                {"AttributeName": "report_id", "KeyType": "HASH"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "report_id", "AttributeType": "S"},
                {"AttributeName": "status", "AttributeType": "S"},
                {"AttributeName": "created_at", "AttributeType": "S"},
            ],
            GlobalSecondaryIndexes=[
                {
                    "IndexName": "status-index",
                    "KeySchema": [
                        {"AttributeName": "status", "KeyType": "HASH"},
                        {"AttributeName": "created_at", "KeyType": "RANGE"},
                    ],
                    "Projection": {"ProjectionType": "ALL"},
                }
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        logger.info("Table Reports created successfully!")
    else:
        logger.info("Table Reports already exists.")

    # 2. Workers Table
    if "Workers" not in existing_tables:
        logger.info("Creating DynamoDB table: Workers...")
        dynamodb.create_table(
            TableName="Workers",
            KeySchema=[
                {"AttributeName": "worker_id", "KeyType": "HASH"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "worker_id", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        logger.info("Table Workers created successfully!")
    else:
        logger.info("Table Workers already exists.")

    # 3. Vendors Table
    if "Vendors" not in existing_tables:
        logger.info("Creating DynamoDB table: Vendors...")
        dynamodb.create_table(
            TableName="Vendors",
            KeySchema=[
                {"AttributeName": "vendor_id", "KeyType": "HASH"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "vendor_id", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        logger.info("Table Vendors created successfully!")
    else:
        logger.info("Table Vendors already exists.")

    # 4. Coupons Table
    if "Coupons" not in existing_tables:
        logger.info("Creating DynamoDB table: Coupons...")
        dynamodb.create_table(
            TableName="Coupons",
            KeySchema=[
                {"AttributeName": "coupon_id", "KeyType": "HASH"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "coupon_id", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        logger.info("Table Coupons created successfully!")
    else:
        logger.info("Table Coupons already exists.")


def setup_sqs():
    logger.info("Creating SQS queue: cleanloop-messages...")
    try:
        response = sqs.create_queue(
            QueueName="cleanloop-messages",
            Attributes={
                "VisibilityTimeout": "300",
                "MessageRetentionPeriod": "3600",
            },
        )
        queue_url = response.get("QueueUrl")
        logger.info(f"SQS queue created/found: {queue_url}")
        return queue_url
    except Exception as e:
        logger.error(f"Error creating SQS queue: {e}")
        return None


def setup_s3():
    bucket_name = "cleanloop-images-ap-south-1"
    logger.info(f"Checking/creating S3 bucket: {bucket_name}...")
    try:
        s3.create_bucket(
            Bucket=bucket_name,
            CreateBucketConfiguration={"LocationConstraint": "ap-south-1"},
        )
        logger.info(f"S3 bucket {bucket_name} created successfully!")
    except s3.exceptions.BucketAlreadyOwnedByYou:
        logger.info(f"S3 bucket {bucket_name} already exists and owned by you.")
    except Exception as e:
        logger.warning(f"S3 bucket notice: {e}")
    return bucket_name


if __name__ == "__main__":
    setup_dynamodb()
    queue_url = setup_sqs()
    bucket_name = setup_s3()
    print(f"\n--- INFRA SETUP RESULTS ---")
    print(f"SQS_QUEUE_URL={queue_url}")
    print(f"S3_BUCKET_IMAGES={bucket_name}")
