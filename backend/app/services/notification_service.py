
from __future__ import annotations

from typing import Optional

from app.core.logging.logger import get_logger
from app.models.notification import Notification, NotificationChannel, NotificationStatus, NotificationType
from app.providers.notifications.providers import FirebasePushProvider, SMTPEmailProvider, TwilioSMSProvider

logger = get_logger(__name__)


class NotificationService:
    
    def __init__(self) -> None:
        self._email = SMTPEmailProvider()
        self._sms = TwilioSMSProvider()
        self._push = FirebasePushProvider()

    async def send_email_verification(self, email: str, name: str, token: str) -> None:
        subject = "Semenq - Verify your email address"
        body = f"""
        <html>
            <body>
                <h2>Welcome to Semenq, {name}!</h2>
                <p>Your verification code is: <strong>{token}</strong></p>
                <p>Or click <a href="https://semenq.com/verify?token={token}">here</a> to verify.</p>
            </body>
        </html>
        <html>
            <body>
                <h2>Password Reset Request</h2>
                <p>Your password reset code is: <strong>{token}</strong></p>
                <p>If you did not request this, please ignore this email.</p>
            </body>
        </html>
Creates a notification record. A background worker should pick this up and send it."""
        notification = Notification(
            user_id=user_id,
            notification_type=n_type,
            channel=channel,
            title=title,
            body=body,
            reference_id=reference_id,
            metadata=data or {},
        )
        await notification.insert()
        return notification

    async def process_notification(self, notification_id: str) -> None:
        notification = await Notification.find_one(Notification.id == notification_id)
        if not notification or notification.status != NotificationStatus.PENDING:
            return

        from app.models.user import User
        user = await User.find_one(User.id == notification.user_id)
        if not user:
            notification.status = NotificationStatus.FAILED
            notification.failure_reason = "User not found"
            await notification.save()
            return

        notification.status = NotificationStatus.SENDING
        await notification.save()

        success = False
        try:
            if notification.channel == NotificationChannel.EMAIL:
                success = await self._email.send(
                    to=user.email,
                    subject=notification.title,
                    html_body=notification.body
                )
            elif notification.channel == NotificationChannel.SMS:
                success = await self._sms.send(
                    to=user.phone,
                    body=f"{notification.title}\n{notification.body}"
                )
            elif notification.channel == NotificationChannel.PUSH:
                from app.models.user import Device
                devices = await Device.find(Device.user_id == user.id, Device.push_token != None).to_list()
                tokens = [d.push_token for d in devices if d.push_token]
                if tokens:
                    success_count = await self._push.send_multicast(
                        tokens=tokens,
                        title=notification.title,
                        body=notification.body,
                        data=notification.metadata
                    )
                    success = success_count > 0
                else:
                    success = False
                    notification.failure_reason = "No push tokens available"

        except Exception as exc:
            logger.error("Notification processing failed", error=str(exc))
            success = False
            notification.failure_reason = str(exc)

        if success:
            from datetime import datetime, timezone
            notification.status = NotificationStatus.SENT
            notification.sent_at = datetime.now(timezone.utc)
        else:
            notification.status = NotificationStatus.FAILED
            notification.retry_count += 1
        
        await notification.save()
