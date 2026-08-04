
from __future__ import annotations

from enum import Enum
from functools import lru_cache
from typing import Literal

from pydantic import AnyHttpUrl, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(str, Enum):
    DEVELOPMENT = "development"
    TESTING = "testing"
    PRODUCTION = "production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    APP_NAME: str = "Semenq"
    APP_VERSION: str = "1.0.0"
    APP_ENV: Environment = Environment.DEVELOPMENT
    DEBUG: bool = True
    SECRET_KEY: str = "change-me-to-a-long-random-256-bit-secret-key"
    ALLOWED_HOSTS: list[str] = ["localhost", "127.0.0.1"]

    HOST: str = "0.0.0.0"
    PORT: int = 8000
    # Public API origin for links returned by local storage. Leave empty when a
    # reverse proxy serves frontend and backend under one origin.
    PUBLIC_BASE_URL: str = ""
    WORKERS: int = 4
    RELOAD: bool = False

    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "semenq"
    MONGODB_MAX_CONNECTIONS: int = 100
    MONGODB_MIN_CONNECTIONS: int = 10

    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_MAX_CONNECTIONS: int = 50
    REDIS_CACHE_TTL: int = 3600

    JWT_SECRET_KEY: str = "change-me-to-a-separate-jwt-256-bit-secret"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]
    CORS_ALLOW_CREDENTIALS: bool = True

    RATE_LIMIT_PER_MINUTE: int = 60
    AUTH_RATE_LIMIT_PER_MINUTE: int = 10

    CLOUDINARY_CLOUD_NAME: str = "your-cloud-name"
    CLOUDINARY_API_KEY: str = "your-api-key"
    CLOUDINARY_API_SECRET: str = "your-api-secret"
    CLOUDINARY_FOLDER_PRESCRIPTIONS: str = "semenq/prescriptions"
    CLOUDINARY_FOLDER_MEDICINES: str = "semenq/medicines"
    CLOUDINARY_FOLDER_PROFILES: str = "semenq/profiles"

    OCR_PROVIDER: Literal["paddleocr"] = "paddleocr"
    ML_DEVICE: Literal["cuda", "cpu", "auto"] = "auto"
    OCR_FAST_PATH_ENABLED: bool = False
    OCR_FAST_CONFIDENCE_THRESHOLD: float = 0.55
    GOOGLE_VISION_CREDENTIALS_FILE: str = "/path/to/service-account.json"
    AZURE_OCR_ENDPOINT: str = "https://your-endpoint.cognitiveservices.azure.com/"
    AZURE_OCR_KEY: str = "your-azure-key"

    AI_PROVIDER: Literal["openai", "gemini", "claude", "qwen"] = "qwen"
    QWEN_BASE_URL: str = "http://localhost:11434/v1"
    QWEN_MODEL: str = "qwen3:8b"
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-1.5-pro"
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-3-5-sonnet-20241022"

    RAZORPAY_KEY_ID: str = "your-razorpay-key-id"
    RAZORPAY_KEY_SECRET: str = "your-razorpay-key-secret"
    RAZORPAY_WEBHOOK_SECRET: str = "your-razorpay-webhook-secret"
    CURRENCY: str = "INR"

    SHIPROCKET_EMAIL: str = "your-shiprocket-email"
    SHIPROCKET_PASSWORD: str = "your-shiprocket-password"
    SHIPROCKET_BASE_URL: str = "https://apiv2.shiprocket.in/v1/external"

    MAIL_USERNAME: str = "support.semenq@gmail.com"
    MAIL_PASSWORD: str = ""
    MAIL_FROM: str = "support.semenq@gmail.com"
    MAIL_PORT: int = 587
    MAIL_SERVER: str = "smtp.gmail.com"
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False
    MAIL_FROM_NAME: str = "Semenq"

    TWILIO_ACCOUNT_SID: str = "your-twilio-sid"
    TWILIO_AUTH_TOKEN: str = "your-twilio-auth-token"
    TWILIO_PHONE_NUMBER: str = "+1234567890"

    FIREBASE_CREDENTIALS_FILE: str = "/path/to/firebase-service-account.json"

    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    MAX_UPLOAD_SIZE_MB: int = 10
    ALLOWED_IMAGE_TYPES: list[str] = [
        "image/jpeg",
        "image/png",
        "image/jpg",
    ]

    RESERVATION_EXPIRY_HOURS: int = 2
    RESERVATION_FEE_PERCENT: float = 2.0
    PLATFORM_FEE_PERCENT: float = 1.5

    DEFAULT_SEARCH_RADIUS_KM: float = 5.0
    SEARCH_CACHE_TTL: int = 300

    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/semenq.log"
    LOG_MAX_BYTES: int = 10_485_760
    LOG_BACKUP_COUNT: int = 5

    SUPER_ADMIN_EMAIL: str = "support.semenq@gmail.com"
    SUPER_ADMIN_PASSWORD: str = "change-this-immediately"

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == Environment.PRODUCTION

    @property
    def is_development(self) -> bool:
        return self.APP_ENV == Environment.DEVELOPMENT

    @property
    def is_testing(self) -> bool:
        return self.APP_ENV == Environment.TESTING

    @property
    def max_upload_size_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    @field_validator("ALLOWED_HOSTS", "CORS_ORIGINS", "ALLOWED_IMAGE_TYPES", mode="before")
    @classmethod
    def parse_comma_separated(cls, v: str | list) -> list[str]:
        if isinstance(v, str):
            return [item.strip() for item in v.split(",") if item.strip()]
        return v

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug_flag(cls, v: bool | str) -> bool:
        if isinstance(v, str):
            normalized = v.strip().lower()
            if normalized in {"release", "prod", "production", "false", "0", "no", "off"}:
                return False
            if normalized in {"debug", "dev", "development", "true", "1", "yes", "on"}:
                return True
        return v

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        if self.APP_ENV == Environment.PRODUCTION:
            if self.DEBUG:
                raise ValueError("DEBUG must be False in production")
            secret_values = {
                "SECRET_KEY": self.SECRET_KEY,
                "JWT_SECRET_KEY": self.JWT_SECRET_KEY,
            }
            for name, value in secret_values.items():
                if len(value) < 64 or value.startswith("change-me"):
                    raise ValueError(f"{name} must be a unique random value of at least 64 characters in production")
            if any(host in {"localhost", "127.0.0.1", "*"} for host in self.ALLOWED_HOSTS):
                raise ValueError("ALLOWED_HOSTS must contain only production hostnames")
            if any(origin.startswith("http://localhost") or origin.startswith("http://127.0.0.1") for origin in self.CORS_ORIGINS):
                raise ValueError("CORS_ORIGINS must contain only production origins")
            if not self.MAIL_PASSWORD:
                raise ValueError("MAIL_PASSWORD must be configured in production")
            if self.SUPER_ADMIN_PASSWORD == "change-this-immediately":
                raise ValueError("SUPER_ADMIN_PASSWORD must be changed in production")
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
