import json
import pytest
import urllib.parse
from unittest.mock import patch, MagicMock

# Mocking env vars before importing lambdas
@pytest.fixture(autouse=True)
def mock_env(monkeypatch):
    monkeypatch.setenv("SQS_QUEUE_URL", "https://sqs.mock")
    monkeypatch.setenv("DYNAMODB_TABLE_REPORTS", "MockReports")
    monkeypatch.setenv("DYNAMODB_TABLE_WORKERS", "MockWorkers")

# Since the src modules are in `src/`, let's import them
# We might need to adjust sys.path if this was run standalone,
# but pytest usually handles this if configured properly.
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../src')))

from webhook_receiver import lambda_handler as webhook_handler
from processor import lambda_handler as processor_handler

@patch('webhook_receiver.sqs_client.send_message')
def test_webhook_receiver(mock_send_message):
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
    mock_send_message.assert_called_once()
    
    sent_msg = json.loads(mock_send_message.call_args[1]['MessageBody'])
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
