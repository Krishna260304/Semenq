from __future__ import annotations

from app.core.logging.logger import get_logger
from app.providers.notifications.providers import SMTPEmailProvider

logger = get_logger(__name__)


class NotificationService:
    def __init__(self) -> None:
        self._email = SMTPEmailProvider()

    async def send_email_verification(self, email: str, name: str, token: str) -> bool:
        subject = "Semenq - 6-digit verification code"
        body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; color: #111827;">
                <h2>Welcome to Semenq, {name}!</h2>
                <p>Your 6-digit verification code is: <strong>{token}</strong></p>
                <p>If you did not request this, you can safely ignore this message.</p>
            </body>
        </html>
        """
        return await self._email.send(to=email, subject=subject, html_body=body)

    async def send_password_reset(self, email: str, token: str) -> bool:
        subject = "Semenq - 6-digit password reset code"
        body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; color: #111827;">
                <h2>Password Reset Request</h2>
                <p>Your 6-digit password reset code is: <strong>{token}</strong></p>
                <p>If you did not request this, please ignore this email.</p>
            </body>
        </html>
        """
        return await self._email.send(to=email, subject=subject, html_body=body)
