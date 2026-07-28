
from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.core.config import get_settings
from app.core.exceptions import (
    AccountLockedException,
    AuthenticationException,
    DuplicateUserException,
    EmailNotVerifiedException,
    InvalidCredentialsException,
    InvalidTokenException,
    UserNotFoundException,
)
from app.core.logging.logger import get_logger
from app.models.user import (
    Admin,
    AuditLog,
    Patient,
    PasswordResetToken,
    Pharmacy,
    PharmacyVerificationStatus,
    RefreshToken,
    Session,
    SessionStatus,
    TokenType,
    User,
    UserPreferences,
    UserRole,
    UserStatus,
    VerificationToken,
)
from app.repositories.user_repository import (
    AdminRepository,
    AuditLogRepository,
    PasswordResetTokenRepository,
    PatientRepository,
    PharmacyRepository,
    RefreshTokenRepository,
    SessionRepository,
    UserPreferencesRepository,
    UserRepository,
    VerificationTokenRepository,
)
from app.security.jwt_handler import (
    create_access_token,
    create_refresh_token,
    create_verification_token,
    decode_access_token,
    hash_token,
)
from app.security.password_handler import hash_password, needs_rehash, verify_password

logger = get_logger(__name__)
settings = get_settings()

_MAX_FAILED_ATTEMPTS = 5
_LOCKOUT_MINUTES = 30


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 10:
        return f"+91{digits}"
    if len(digits) == 12 and digits.startswith("91"):
        return f"+{digits}"
    return phone


class AuthService:
    def __init__(self) -> None:
        self._users = UserRepository()
        self._patients = PatientRepository()
        self._pharmacies = PharmacyRepository()
        self._admins = AdminRepository()
        self._sessions = SessionRepository()
        self._refresh_tokens = RefreshTokenRepository()
        self._verification_tokens = VerificationTokenRepository()
        self._password_reset_tokens = PasswordResetTokenRepository()
        self._prefs = UserPreferencesRepository()
        self._audit = AuditLogRepository()


    async def register_patient(
        self,
        full_name: str,
        email: str,
        phone: str,
        password: str,
        date_of_birth: Optional[datetime] = None,
        gender: Optional[str] = None,
        ip_address: str = "",
    ) -> tuple[User, Patient, str]:
        email = email.lower().strip()
        phone = _normalize_phone(phone)

        if await self._users.email_exists(email):
            raise DuplicateUserException("An account with this email already exists.")
        if await self._users.phone_exists(phone):
            raise DuplicateUserException("An account with this phone number already exists.")

        password_hash = hash_password(password)

        user = User(
            full_name=full_name.strip(),
            email=email,
            phone=phone,
            password_hash=password_hash,
            role=UserRole.PATIENT,
            status=UserStatus.PENDING_VERIFICATION,
            created_by="self",
        )
        await user.insert()

        patient = Patient(
            user_id=user.id,
            gender=gender,
            date_of_birth=date_of_birth,
            created_by=user.id,
        )
        await patient.insert()

        prefs = UserPreferences(user_id=user.id)
        await prefs.insert()
        user.preferences_id = prefs.id
        await user.save()

        raw_token, token_hash, expiry = self._generate_email_verification_token()
        verification = VerificationToken(
            user_id=user.id,
            token_hash=token_hash,
            token_type=TokenType.EMAIL_VERIFICATION,
            expires_at=expiry,
            ip_address=ip_address,
        )
        await verification.insert()

        await self._audit.log(
            action="user.register",
            module="auth",
            user_id=user.id,
            role=user.role.value,
            ip_address=ip_address,
            result="success",
        )

        logger.info("Patient registered", user_id=user.id, email=email)
        return user, patient, raw_token

    async def register_pharmacy(
        self,
        pharmacy_name: str,
        owner_name: str,
        email: str,
        phone: str,
        license_number: str,
        gst_number: Optional[str],
        street: str,
        city: str,
        state: str,
        pincode: str,
        password: str,
        ip_address: str = "",
    ) -> tuple[User, Pharmacy, str]:
        email = email.lower().strip()
        phone = _normalize_phone(phone)

        if await self._users.email_exists(email):
            raise DuplicateUserException("An account with this email already exists.")
        if await self._users.phone_exists(phone):
            raise DuplicateUserException("An account with this phone already exists.")
        if await self._pharmacies.get_by_license(license_number):
            raise DuplicateUserException("A pharmacy with this license number is already registered.")

        password_hash = hash_password(password)

        user = User(
            full_name=owner_name.strip(),
            email=email,
            phone=phone,
            password_hash=password_hash,
            role=UserRole.PHARMACY,
            status=UserStatus.PENDING_VERIFICATION,
        )
        await user.insert()

        pharmacy = Pharmacy(
            user_id=user.id,
            pharmacy_name=pharmacy_name.strip(),
            owner_name=owner_name.strip(),
            license_number=license_number.strip().upper(),
            gst_number=gst_number,
            street=street,
            city=city,
            state=state,
            pincode=pincode,
            verification_status=PharmacyVerificationStatus.PENDING,
        )
        await pharmacy.insert()

        prefs = UserPreferences(user_id=user.id)
        await prefs.insert()

        raw_token, token_hash, expiry = self._generate_email_verification_token()
        verification = VerificationToken(
            user_id=user.id,
            token_hash=token_hash,
            token_type=TokenType.EMAIL_VERIFICATION,
            expires_at=expiry,
            ip_address=ip_address,
        )
        await verification.insert()

        await self._audit.log(
            action="pharmacy.register",
            module="auth",
            user_id=user.id,
            role=user.role.value,
            ip_address=ip_address,
            result="success",
        )

        logger.info("Pharmacy registered", user_id=user.id, pharmacy_name=pharmacy_name)
        return user, pharmacy, raw_token


    async def login(
        self,
        identifier: str,
        password: str,
        ip_address: str = "",
        device_name: str = "",
        device_os: str = "",
        device_fingerprint: str = "",
    ) -> dict:
        identifier = identifier.lower().strip()
        user = await self._users.get_by_email_or_phone(identifier)

        if user is None:
            logger.warning("Login: user not found", identifier=identifier, ip=ip_address)
            raise InvalidCredentialsException()

        if user.account_locked:
            if user.account_locked_until and _utcnow() < user.account_locked_until:
                raise AccountLockedException(
                    f"Account locked until {user.account_locked_until.isoformat()}."
                )
            await self._users.reset_failed_attempts(user.id)

        if not verify_password(password, user.password_hash):
            await self._users.increment_failed_attempts(user.id)
            attempts = user.failed_login_attempts + 1
            if attempts >= _MAX_FAILED_ATTEMPTS:
                lock_until = _utcnow() + timedelta(minutes=_LOCKOUT_MINUTES)
                await self._users.lock_account(user.id, lock_until)
                await self._audit.log(
                    action="user.account_locked",
                    module="auth",
                    user_id=user.id,
                    ip_address=ip_address,
                    result="failure",
                    reason="max_failed_attempts",
                )
            raise InvalidCredentialsException()

        if not user.email_verified:
            raise EmailNotVerifiedException()

        if user.status == UserStatus.SUSPENDED:
            raise AuthenticationException("Your account has been suspended. Contact support.")
        if user.status == UserStatus.BANNED:
            raise AuthenticationException("Your account has been banned.")

        await self._users.reset_failed_attempts(user.id)
        await self._users.update_last_login(user.id, ip_address)

        if needs_rehash(user.password_hash):
            new_hash = hash_password(password)
            await self._users.update_password_hash(user.id, new_hash)

        session = Session(
            user_id=user.id,
            ip_address=ip_address,
            device_name=device_name,
            device_os=device_os,
            device_fingerprint=device_fingerprint,
            status=SessionStatus.ACTIVE,
        )
        await session.insert()

        access_token, access_expiry = create_access_token(
            user_id=user.id,
            role=user.role.value,
            session_id=session.id,
        )
        raw_refresh, refresh_hash, refresh_expiry = create_refresh_token()

        refresh_record = RefreshToken(
            user_id=user.id,
            token_hash=refresh_hash,
            session_id=session.id,
            ip_address=ip_address,
            expires_at=refresh_expiry,
        )
        await refresh_record.insert()

        session.refresh_token_id = refresh_record.id
        await session.save()

        await self._audit.log(
            action="user.login",
            module="auth",
            user_id=user.id,
            role=user.role.value,
            ip_address=ip_address,
            result="success",
        )

        return {
            "access_token": access_token,
            "refresh_token": raw_refresh,
            "token_type": "bearer",
            "expires_in": settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "user_id": user.id,
            "role": user.role.value,
            "email": user.email,
            "full_name": user.full_name,
        }

    async def login_with_firebase(
        self,
        id_token: str,
        ip_address: str = "",
        device_name: str = "",
        device_os: str = "",
        device_fingerprint: str = "",
    ) -> dict:
        from app.security.firebase_auth import verify_firebase_token
        
        try:
            payload = verify_firebase_token(id_token)
        except ValueError as e:
            raise AuthenticationException(str(e))
            
        phone = payload.get("phone_number")
        if not phone:
            raise AuthenticationException("Firebase token does not contain a phone number.")
            
        phone = _normalize_phone(phone)
        user = await self._users.get_by_email_or_phone(phone)
        
        if not user:
            logger.info("New phone number detected from Firebase. Auto-creating Patient account.", phone=phone)
            
            import secrets
            dummy_password = secrets.token_urlsafe(32) + "!Aa1"
            
            user, _, _ = await self.register_patient(
                full_name="User",
                email=f"{phone.replace('+', '')}@semenq.placeholder.com",
                phone=phone,
                password=dummy_password,
                ip_address=ip_address,
            )
            user.status = UserStatus.ACTIVE
            user.email_verified = False
            await user.save()

        if user.account_locked:
            if user.account_locked_until and _utcnow() < user.account_locked_until:
                raise AccountLockedException(
                    f"Account locked until {user.account_locked_until.isoformat()}."
                )
            await self._users.reset_failed_attempts(user.id)

        if user.status == UserStatus.SUSPENDED:
            raise AuthenticationException("Your account has been suspended. Contact support.")
        if user.status == UserStatus.BANNED:
            raise AuthenticationException("Your account has been banned.")

        await self._users.update_last_login(user.id, ip_address)

        session = Session(
            user_id=user.id,
            ip_address=ip_address,
            device_name=device_name,
            device_os=device_os,
            device_fingerprint=device_fingerprint,
            status=SessionStatus.ACTIVE,
        )
        await session.insert()

        access_token, access_expiry = create_access_token(
            user_id=user.id,
            role=user.role.value,
            session_id=session.id,
        )
        raw_refresh, refresh_hash, refresh_expiry = create_refresh_token()

        refresh_record = RefreshToken(
            user_id=user.id,
            token_hash=refresh_hash,
            session_id=session.id,
            ip_address=ip_address,
            expires_at=refresh_expiry,
        )
        await refresh_record.insert()

        session.refresh_token_id = refresh_record.id
        await session.save()

        await self._audit.log(
            action="user.login_firebase",
            module="auth",
            user_id=user.id,
            role=user.role.value,
            ip_address=ip_address,
            result="success",
        )

        return {
            "access_token": access_token,
            "refresh_token": raw_refresh,
            "token_type": "bearer",
            "expires_in": settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "user_id": user.id,
            "role": user.role.value,
            "email": user.email,
            "full_name": user.full_name,
        }


    async def refresh_access_token(
        self,
        raw_refresh_token: str,
        ip_address: str = "",
    ) -> dict:
        token_record = await self._refresh_tokens.get_by_token(raw_refresh_token)
        if token_record is None:
            raise InvalidTokenException("Refresh token not found or already revoked.")

        if token_record.expires_at < _utcnow():
            raise InvalidTokenException("Refresh token has expired.")

        user = await self._users.get_by_id_or_raise(token_record.user_id)

        await self._refresh_tokens.revoke_token(token_record.id, "rotated")

        new_access, access_expiry = create_access_token(
            user_id=user.id,
            role=user.role.value,
            session_id=token_record.session_id or "",
        )
        raw_new_refresh, new_refresh_hash, new_refresh_expiry = create_refresh_token()

        new_refresh_record = RefreshToken(
            user_id=user.id,
            token_hash=new_refresh_hash,
            session_id=token_record.session_id,
            ip_address=ip_address,
            expires_at=new_refresh_expiry,
        )
        await new_refresh_record.insert()

        await RefreshToken.find_one(RefreshToken.id == token_record.id).update(
            {"$set": {"replaced_by": new_refresh_record.id}}
        )

        return {
            "access_token": new_access,
            "refresh_token": raw_new_refresh,
            "token_type": "bearer",
            "expires_in": settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }


    async def logout(self, raw_refresh_token: str, user_id: str) -> None:
        token_record = await self._refresh_tokens.get_by_token(raw_refresh_token)
        if token_record and token_record.user_id == user_id:
            await self._refresh_tokens.revoke_token(token_record.id, "logout")
            if token_record.session_id:
                await Session.find_one(Session.id == token_record.session_id).update(
                    {"$set": {"status": "revoked", "logout_at": _utcnow()}}
                )
        await self._audit.log(action="user.logout", module="auth", user_id=user_id)

    async def logout_all_devices(self, user_id: str) -> None:
        await self._refresh_tokens.revoke_all_for_user(user_id, "logout_all")
        await self._sessions.revoke_all_for_user(user_id)
        await self._audit.log(action="user.logout_all", module="auth", user_id=user_id)


    async def verify_email(self, raw_token: str, ip_address: str = "") -> User:
        token_record = await self._verification_tokens.get_valid_token(
            raw_token, TokenType.EMAIL_VERIFICATION
        )
        if token_record is None:
            raise InvalidTokenException("Verification token is invalid or expired.")

        await self._verification_tokens.mark_used(token_record.id)
        await self._users.mark_email_verified(token_record.user_id)

        user = await self._users.get_by_id_or_raise(token_record.user_id)
        user.status = UserStatus.ACTIVE
        await user.save()

        await self._audit.log(
            action="user.email_verified",
            module="auth",
            user_id=user.id,
            ip_address=ip_address,
        )

        return user

    async def resend_verification(self, email: str) -> str:
        user = await self._users.get_by_email(email.lower())
        if user is None or user.email_verified:
            return ""

        raw_token, token_hash, expiry = self._generate_email_verification_token()
        verification = VerificationToken(
            user_id=user.id,
            token_hash=token_hash,
            token_type=TokenType.EMAIL_VERIFICATION,
            expires_at=expiry,
        )
        await verification.insert()
        return raw_token


    async def request_password_reset(self, email: str) -> Optional[str]:
        user = await self._users.get_by_email(email.lower())
        if not user:
            return None

        raw_token, token_hash = create_verification_token()
        expiry = _utcnow() + timedelta(hours=1)

        reset_record = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expiry,
        )
        await reset_record.insert()

        await self._audit.log(
            action="user.password_reset_requested",
            module="auth",
            user_id=user.id,
        )
        return raw_token

    async def reset_password(
        self,
        raw_token: str,
        new_password: str,
        ip_address: str = "",
    ) -> None:
        token_record = await self._password_reset_tokens.get_valid_token(raw_token)
        if token_record is None:
            raise InvalidTokenException("Password reset token is invalid or expired.")

        new_hash = hash_password(new_password)
        await self._users.update_password_hash(token_record.user_id, new_hash)
        await self._password_reset_tokens.mark_used(token_record.id)

        await self._refresh_tokens.revoke_all_for_user(token_record.user_id, "password_reset")
        await self._sessions.revoke_all_for_user(token_record.user_id)

        await self._audit.log(
            action="user.password_reset",
            module="auth",
            user_id=token_record.user_id,
            ip_address=ip_address,
        )


    @staticmethod
    def _generate_email_verification_token() -> tuple[str, str, datetime]:
        raw, token_hash = create_verification_token()
        expiry = _utcnow() + timedelta(hours=24)
        return raw, token_hash, expiry

    async def get_current_user(self, user_id: str) -> User:
        return await self._users.get_by_id_or_raise(user_id)

    async def get_user_permissions(self, user_id: str) -> list[str]:
        from app.repositories.user_repository import RoleRepository
        user = await self._users.get_by_id_or_raise(user_id)
        role_repo = RoleRepository()
        role = await role_repo.get_by_name(user.role.value)
        return role.permissions if role else []
