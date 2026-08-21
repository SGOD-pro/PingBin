# ⚡ WhatsApp Intake & Webhook Decoupler

> **M&A Trading Floor Asset ID:** `MOD-WHATSAPP-INTAKE-03`  
> **Target Asking Price:** **₹3.00 – ₹3.50 Cr Credits**  
> **Type:** High-Throughput Ingestion & Async Decoupling IP  
> **Dependencies:** `boto3` (AWS Lambda Built-in / Python 3.10+)

---

## 🎯 Executive Overview & Value Proposition

A zero-friction, serverless Twilio WhatsApp webhook intake processor designed for AWS Lambda and API Gateway.

It solves the critical 15-second Twilio webhook timeout problem by immediately returning a standard `<Response></Response>` XML ACK (<100ms) while reliably normalizing and forwarding rich multimedia, location pins, and text payloads into an AWS SQS queue for async processing.

---

## 🚀 Key Features
- **Instant Twilio ACK (<100ms):** Guarantees zero Twilio 11200 / 15-second timeout failures.
- **Automatic Multi-Type Detection:** Intelligently identifies whether an incoming message is a **photo upload**, **live GPS pin**, or **text command**.
- **Asynchronous SQS Decoupling:** Flushes normalized JSON payloads to an SQS queue for downstream workers and LLMs.
- **Pure Serverless Architecture:** Optimized for AWS API Gateway HTTP/REST Proxy Integration + AWS Lambda.

---

## 🔌 Interface Specification & Strict Contract

### Function Signature
```python
def handle_webhook(event: dict) -> dict:
```

### Input Contract (AWS Lambda Event)
```json
{
  "resource": "/webhook",
  "path": "/webhook",
  "httpMethod": "POST",
  "headers": {"Content-Type": "application/x-www-form-urlencoded"},
  "body": "From=whatsapp%3A%2B919084686979&To=whatsapp%3A%2B14155238886&NumMedia=1&MediaUrl0=https%3A%2F%2Fapi.twilio.com%2F...&MessageSid=SM123"
}
```

### Output Contract (API Gateway HTTP Response)
```json
{
  "statusCode": 200,
  "headers": {
    "Content-Type": "application/xml"
  },
  "body": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<Response></Response>"
}
```

### Downstream SQS Normalized Message Payload
```json
{
  "sender_phone": "+919084686979",
  "message_type": "photo",
  "media_url": "https://api.twilio.com/...",
  "latitude": null,
  "longitude": null,
  "body_text": "",
  "received_at": 1755787000,
  "message_sid": "SM123"
}
```

---

## 🔌 Plug-and-Play Integration Across Problem Statements

### 1. Problem Statement 1 (Urban Waste Citizen Intake)
```python
from handler import handle_webhook

def lambda_handler(event, context):
    # Instant ACK to citizen, async dispatch to waste classification queue
    return handle_webhook(event)
```

### 2. Problem Statement 4 (E-Commerce Customer Support & Return Photos)
```python
# Accept customer damaged-item return photos via WhatsApp without keeping webhook connections open
def customer_service_webhook(event, context):
    return handle_webhook(event)
```

### 3. Problem Statement 6 (Public Grievance & Civic Pothole Reporting)
```python
# Citizen snaps photo of broken streetlight or pothole -> instant acknowledgement
def grievance_intake_handler(event, context):
    return handle_webhook(event)
```

### 4. Problem Statement 9 (Emergency Distress & SOS Beacon Location Sharing)
```python
# Capture victims' live GPS location pins via WhatsApp during floods/earthquakes
def sos_intake_handler(event, context):
    return handle_webhook(event)
```

---

## 🛠️ Quick Test

```bash
python3 -c "
from handler import handle_webhook
res = handle_webhook({
    'body': 'From=whatsapp%3A%2B919084686979&Body=PingBin%20Verification'
})
print('Test Output:', res)
assert res['statusCode'] == 200
assert '<Response></Response>' in res['body']
"
```
