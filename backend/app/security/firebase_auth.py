from __future__ import annotations

import firebase_admin
from firebase_admin import auth, credentials
from app.core.config import get_settings
from app.core.logging.logger import get_logger

logger = get_logger(__name__)
settings = get_settings()

_firebase_app = None


def init_firebase() -> None:
    global _firebase_app
    if _firebase_app:
        return

    try:
        # Reuse an already-initialized default app if another module started Firebase first.
        try:
            _firebase_app = firebase_admin.get_app()
            logger.info("Reusing existing Firebase Admin app.")
            return
        except ValueError:
            pass

        if not settings.FIREBASE_CREDENTIALS_FILE:
            logger.warning("FIREBASE_CREDENTIALS_FILE not set. Firebase Auth will not work.")
            return

        import os

        if not os.path.exists(settings.FIREBASE_CREDENTIALS_FILE):
            logger.warning(f"Firebase credentials file not found at {settings.FIREBASE_CREDENTIALS_FILE}")
            return

        cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_FILE)
        _firebase_app = firebase_admin.initialize_app(cred)
        logger.info("Firebase Admin initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize Firebase Admin: {e}")


def verify_firebase_token(id_token: str) -> dict:
    token = (id_token or "").strip()
    if not token:
        raise ValueError("Firebase ID token is missing.")

    if not _firebase_app:
        init_firebase()

    if not _firebase_app:
        logger.error("Firebase is not initialized. Cannot verify token.")
        raise ValueError("Firebase is not initialized.")

    try:
        return auth.verify_id_token(token, app=_firebase_app, clock_skew_seconds=60)
    except auth.ExpiredIdTokenError as e:
        logger.warning(f"Firebase token verification failed: {e}")
        raise ValueError("Firebase ID token has expired. Please sign in again.")
    except auth.RevokedIdTokenError as e:
        logger.warning(f"Firebase token verification failed: {e}")
        raise ValueError("Firebase ID token was revoked. Please sign in again.")
    except auth.InvalidIdTokenError as e:
        logger.error(f"Firebase token verification failed: {e}")
        raise ValueError("Invalid Firebase ID token.")
    except auth.CertificateFetchError as e:
        logger.error(f"Firebase token verification failed: {e}")
        raise ValueError("Unable to verify Firebase ID token right now. Please try again.")
    except auth.UserDisabledError as e:
        logger.warning(f"Firebase token verification failed: {e}")
        raise ValueError("The Firebase account is disabled.")
    except ValueError as e:
        logger.error(f"Firebase token verification failed: {e}")
        raise
    except Exception as e:
        logger.error(f"Firebase token verification failed: {e}")
        raise ValueError("Unable to verify Firebase ID token.")


def get_or_create_firebase_user(uid: str, email: str, display_name: str = "", email_verified: bool = False):
    token = (email or "").strip().lower()
    if not token:
        raise ValueError("Email is required to resolve the Firebase user.")

    if not _firebase_app:
        init_firebase()

    if not _firebase_app:
        logger.error("Firebase is not initialized. Cannot resolve Firebase user.")
        raise ValueError("Firebase is not initialized.")

    try:
        return auth.get_user_by_email(token, app=_firebase_app)
    except auth.UserNotFoundError:
        create_kwargs = {
            "uid": uid,
            "email": token,
            "display_name": display_name or None,
            "email_verified": email_verified,
        }
        return auth.create_user(app=_firebase_app, **create_kwargs)


def create_firebase_custom_token(uid: str, additional_claims: dict | None = None) -> str:
    if not _firebase_app:
        init_firebase()

    if not _firebase_app:
        logger.error("Firebase is not initialized. Cannot mint a custom token.")
        raise ValueError("Firebase is not initialized.")

    raw_token = auth.create_custom_token(uid, additional_claims or {}, app=_firebase_app)
    if isinstance(raw_token, bytes):
        return raw_token.decode("utf-8")
    return str(raw_token)
