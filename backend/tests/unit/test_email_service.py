"""Unit tests for the Resend email dispatch."""

import app.services.email_service as email_service


def test_send_mfa_code_calls_resend_with_expected_payload(monkeypatch):
    captured = {}

    def fake_send(payload):
        captured.update(payload)

    monkeypatch.setattr(email_service.resend.Emails, "send", fake_send)

    email_service.send_mfa_code("admin@savanna.com", "123456")

    assert captured["to"] == ["admin@savanna.com"]
    assert captured["from"] == email_service.settings.RESEND_FROM_ADDRESS
    assert "123456" in captured["html"]
    assert "verification code" in captured["subject"].lower()
