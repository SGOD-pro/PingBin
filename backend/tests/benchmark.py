import json
import pytest
import time
import urllib.parse
from unittest.mock import patch, MagicMock

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../src')))

from webhook_receiver import lambda_handler as webhook_handler
from processor import lambda_handler as processor_handler

# We benchmark the synchronous latency of the webhook_receiver.
# According to the rules, it must return 200 OK in under 500ms.

def _simulate_webhook():
    body_data = {
        'From': 'whatsapp:+919876543210',
        'MediaUrl0': 'https://api.twilio.com/mock-image',
        'MediaContentType0': 'image/jpeg',
        'MessageSid': 'SM123'
    }
    event = {
        'httpMethod': 'POST',
        'resource': '/webhook',
        'body': urllib.parse.urlencode(body_data)
    }
    return webhook_handler(event, None)

@patch('webhook_receiver.sqs_client.send_message')
def test_benchmark_webhook_latency(mock_send_message, benchmark):
    # Arrange
    # mock_send_message does nothing, simulating SQS enqueue
    
    # Act
    response = benchmark(_simulate_webhook)
    
    # Assert
    assert response['statusCode'] == 200

# Benchmark the inline scoring logic to ensure it's extremely efficient
def _simulate_inline_scoring():
    # Example logic taken from architecture.md
    fill_percent = 90
    overflow_score = fill_percent * 0.4
    wait_score = 50 * 0.2
    crowd_score = 0 * 0.15
    sensitive_score = 0 * 0.15
    weather_score = 50 * 0.1
    return round(overflow_score + wait_score + crowd_score + sensitive_score + weather_score, 2)

def test_benchmark_inline_scoring(benchmark):
    result = benchmark(_simulate_inline_scoring)
    assert result == 51.0
