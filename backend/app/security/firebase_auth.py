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
    if not _firebase_app:
        try:
            if settings.FIREBASE_CREDENTIALS_FILE:
                import os
                if os.path.exists(settings.FIREBASE_CREDENTIALS_FILE):
                    cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_FILE)
                    _firebase_app = firebase_admin.initialize_app(cred)
                    logger.info("Firebase Admin initialized successfully.")
                else:
                    logger.warning(f"Firebase credentials file not found at {settings.FIREBASE_CREDENTIALS_FILE}")
            else:
                logger.warning("FIREBASE_CREDENTIALS_FILE not set. Firebase Auth will not work.")
        except Exception as e:
            logger.error(f"Failed to initialize Firebase Admin: {e}")

def verify_firebase_token(id_token: str) -> dict:

    if not _firebase_app:
        init_firebase()
    
    if not _firebase_app:
        logger.error("Firebase is not initialized. Cannot verify token.")
        raise ValueError("Firebase is not initialized.")
        
    try:
        return auth.verify_id_token(id_token)
    except Exception as e:
        logger.error(f"Firebase token verification failed: {e}")
        raise ValueError("Invalid Firebase ID token.")
