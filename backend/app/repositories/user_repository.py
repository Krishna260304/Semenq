
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from app.models.user import (
    Admin,
    AuditLog,
    Device,
    PasswordResetToken,
    Patient,
    Pharmacy,
    RefreshToken,
    Role,
    Session,
    User,
    UserPreferences,
    VerificationToken,
)
from app.repositories.base import BaseRepository
from app.security.jwt_handler import hash_token


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UserRepository(BaseRepository[User]):
    def __init__(self) -> None:
        super().__init__(User)

    async def get_by_email(self, email: str) -> Optional[User]:
        return await User.find_one(User.email == email, User.is_deleted == False)

    async def get_by_phone(self, phone: str) -> Optional[User]:
        return await User.find_one(User.phone == phone, User.is_deleted == False)

    async def get_by_email_or_phone(self, identifier: str) -> Optional[User]:
        user = await self.get_by_email(identifier)
        if user:
            return user
        return await self.get_by_phone(identifier)

    async def email_exists(self, email: str) -> bool:
        return bool(await User.find_one(User.email == email))

    async def phone_exists(self, phone: str) -> bool:
        return bool(await User.find_one(User.phone == phone))

    async def increment_failed_attempts(self, user_id: str) -> None:
        await User.find_one(User.id == user_id).update(
            {"$inc": {"failed_login_attempts": 1}}
        )

    async def lock_account(self, user_id: str, until: datetime) -> None:
        await User.find_one(User.id == user_id).update(
            {"$set": {"account_locked": True, "account_locked_until": until}}
        )

    async def reset_failed_attempts(self, user_id: str) -> None:
        await User.find_one(User.id == user_id).update(
            {"$set": {"failed_login_attempts": 0, "account_locked": False,
                       "account_locked_until": None}}
        )

    async def update_last_login(self, user_id: str, ip: str) -> None:
        now = _utcnow()
        await User.find_one(User.id == user_id).update(
            {"$set": {"last_login_at": now, "last_login_ip": ip,
                       "current_login_at": now}}
        )

    async def mark_email_verified(self, user_id: str) -> None:
        await User.find_one(User.id == user_id).update(
            {"$set": {"email_verified": True, "email_verified_at": _utcnow()}}
        )

    async def update_password_hash(self, user_id: str, new_hash: str) -> None:
        await User.find_one(User.id == user_id).update(
            {"$set": {"password_hash": new_hash, "updated_at": _utcnow()}}
        )


class PatientRepository(BaseRepository[Patient]):
    def __init__(self) -> None:
        super().__init__(Patient)

    async def get_by_user_id(self, user_id: str) -> Optional[Patient]:
        return await Patient.find_one(Patient.user_id == user_id)


class PharmacyRepository(BaseRepository[Pharmacy]):
    def __init__(self) -> None:
        super().__init__(Pharmacy)

    async def get_by_user_id(self, user_id: str) -> Optional[Pharmacy]:
        return await Pharmacy.find_one(Pharmacy.user_id == user_id)

    async def get_by_license(self, license_number: str) -> Optional[Pharmacy]:
        return await Pharmacy.find_one(Pharmacy.license_number == license_number)

    async def find_nearby(
        self,
        latitude: float,
        longitude: float,
        radius_km: float,
        limit: int = 20,
    ) -> list[Pharmacy]:
        radius_rad = radius_km / 6378.1  # Earth radius in km
        results = await Pharmacy.find(
            {
                "latitude": {"$gte": latitude - (radius_km / 111)},
                "longitude": {"$gte": longitude - (radius_km / 85)},
                "is_deleted": False,
            }
        ).limit(limit).to_list()
        return results

    async def find_by_city(self, city: str, limit: int = 50) -> list[Pharmacy]:
        return await Pharmacy.find(
            Pharmacy.city == city, Pharmacy.is_deleted == False
        ).limit(limit).to_list()


class AdminRepository(BaseRepository[Admin]):
    def __init__(self) -> None:
        super().__init__(Admin)

    async def get_by_user_id(self, user_id: str) -> Optional[Admin]:
        return await Admin.find_one(Admin.user_id == user_id)


class UserPreferencesRepository(BaseRepository[UserPreferences]):
    def __init__(self) -> None:
        super().__init__(UserPreferences)

    async def get_by_user_id(self, user_id: str) -> Optional[UserPreferences]:
        return await UserPreferences.find_one(UserPreferences.user_id == user_id)


class RefreshTokenRepository(BaseRepository[RefreshToken]):
    def __init__(self) -> None:
        super().__init__(RefreshToken)

    async def get_by_token(self, raw_token: str) -> Optional[RefreshToken]:
        token_hash = hash_token(raw_token)
        return await RefreshToken.find_one(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked == False,
        )

    async def revoke_token(self, token_id: str, reason: str = "") -> None:
        await RefreshToken.find_one(RefreshToken.id == token_id).update(
            {"$set": {"revoked": True, "revoked_at": _utcnow(), "revoked_reason": reason}}
        )

    async def revoke_all_for_user(self, user_id: str, reason: str = "logout_all") -> None:
        await RefreshToken.find(
            RefreshToken.user_id == user_id, RefreshToken.revoked == False
        ).update({"$set": {"revoked": True, "revoked_at": _utcnow(), "revoked_reason": reason}})

    async def cleanup_expired(self) -> int:
        result = await RefreshToken.find(
            RefreshToken.expires_at <= _utcnow()
        ).delete()
        return result.deleted_count if result else 0


class VerificationTokenRepository(BaseRepository[VerificationToken]):
    def __init__(self) -> None:
        super().__init__(VerificationToken)

    async def get_valid_token(self, raw_token: str, token_type) -> Optional[VerificationToken]:
        token_hash = hash_token(raw_token)
        return await VerificationToken.find_one(
            VerificationToken.token_hash == token_hash,
            VerificationToken.token_type == token_type,
            VerificationToken.used == False,
            VerificationToken.expires_at > _utcnow(),
        )

    async def mark_used(self, token_id: str) -> None:
        await VerificationToken.find_one(VerificationToken.id == token_id).update(
            {"$set": {"used": True, "used_at": _utcnow()}}
        )


class PasswordResetTokenRepository(BaseRepository[PasswordResetToken]):
    def __init__(self) -> None:
        super().__init__(PasswordResetToken)

    async def get_valid_token(self, raw_token: str) -> Optional[PasswordResetToken]:
        from app.security.jwt_handler import hash_token as ht
        token_hash = ht(raw_token)
        return await PasswordResetToken.find_one(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used == False,
            PasswordResetToken.expires_at > _utcnow(),
        )

    async def mark_used(self, token_id: str) -> None:
        await PasswordResetToken.find_one(PasswordResetToken.id == token_id).update(
            {"$set": {"used": True, "used_at": _utcnow()}}
        )


class SessionRepository(BaseRepository[Session]):
    def __init__(self) -> None:
        super().__init__(Session)

    async def get_active_sessions(self, user_id: str) -> list[Session]:
        return await Session.find(
            Session.user_id == user_id,
            Session.status == "active",
        ).to_list()

    async def revoke_all_for_user(self, user_id: str) -> None:
        await Session.find(
            Session.user_id == user_id, Session.status == "active"
        ).update({"$set": {"status": "revoked", "logout_at": _utcnow()}})


class AuditLogRepository(BaseRepository[AuditLog]):
    def __init__(self) -> None:
        super().__init__(AuditLog)

    async def log(
        self,
        action: str,
        module: str,
        user_id: str | None = None,
        role: str | None = None,
        entity_id: str | None = None,
        entity_type: str | None = None,
        ip_address: str = "",
        request_id: str = "",
        result: str = "success",
        reason: str | None = None,
        metadata: dict | None = None,
    ) -> AuditLog:
        log = AuditLog(
            user_id=user_id,
            role=role,
            action=action,
            module=module,
            entity_id=entity_id,
            entity_type=entity_type,
            ip_address=ip_address,
            request_id=request_id,
            result=result,
            reason=reason,
            metadata=metadata or {},
        )
        await log.insert()
        return log


class DeviceRepository(BaseRepository[Device]):
    def __init__(self) -> None:
        super().__init__(Device)

    async def get_by_fingerprint(self, user_id: str, fingerprint: str) -> Optional[Device]:
        return await Device.find_one(
            Device.user_id == user_id,
            Device.device_fingerprint == fingerprint,
        )

    async def get_user_devices(self, user_id: str) -> list[Device]:
        return await Device.find(
            Device.user_id == user_id, Device.is_deleted == False
        ).to_list()


class RoleRepository(BaseRepository[Role]):
    def __init__(self) -> None:
        super().__init__(Role)

    async def get_by_name(self, name: str) -> Optional[Role]:
        return await Role.find_one(Role.name == name, Role.is_active == True)
