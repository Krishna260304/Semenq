
from __future__ import annotations

from abc import ABC, abstractmethod



class BaseEmailProvider(ABC):
    @abstractmethod
    async def send(self, to: str, subject: str, html_body: str) -> bool:
        ...


class BaseSMSProvider(ABC):
    @abstractmethod
    async def send(self, to: str, body: str) -> bool:
        ...


class BasePushProvider(ABC):
    @abstractmethod
    async def send(self, device_token: str, title: str, body: str, data: dict) -> bool:
        ...

    @abstractmethod
    async def send_multicast(self, tokens: list[str], title: str, body: str, data: dict) -> int:
        ...



class SMTPEmailProvider(BaseEmailProvider):
    async def send(self, to: str, subject: str, html_body: str) -> bool:
        try:
            from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType
            from app.core.config import get_settings
            settings = get_settings()

            conf = ConnectionConfig(
                MAIL_USERNAME=settings.MAIL_USERNAME,
                MAIL_PASSWORD=settings.MAIL_PASSWORD,
                MAIL_FROM=settings.MAIL_FROM,
                MAIL_PORT=settings.MAIL_PORT,
                MAIL_SERVER=settings.MAIL_SERVER,
                MAIL_STARTTLS=settings.MAIL_STARTTLS,
                MAIL_SSL_TLS=settings.MAIL_SSL_TLS,
                MAIL_FROM_NAME=settings.MAIL_FROM_NAME,
                USE_CREDENTIALS=True,
            )
            message = MessageSchema(
                subject=subject,
                recipients=[to],
                body=html_body,
                subtype=MessageType.html,
            )
            fm = FastMail(conf)
            await fm.send_message(message)
            return True
        except Exception as exc:
            from app.core.logging.logger import get_logger
            get_logger(__name__).error("Email send failed", to=to, error=str(exc))
            return False



class TwilioSMSProvider(BaseSMSProvider):
    async def send(self, to: str, body: str) -> bool:
        try:
            import asyncio
            from twilio.rest import Client
            from app.core.config import get_settings
            settings = get_settings()

            def _send():
                client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
                client.messages.create(to=to, from_=settings.TWILIO_PHONE_NUMBER, body=body)

            await asyncio.get_event_loop().run_in_executor(None, _send)
            return True
        except Exception as exc:
            from app.core.logging.logger import get_logger
            get_logger(__name__).error("SMS send failed", to=to, error=str(exc))
            return False



class FirebasePushProvider(BasePushProvider):
    def __init__(self) -> None:
        self._initialized = False

    def _ensure_initialized(self) -> None:
        if not self._initialized:
            from app.core.config import get_settings
            import firebase_admin
            from firebase_admin import credentials
            settings = get_settings()
            if settings.FIREBASE_CREDENTIALS_FILE and not firebase_admin._apps:
                cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_FILE)
                firebase_admin.initialize_app(cred)
            self._initialized = True

    async def send(self, device_token: str, title: str, body: str, data: dict) -> bool:
        try:
            import asyncio
            from firebase_admin import messaging
            self._ensure_initialized()

            def _send():
                message = messaging.Message(
                    notification=messaging.Notification(title=title, body=body),
                    data={str(k): str(v) for k, v in data.items()},
                    token=device_token,
                )
                messaging.send(message)

            await asyncio.get_event_loop().run_in_executor(None, _send)
            return True
        except Exception as exc:
            from app.core.logging.logger import get_logger
            get_logger(__name__).error("Push send failed", error=str(exc))
            return False

    async def send_multicast(self, tokens: list[str], title: str, body: str, data: dict) -> int:
        try:
            import asyncio
            from firebase_admin import messaging
            self._ensure_initialized()

            def _send():
                message = messaging.MulticastMessage(
                    notification=messaging.Notification(title=title, body=body),
                    data={str(k): str(v) for k, v in data.items()},
                    tokens=tokens,
                )
                return messaging.send_each_for_multicast(message)

            response = await asyncio.get_event_loop().run_in_executor(None, _send)
            return response.success_count
        except Exception:
            return 0
