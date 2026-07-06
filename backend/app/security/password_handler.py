
from __future__ import annotations

import re

from passlib.context import CryptContext

from app.core.exceptions import WeakPasswordException

_pwd_context = CryptContext(
    schemes=["argon2"],
    deprecated="auto",
    argon2__memory_cost=65536,   # 64 MB
    argon2__time_cost=3,
    argon2__parallelism=4,
)

_MIN_LENGTH = 8
_PASSWORD_REGEX = re.compile(
    r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_\-#^()+=\[\]{}|;:,.<>?/~`])"
    r".{" + str(_MIN_LENGTH) + r",128}$"
)

_COMMON_PASSWORDS = frozenset([
    "Password1!", "Password123!", "Qwerty123!", "Admin1234!",
    "Welcome1!", "12345678", "password", "123456789",
])


def hash_password(plain_password: str) -> str:
    validate_password_strength(plain_password)
    return _pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return _pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False


def needs_rehash(hashed_password: str) -> bool:
    return _pwd_context.needs_update(hashed_password)


def validate_password_strength(password: str) -> None:
    if not password or len(password) < _MIN_LENGTH:
        raise WeakPasswordException(
            f"Password must be at least {_MIN_LENGTH} characters long.",
            details={"requirement": f"min_length:{_MIN_LENGTH}"},
        )

    if len(password) > 128:
        raise WeakPasswordException(
            "Password must not exceed 128 characters.",
            details={"requirement": "max_length:128"},
        )

    if password.lower() in _COMMON_PASSWORDS or password in _COMMON_PASSWORDS:
        raise WeakPasswordException(
            "Password is too common. Please choose a stronger password.",
            details={"requirement": "not_common"},
        )

    if not _PASSWORD_REGEX.match(password):
        raise WeakPasswordException(
            "Password must contain at least one uppercase letter, one lowercase letter, "
            "one digit, and one special character.",
            details={
                "requirements": [
                    "uppercase_letter",
                    "lowercase_letter",
                    "digit",
                    "special_character",
                ]
            },
        )
