import json
import pytest
import urllib.parse
import sys
import os
from unittest.mock import patch, MagicMock

# Configure environment before importing Lambda modules
os.environ.setdefault("AWS_DEFAULT_REGION", "ap-south-1")
os.environ.setdefault("AWS_REGION", "ap-south-1")
os.environ.setdefault("SQS_QUEUE_URL", "https://sqs.mock")
os.environ.setdefault("DYNAMODB_TABLE_REPORTS", "MockReports")
os.environ.setdefault("DYNAMODB_TABLE_WORKERS", "MockWorkers")

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../src')))

from webhook_receiver import lambda_handler as webhook_handler
from processor import lambda_handler as processor_handler


@pytest.fixture(autouse=True)
def mock_env(monkeypatch):
    monkeypatch.setenv("AWS_DEFAULT_REGION", "ap-south-1")
    monkeypatch.setenv("AWS_REGION", "ap-south-1")
    monkeypatch.setenv("SQS_QUEUE_URL", "https://sqs.mock")
    monkeypatch.setenv("DYNAMODB_TABLE_REPORTS", "MockReports")
    monkeypatch.setenv("DYNAMODB_TABLE_WORKERS", "MockWorkers")


@patch('webhook_receiver.sqs_client')
def test_webhook_receiver(mock_sqs):
    body_data = {
        'From': 'whatsapp:+919876543210',
        'Body': 'Hello',
        'MessageSid': 'SM1234'
    }
    encoded_body = urllib.parse.urlencode(body_data)
    
    event = {
        'httpMethod': 'POST',
        'resource': '/webhook',
        'body': encoded_body
    }
    
    # Act
    response = webhook_handler(event, None)
    
    # Assert
    assert response['statusCode'] == 200
    mock_sqs.send_message.assert_called_once()
    
    sent_msg = json.loads(mock_sqs.send_message.call_args[1]['MessageBody'])
    assert sent_msg['sender_phone'] == '+919876543210'
    assert sent_msg['message_type'] == 'text'
    assert sent_msg['body_text'] == 'Hello'

@patch('processor.get_active_reports')
def test_processor_api_gateway_get(mock_get_active_reports):
    # Setup mock DynamoDB response
    mock_get_active_reports.return_value = [
        {'report_id': '1', 'status': 'pending'}
    ]
    
    event = {
        'httpMethod': 'GET',
        'resource': '/reports'
    }
    
    # Act
    response = processor_handler(event, None)
    
    # Assert
    assert response['statusCode'] == 200
    body = json.loads(response['body'])
    assert len(body) == 1
    assert body[0]['report_id'] == '1'
