
from __future__ import annotations

import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

_PHONE_RE = re.compile(r"^\+?[1-9]\d{7,14}$")


def _validate_phone(v: str) -> str:
    v = v.strip()
    if not _PHONE_RE.match(v):
        raise ValueError("Invalid phone number format.")
    return v



class PatientRegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(min_length=7, max_length=20)
    password: str = Field(min_length=8, max_length=128)
    date_of_birth: Optional[datetime] = None
    gender: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        return _validate_phone(v)

    @field_validator("full_name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        return " ".join(v.split())


class PharmacyRegisterRequest(BaseModel):
    pharmacy_name: str = Field(min_length=2, max_length=200)
    owner_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(min_length=7, max_length=20)
    password: str = Field(min_length=8, max_length=128)
    license_number: str = Field(min_length=5, max_length=50)
    gst_number: Optional[str] = Field(default=None, max_length=20)
    street: str = Field(min_length=5, max_length=300)
    city: str = Field(min_length=2, max_length=100)
    state: str = Field(min_length=2, max_length=100)
    pincode: str = Field(min_length=6, max_length=10)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        return _validate_phone(v)


class LoginRequest(BaseModel):
    identifier: str = Field(description="Email or phone number")
    password: str
    device_name: str = ""
    device_os: str = ""
    device_fingerprint: str = ""

    @field_validator("identifier")
    @classmethod
    def clean_identifier(cls, v: str) -> str:
        return v.strip()


class FirebaseLoginRequest(BaseModel):
    id_token: str = Field(description="Firebase ID token from the frontend")
    device_name: str = ""
    device_os: str = ""
    device_fingerprint: str = ""


class FirebaseRegisterRequest(BaseModel):
    id_token: str = Field(description="Firebase ID token from the frontend")
    full_name: str = Field(default="", description="User's full name")
    email: str = Field(default="", description="User's email address")
    phone: str = Field(default="", description="User's phone number with country code")
    role: str = Field(default="patient", description="patient or pharmacy")
    address: Optional[str] = None
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    license_number: Optional[str] = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class SendVerificationRequest(BaseModel):
    email: EmailStr


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=10)


class RequestPasswordResetRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)
    confirm_password: str

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        if "new_password" in info.data and v != info.data["new_password"]:
            raise ValueError("Passwords do not match.")
        return v


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)
    confirm_password: str

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        if "new_password" in info.data and v != info.data["new_password"]:
            raise ValueError("Passwords do not match.")
        return v



class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user_id: str
    role: str
    email: str
    full_name: str


class UserSummaryResponse(BaseModel):
    id: str
    full_name: str
    email: str
    phone: str
    role: str
    status: str
    email_verified: bool
    profile_photo_url: Optional[str]
    last_login_at: Optional[datetime]
    created_at: datetime


class MeResponse(BaseModel):
    user: UserSummaryResponse
    permissions: list[str]


class RegisterResponse(BaseModel):
    message: str = "Registration successful. Please verify your email."
    user_id: str
    requires_verification: bool = True
