from __future__ import annotations

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.exceptions import AuthorizationException
from app.models.user import User, UserRole
from app.security.jwt_handler import TokenPayload, decode_access_token
from app.services.auth_service import AuthService

_bearer = HTTPBearer(auto_error=True)
_auth_service = AuthService()


async def _resolve_firebase_user(decoded: dict) -> User | None:
    """
    Resolve a MongoDB User from a decoded Firebase token.

    Firebase email-auth tokens carry an `email` field.
    Firebase phone-auth tokens only carry a `phone_number` field (no email).
    We try email first, then fall back to phone_number so both auth providers work.
    """
    # 1. Try email lookup (email/password & Google sign-in)
    email = decoded.get("email", "").lower().strip()
    if email:
        user = await User.find_one(User.email == email)
        if user:
            return user

    # 2. Fallback: phone number lookup (Firebase phone-OTP sign-in)
    phone = decoded.get("phone_number", "").strip()
    if phone:
        user = await User.find_one(User.phone == phone)
        if user:
            return user

    # 3. Fallback: uid stored as firebase_uid field (if present on User model)
    uid = decoded.get("uid", "").strip()
    if uid:
        user = await User.find_one({"firebase_uid": uid})
        if user:
            return user

    return None


async def get_token_payload(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> TokenPayload:
    token = credentials.credentials

    # --- Try our own JWT first (email/password login flow) ---
    try:
        return decode_access_token(token)
    except Exception:
        pass

    # --- Fall back to Firebase ID token verification ---
    from app.security.firebase_auth import verify_firebase_token
    from app.core.exceptions import InvalidTokenException

    try:
        decoded = verify_firebase_token(token)
    except Exception as exc:
        raise InvalidTokenException(f"Invalid or expired token: {exc}")

    user = await _resolve_firebase_user(decoded)
    if user is None:
        raise InvalidTokenException(
            "No Semenq account found for this Firebase identity. "
            "Please complete registration first."
        )

    return TokenPayload({
        "sub": user.id,
        "role": user.role.value if hasattr(user.role, "value") else str(user.role),
        "sid": "",
        "jti": "",
        "type": "access",
        "exp": 9999999999,
    })


async def get_current_user(
    payload: TokenPayload = Depends(get_token_payload),
) -> User:
    return await _auth_service.get_current_user(payload.sub)


async def get_current_active_user(
    user: User = Depends(get_current_user),
) -> User:
    from app.models.user import UserStatus
    from app.core.exceptions import AuthenticationException
    if user.status not in (UserStatus.ACTIVE, UserStatus.PENDING_VERIFICATION):
        raise AuthenticationException("Account is not active.")
    return user


def require_role(*roles: UserRole):
    async def _check(user: User = Depends(get_current_active_user)) -> User:
        if user.role not in roles:
            raise AuthorizationException(
                f"Role '{user.role.value}' is not permitted for this resource."
            )
        return user
    return _check


require_patient = require_role(UserRole.PATIENT)
require_pharmacy = require_role(UserRole.PHARMACY)
require_admin = require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)
require_super_admin = require_role(UserRole.SUPER_ADMIN)
require_pharmacy_or_admin = require_role(UserRole.PHARMACY, UserRole.ADMIN, UserRole.SUPER_ADMIN)

