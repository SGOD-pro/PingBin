import os
import sys
import unittest
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta, timezone
from decimal import Decimal

# Ensure backend/src is in sys.path
SRC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend/src"))
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

import processor
from utils import dynamo

class TestIntakeHardening(unittest.TestCase):
    def setUp(self):
        self.citizen_phone = "+919876543210"
        self.worker_phone = "+919876543299"
        self.sent_messages = []

    def mock_send_whatsapp(self, to: str, text: str):
        self.sent_messages.append({"to": to, "text": text})
        return True

    @patch("processor.send_whatsapp")
    @patch("utils.bedrock.classify_image_base64")
    def test_1_image_first_then_location(self, mock_classify, mock_send):
        mock_send.side_effect = self.mock_send_whatsapp
        mock_classify.return_value = {
            "is_valid_report": True,
            "waste_type": "plastic",
            "fill_percent": 80,
            "urgency": "high",
            "estimated_workers_needed": 1,
            "estimated_minutes_to_clean": 40,
            "confidence": 90,
            "suspicious_flag": False,
            "segregation_quality": "proper",
        }

        # Step 1: Send Photo first
        photo_msg = {
            "sender_phone": self.citizen_phone,
            "message_type": "photo",
            "media_url": "http://localhost:8000/images/dustbins-india-T5BHA9.jpg",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        report_id = processor.handle_photo(photo_msg)
        self.assertIsNotNone(report_id)

        # Check DB state after photo
        report = dynamo.get_report_by_id(report_id)
        self.assertIsNotNone(report)
        self.assertEqual(report["status"], "awaiting_location")
        self.assertTrue(report.get("has_photo"))
        self.assertFalse(report.get("has_location"))
        self.assertIsNone(report.get("priority_score"))

        # Step 2: Send Location second
        loc_msg = {
            "sender_phone": self.citizen_phone,
            "message_type": "location",
            "latitude": 20.3533,
            "longitude": 85.8197,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        processor.handle_location(loc_msg)

        # Check DB state after location
        report_after = dynamo.get_report_by_id(report_id)
        self.assertIn(report_after["status"], ["pending", "assigned"])
        self.assertTrue(report_after.get("has_location"))
        self.assertIsNotNone(report_after.get("priority_score"))

    @patch("processor.send_whatsapp")
    @patch("utils.bedrock.classify_image_base64")
    def test_2_location_first_then_image(self, mock_classify, mock_send):
        mock_send.side_effect = self.mock_send_whatsapp
        mock_classify.return_value = {
            "is_valid_report": True,
            "waste_type": "mixed",
            "fill_percent": 70,
            "urgency": "medium",
            "estimated_workers_needed": 1,
            "estimated_minutes_to_clean": 30,
            "confidence": 85,
            "suspicious_flag": False,
            "segregation_quality": "mixed",
        }

        # Step 1: Send Location first
        loc_phone = "+919876543211"
        loc_msg = {
            "sender_phone": loc_phone,
            "message_type": "location",
            "latitude": 20.3580,
            "longitude": 85.8200,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        processor.handle_location(loc_msg)

        # Check that awaiting_photo report was created
        active, _ = dynamo.find_active_intake_by_phone(loc_phone)
        self.assertIsNotNone(active)
        self.assertEqual(active["status"], "awaiting_photo")
        self.assertFalse(active.get("has_photo"))
        self.assertTrue(active.get("has_location"))
        report_id = active["report_id"]

        # Step 2: Send Photo second
        photo_msg = {
            "sender_phone": loc_phone,
            "message_type": "photo",
            "media_url": "http://localhost:8000/images/dustbins-india-T5BHA9.jpg",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        res_id = processor.handle_photo(photo_msg)
        self.assertEqual(res_id, report_id)

        # Check DB state after photo
        report_after = dynamo.get_report_by_id(report_id)
        self.assertIn(report_after["status"], ["pending", "assigned"])
        self.assertTrue(report_after.get("has_photo"))
        self.assertIsNotNone(report_after.get("priority_score"))

    @patch("processor.send_whatsapp")
    @patch("utils.bedrock.classify_image_base64")
    def test_3_intake_timeout_5_minutes(self, mock_classify, mock_send):
        mock_send.side_effect = self.mock_send_whatsapp
        mock_classify.return_value = {
            "is_valid_report": True,
            "waste_type": "organic",
            "fill_percent": 60,
            "urgency": "low",
            "estimated_workers_needed": 1,
            "estimated_minutes_to_clean": 20,
            "confidence": 80,
            "suspicious_flag": False,
            "segregation_quality": "proper",
        }

        timeout_phone = "+919876543212"
        # Seed an old awaiting_photo report created 10 minutes ago
        old_time = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
        old_report_id = f"test-timeout-{datetime.now().timestamp()}"
        dynamo.create_awaiting_photo_report(
            report_id=old_report_id,
            citizen_phone=timeout_phone,
            lat=20.35,
            lng=85.82,
            timestamp=old_time,
        )

        # New message from citizen should trigger timeout check
        active, is_timed_out = dynamo.find_active_intake_by_phone(timeout_phone, timeout_seconds=300)
        self.assertTrue(is_timed_out)
        self.assertIsNone(active)

        # Old report must now be expired in DynamoDB
        old_item = dynamo.get_report_by_id(old_report_id)
        self.assertEqual(old_item["status"], "expired")

    @patch("processor.send_whatsapp")
    def test_4_admin_reject_sends_warning(self, mock_send):
        mock_send.side_effect = self.mock_send_whatsapp

        fake_report_id = f"test-fake-{datetime.now().timestamp()}"
        fake_phone = "+919876543213"
        dynamo.save_raw_pending_report(fake_report_id, fake_phone, datetime.now(timezone.utc).isoformat())
        dynamo.set_report_pending_admin_review(
            fake_report_id,
            "http://example.com/fake.jpg",
            {"confidence": 10, "suspicious_flag": True, "waste_type": "unknown", "segregation_quality": "improper"},
        )

        # Reject via API event
        event = {
            "resource": "/reports/{id}/reject",
            "path": f"/reports/{fake_report_id}/reject",
            "httpMethod": "POST",
        }
        res = processor.lambda_handler(event)
        self.assertEqual(res["statusCode"], 200)

        # Check DB is rejected
        rep = dynamo.get_report_by_id(fake_report_id)
        self.assertEqual(rep["status"], "rejected")

        # Check citizen was sent warning
        warning_msg = next((m for m in self.sent_messages if m["to"] == fake_phone), None)
        self.assertIsNotNone(warning_msg)
        self.assertIn("not a valid waste complaint", warning_msg["text"])

    def test_5_dashboard_visibility_filter(self):
        # Create an awaiting_photo, awaiting_location, and expired item
        t = datetime.now(timezone.utc).isoformat()
        dynamo.create_awaiting_photo_report("filter-await-photo", "+919000000001", 20.3, 85.8, t)
        dynamo.create_awaiting_location_report("filter-await-loc", "+919000000002", "http://example.com/p.jpg", {}, t)
        dynamo.expire_report("filter-expired")

        active_reports = dynamo.get_active_reports()
        statuses = [r.get("status") for r in active_reports]
        ids = [r.get("report_id") for r in active_reports]

        self.assertNotIn("awaiting_photo", statuses)
        self.assertNotIn("awaiting_location", statuses)
        self.assertNotIn("expired", statuses)
        self.assertNotIn("filter-await-photo", ids)
        self.assertNotIn("filter-await-loc", ids)
        self.assertNotIn("filter-expired", ids)

if __name__ == "__main__":
    unittest.main()
