"""email via Resend."""

import resend

from app.core.config import settings

resend.api_key = settings.RESEND_API_KEY


def send_mfa_code(to_email: str, code: str) -> None:
    minutes = settings.MFA_CODE_TTL_SECONDS // 60
    resend.Emails.send(
        {
            "from": settings.RESEND_FROM_ADDRESS,
            "to": [to_email],
            "subject": "Savanna Sentinel verification code",
            "html": (
                "<p>Your verification code is:</p>"
                '<p style="font-size:28px;font-weight:600;'
                f'letter-spacing:6px;">{code}</p>'
                f"<p>This code expires in {minutes} minutes. "
                "If you did not request this, you can ignore this email.</p>"
            ),
        },
    )
