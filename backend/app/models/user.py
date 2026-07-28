
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from beanie import Indexed
from pydantic import EmailStr, Field

from app.models.base import BaseDocument, _utcnow



class UserRole(str, Enum):
    PATIENT = "patient"
    PHARMACY = "pharmacy"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"


class UserStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    PENDING_VERIFICATION = "pending_verification"
    BANNED = "banned"


class AddressType(str, Enum):
    HOME = "home"
    OFFICE = "office"
    OTHER = "other"


class Gender(str, Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"
    PREFER_NOT_TO_SAY = "prefer_not_to_say"


class BloodGroup(str, Enum):
    A_POS = "A+"
    A_NEG = "A-"
    B_POS = "B+"
    B_NEG = "B-"
    AB_POS = "AB+"
    AB_NEG = "AB-"
    O_POS = "O+"
    O_NEG = "O-"


class PharmacyVerificationStatus(str, Enum):
    PENDING = "pending"
    UNDER_REVIEW = "under_review"
    VERIFIED = "verified"
    REJECTED = "rejected"
    SUSPENDED = "suspended"


class SessionStatus(str, Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    REVOKED = "revoked"


class DeviceOS(str, Enum):
    ANDROID = "android"
    IOS = "ios"
    WEB = "web"
    UNKNOWN = "unknown"



class Permission(BaseDocument):

    name: Indexed(str, unique=True)  # e.g. "medicine.read"
    display_name: str
    description: str
    module: str   # e.g. "medicine", "inventory", "admin"
    action: str   # e.g. "read", "write", "delete"
    is_active: bool = True

    class Settings:
        name = "permissions"
        indexes = [
            [("name", 1)],
            [("module", 1), ("action", 1)],
        ]


class Role(BaseDocument):

    name: Indexed(str, unique=True)  # e.g. "patient", "pharmacy", "admin"
    display_name: str
    description: str
    permissions: list[str] = Field(default_factory=list)  # Permission IDs
    is_system_role: bool = False
    is_active: bool = True

    class Settings:
        name = "roles"
        indexes = [[("name", 1)]]



class Address(BaseDocument):

    user_id: str
    address_name: str = ""          # e.g. "Home", "Office"
    street: str
    area: str = ""
    city: str
    district: str = ""
    state: str
    country: str = "India"
    pincode: str
    landmark: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address_type: AddressType = AddressType.HOME
    is_default: bool = False

    class Settings:
        name = "addresses"
        indexes = [
            [("user_id", 1)],
            [("pincode", 1)],
            [("city", 1)],
        ]



class NotificationPreferences(BaseDocument):
    email_enabled: bool = True
    sms_enabled: bool = True
    push_enabled: bool = True
    reservation_updates: bool = True
    payment_updates: bool = True
    delivery_updates: bool = True
    promotions: bool = False
    health_tips: bool = True

    class Settings:
        name = "notification_preferences"


class AccessibilitySettings(BaseDocument):
    reduced_motion: bool = False
    large_text: bool = False
    high_contrast: bool = False

    class Settings:
        name = "accessibility_settings"


class UserPreferences(BaseDocument):

    user_id: Indexed(str, unique=True)
    dark_mode: bool = False
    language: str = "en"
    timezone: str = "Asia/Kolkata"
    notification_email: bool = True
    notification_sms: bool = True
    notification_push: bool = True
    reservation_updates: bool = True
    payment_updates: bool = True
    delivery_updates: bool = True
    promotions: bool = False
    reduced_motion: bool = False
    large_text: bool = False
    high_contrast: bool = False
    default_address_id: Optional[str] = None

    class Settings:
        name = "user_preferences"
        indexes = [[("user_id", 1)]]



class Device(BaseDocument):

    user_id: str
    device_name: str = ""
    device_os: DeviceOS = DeviceOS.UNKNOWN
    device_token: Optional[str] = None   # FCM / APNs token
    device_fingerprint: str = ""
    app_version: str = ""
    is_trusted: bool = False
    last_active_at: datetime = Field(default_factory=_utcnow)

    class Settings:
        name = "devices"
        indexes = [
            [("user_id", 1)],
            [("device_fingerprint", 1)],
        ]



class User(BaseDocument):

    full_name: str
    email: Indexed(EmailStr, unique=True)
    phone: Indexed(str, unique=True)
    password_hash: str
    role: UserRole
    status: UserStatus = UserStatus.PENDING_VERIFICATION

    profile_photo_url: Optional[str] = None
    profile_photo_id: Optional[str] = None   # Cloudinary public_id

    email_verified: bool = False
    email_verified_at: Optional[datetime] = None
    phone_verified: bool = False
    phone_verified_at: Optional[datetime] = None

    last_login_at: Optional[datetime] = None
    current_login_at: Optional[datetime] = None
    last_login_ip: Optional[str] = None

    failed_login_attempts: int = 0
    account_locked: bool = False
    account_locked_until: Optional[datetime] = None

    two_factor_enabled: bool = False
    two_factor_secret: Optional[str] = None

    timezone: str = "Asia/Kolkata"
    language: str = "en"
    preferences_id: Optional[str] = None

    class Settings:
        name = "users"
        indexes = [
            [("email", 1)],
            [("phone", 1)],
            [("role", 1)],
            [("status", 1)],
            [("last_login_at", -1)],
            [("role", 1), ("status", 1)],
        ]



class EmergencyContact(BaseDocument):
    name: str
    phone: str
    relation: str

    class Settings:
        name = "emergency_contacts"


class Patient(BaseDocument):

    user_id: Indexed(str, unique=True)
    gender: Optional[Gender] = None
    date_of_birth: Optional[datetime] = None
    blood_group: Optional[BloodGroup] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    medical_notes: Optional[str] = None
    primary_address_id: Optional[str] = None
    favorite_medicine_ids: list[str] = Field(default_factory=list)
    saved_pharmacy_ids: list[str] = Field(default_factory=list)
    reservation_count: int = 0
    order_count: int = 0

    class Settings:
        name = "patients"
        indexes = [
            [("user_id", 1)],
            [("date_of_birth", 1)],
        ]



class WorkingHours(BaseDocument):
    monday_open: Optional[str] = None
    monday_close: Optional[str] = None
    tuesday_open: Optional[str] = None
    tuesday_close: Optional[str] = None
    wednesday_open: Optional[str] = None
    wednesday_close: Optional[str] = None
    thursday_open: Optional[str] = None
    thursday_close: Optional[str] = None
    friday_open: Optional[str] = None
    friday_close: Optional[str] = None
    saturday_open: Optional[str] = None
    saturday_close: Optional[str] = None
    sunday_open: Optional[str] = None
    sunday_close: Optional[str] = None
    is_24_hours: bool = False

    class Settings:
        name = "working_hours"


class Pharmacy(BaseDocument):

    user_id: Indexed(str, unique=True)
    pharmacy_name: str
    owner_name: str
    license_number: Indexed(str, unique=True)
    gst_number: Optional[str] = None

    verification_status: PharmacyVerificationStatus = PharmacyVerificationStatus.PENDING
    verification_date: Optional[datetime] = None
    rejection_reason: Optional[str] = None

    street: str
    area: str = ""
    city: str
    district: str = ""
    state: str
    country: str = "India"
    pincode: str
    landmark: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    google_place_id: Optional[str] = None

    working_hours: Optional[dict] = None
    delivery_radius_km: float = 5.0
    courier_enabled: bool = False
    home_delivery_enabled: bool = False

    inventory_count: int = 0
    reservation_count: int = 0
    completed_order_count: int = 0
    average_rating: float = 0.0
    review_count: int = 0

    phone: Optional[str] = None
    alternate_phone: Optional[str] = None
    store_photo_url: Optional[str] = None

    class Settings:
        name = "pharmacies"
        indexes = [
            [("user_id", 1)],
            [("license_number", 1)],
            [("verification_status", 1)],
            [("city", 1), ("state", 1)],
            [("latitude", 1), ("longitude", 1)],
            [("pincode", 1)],
        ]



class AdminLevel(str, Enum):
    L1 = "L1"   # Support
    L2 = "L2"   # Operations
    L3 = "L3"   # Engineering
    SUPER = "super"


class Admin(BaseDocument):

    user_id: Indexed(str, unique=True)
    admin_level: AdminLevel = AdminLevel.L1
    department: Optional[str] = None
    additional_permissions: list[str] = Field(default_factory=list)
    access_level: int = 1
    managed_by: Optional[str] = None   # Super admin user_id

    class Settings:
        name = "admins"
        indexes = [[("user_id", 1)], [("admin_level", 1)]]



class Session(BaseDocument):

    user_id: str
    refresh_token_id: Optional[str] = None
    device_id: Optional[str] = None
    device_name: str = ""
    device_os: str = ""
    browser: str = ""
    operating_system: str = ""
    ip_address: str = ""
    device_fingerprint: str = ""
    status: SessionStatus = SessionStatus.ACTIVE
    login_at: datetime = Field(default_factory=_utcnow)
    logout_at: Optional[datetime] = None
    last_activity_at: datetime = Field(default_factory=_utcnow)
    expires_at: Optional[datetime] = None

    class Settings:
        name = "sessions"
        indexes = [
            [("user_id", 1)],
            [("status", 1)],
            [("last_activity_at", -1)],
        ]



class RefreshToken(BaseDocument):

    user_id: str
    token_hash: str      # SHA-256 hash of the token — never store raw
    session_id: Optional[str] = None
    device_id: Optional[str] = None
    ip_address: str = ""
    expires_at: datetime
    revoked: bool = False
    revoked_at: Optional[datetime] = None
    revoked_reason: str = ""
    replaced_by: Optional[str] = None   # New token ID after rotation

    class Settings:
        name = "refresh_tokens"
        indexes = [
            [("user_id", 1)],
            [("token_hash", 1)],
            [("expires_at", 1)],
            [("revoked", 1)],
        ]



class TokenType(str, Enum):
    EMAIL_VERIFICATION = "email_verification"
    PHONE_VERIFICATION = "phone_verification"
    PASSWORD_RESET = "password_reset"
    LOGIN_OTP = "login_otp"
    TWO_FACTOR_OTP = "two_factor_otp"


class VerificationToken(BaseDocument):

    user_id: str
    token_hash: str         # SHA-256 hashed — never store raw
    token_type: TokenType
    expires_at: datetime
    used: bool = False
    used_at: Optional[datetime] = None
    ip_address: str = ""

    class Settings:
        name = "verification_tokens"
        indexes = [
            [("user_id", 1), ("token_type", 1)],
            [("token_hash", 1)],
            [("expires_at", 1)],
        ]


class PasswordResetToken(BaseDocument):

    user_id: str
    token_hash: str
    expires_at: datetime
    used: bool = False
    used_at: Optional[datetime] = None
    ip_address: str = ""

    class Settings:
        name = "password_reset_tokens"
        indexes = [
            [("user_id", 1)],
            [("token_hash", 1)],
            [("expires_at", 1)],
        ]



class AuditLog(BaseDocument):

    user_id: Optional[str] = None
    role: Optional[str] = None
    action: str              # e.g. "user.login", "reservation.cancel"
    module: str              # e.g. "auth", "reservation"
    entity_id: Optional[str] = None
    entity_type: Optional[str] = None
    ip_address: str = ""
    device: str = ""
    request_id: str = ""
    result: str = "success"   # success | failure
    reason: Optional[str] = None
    metadata: dict = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=_utcnow)

    class Settings:
        name = "audit_logs"
        indexes = [
            [("user_id", 1), ("timestamp", -1)],
            [("action", 1)],
            [("module", 1)],
            [("timestamp", -1)],
            [("entity_id", 1)],
        ]
