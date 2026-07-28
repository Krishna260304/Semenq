
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
from app.providers.notifications.providers import SMTPEmailProvider
from app.security.firebase_auth import create_firebase_custom_token, get_or_create_firebase_user
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
        self._email = SMTPEmailProvider()


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

        firebase_custom_token = None
        try:
            firebase_user = get_or_create_firebase_user(
                uid=user.id,
                email=user.email,
                display_name=user.full_name,
                email_verified=user.email_verified,
            )
            firebase_custom_token = create_firebase_custom_token(
                firebase_user.uid,
                {
                    "semenq_user_id": user.id,
                    "semenq_role": user.role.value,
                    "semenq_email": user.email,
                },
            )
        except Exception as exc:
            logger.warning("Unable to mint Firebase custom token for password login", user_id=user.id, error=str(exc))

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
            "firebase_custom_token": firebase_custom_token,
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

    async def request_support_otp(
        self,
        email: str,
        purpose: str = "login",
        role: str | None = None,
        ip_address: str = "",
    ) -> str:
        email = email.lower().strip()
        user = await self._users.get_by_email(email)
        if user is None:
            raise UserNotFoundException("No account found with that email.")

        if role and getattr(user.role, "value", str(user.role)) != role:
            raise AuthenticationException(f"This account is registered as {user.role.value}.")

        if purpose == "login":
            token_type = TokenType.LOGIN_OTP
            subject = "Semenq 6-digit login verification code"
            purpose_label = "login"
            recipient_email = user.email
        elif purpose == "two_factor":
            token_type = TokenType.TWO_FACTOR_OTP
            subject = "Semenq 6-digit two-factor verification code"
            purpose_label = "two-factor authentication"
            recipient_email = user.email
        elif purpose == "email_2fa":
            token_type = TokenType.TWO_FACTOR_OTP
            subject = "Semenq 6-digit email verification code"
            purpose_label = "email two-factor authentication"
            recipient_email = user.email
        else:
            raise AuthenticationException("Unsupported OTP purpose.")

        raw_token, token_hash, expiry = self._generate_support_otp_token()
        verification = VerificationToken(
            user_id=user.id,
            token_hash=token_hash,
            token_type=token_type,
            expires_at=expiry,
            ip_address=ip_address,
        )
        await verification.insert()

        body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; color: #111827;">
                <h2>{subject}</h2>
                <p>An OTP was requested for <strong>{user.full_name}</strong> ({user.email}).</p>
                <p>Purpose: <strong>{purpose_label}</strong></p>
                <p>6-digit code: <strong style="font-size: 1.4rem; letter-spacing: 0.2em;">{raw_token}</strong></p>
                <p>This code expires in 10 minutes.</p>
            </body>
        </html>
        """

        sent = await self._email.send(
            to=recipient_email,
            subject=subject,
            html_body=body,
        )
        if not sent:
            verification.used = True
            verification.used_at = _utcnow()
            await verification.save()
            raise AuthenticationException("Could not send the OTP email.")

        await self._audit.log(
            action="user.support_otp_requested",
            module="auth",
            user_id=user.id,
            role=getattr(user.role, "value", str(user.role)),
            ip_address=ip_address,
            result="success",
            metadata={"purpose": purpose, "recipient_email": recipient_email},
        )
        return recipient_email

    async def verify_support_otp(
        self,
        email: str,
        raw_token: str,
        purpose: str = "login",
        role: str | None = None,
        ip_address: str = "",
    ) -> User:
        email = email.lower().strip()
        user = await self._users.get_by_email(email)
        if user is None:
            raise UserNotFoundException("No account found with that email.")

        if role and getattr(user.role, "value", str(user.role)) != role:
            raise AuthenticationException(f"This account is registered as {user.role.value}.")

        if purpose == "login":
            token_type = TokenType.LOGIN_OTP
        elif purpose in {"two_factor", "email_2fa"}:
            token_type = TokenType.TWO_FACTOR_OTP
        else:
            raise AuthenticationException("Unsupported OTP purpose.")

        token_record = await self._verification_tokens.get_valid_token(raw_token, token_type)
        if token_record is None or token_record.user_id != user.id:
            raise InvalidTokenException("OTP is invalid or expired.")

        await self._verification_tokens.mark_used(token_record.id)
        await self._audit.log(
            action="user.support_otp_verified",
            module="auth",
            user_id=user.id,
            role=getattr(user.role, "value", str(user.role)),
            ip_address=ip_address,
            result="success",
            metadata={"purpose": purpose},
        )
        return user


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

    async def get_active_sessions(self, user_id: str) -> list[Session]:
        """Return the user's active sessions without exposing refresh tokens."""
        return await self._sessions.get_active_sessions(user_id)

    async def revoke_session(self, session_id: str, user_id: str) -> bool:
        """Revoke one of the current user's sessions."""
        session = await Session.find_one(
            Session.id == session_id,
            Session.user_id == user_id,
            Session.status == SessionStatus.ACTIVE,
        )
        if not session:
            return False

        if session.refresh_token_id:
            await self._refresh_tokens.revoke_token(session.refresh_token_id, "session_revoked")
        session.status = SessionStatus.REVOKED
        session.logout_at = _utcnow()
        await session.save()
        await self._audit.log(
            action="user.session_revoked",
            module="auth",
            user_id=user_id,
            entity_id=session.id,
            entity_type="session",
        )
        return True

    async def delete_account(self, user_id: str) -> None:
        """Disable an account while retaining required order/audit records."""
        user = await self._users.get_by_id_or_raise(user_id)
        await self._refresh_tokens.revoke_all_for_user(user_id, "account_deleted")
        await self._sessions.revoke_all_for_user(user_id)
        user.status = UserStatus.INACTIVE
        await user.soft_delete(deleted_by=user_id)
        await self._audit.log(action="user.account_deleted", module="auth", user_id=user_id)


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

    async def verify_password_reset_token(self, raw_token: str) -> None:
        token_record = await self._password_reset_tokens.get_valid_token(raw_token)
        if token_record is None:
            raise InvalidTokenException("Password reset token is invalid or expired.")

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

    @staticmethod
    def _generate_support_otp_token() -> tuple[str, str, datetime]:
        raw, token_hash = create_verification_token()
        expiry = _utcnow() + timedelta(minutes=10)
        return raw, token_hash, expiry

    async def get_current_user(self, user_id: str) -> User:
        return await self._users.get_by_id_or_raise(user_id)

    async def get_user_permissions(self, user_id: str) -> list[str]:
        from app.repositories.user_repository import RoleRepository
        user = await self._users.get_by_id_or_raise(user_id)
        role_repo = RoleRepository()
        role = await role_repo.get_by_name(user.role.value)
        return role.permissions if role else []
