
from __future__ import annotations

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.exceptions import AuthorizationException
from app.models.user import User, UserRole
from app.security.jwt_handler import TokenPayload, decode_access_token
from app.services.auth_service import AuthService

_bearer = HTTPBearer(auto_error=True)
_auth_service = AuthService()


async def get_token_payload(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> TokenPayload:
    return decode_access_token(credentials.credentials)


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
