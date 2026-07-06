
from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, Request

from app.core.middleware.request_id import REQUEST_ID_CTX
from app.core.responses import APIResponse
from app.dependencies.auth import get_current_active_user, get_token_payload
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    FirebaseLoginRequest,
    LogoutRequest,
    MeResponse,
    PatientRegisterRequest,
    PharmacyRegisterRequest,
    RefreshTokenRequest,
    RegisterResponse,
    RequestPasswordResetRequest,
    ResetPasswordRequest,
    SendVerificationRequest,
    TokenResponse,
    UserSummaryResponse,
    VerifyEmailRequest,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])
_auth_service = AuthService()


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post(
    "/register/patient",
    response_model=APIResponse[RegisterResponse],
    status_code=201,
    summary="Register a new patient",
)
async def register_patient(
    body: PatientRegisterRequest,
    request: Request,
    background_tasks: BackgroundTasks,
) -> APIResponse:
    user, patient, raw_token = await _auth_service.register_patient(
        full_name=body.full_name,
        email=body.email,
        phone=body.phone,
        password=body.password,
        date_of_birth=body.date_of_birth,
        gender=body.gender,
        ip_address=_client_ip(request),
    )
    background_tasks.add_task(_send_verification_email, user.email, user.full_name, raw_token)

    return APIResponse.ok(
        data=RegisterResponse(user_id=user.id),
        message="Registration successful. Please check your email to verify your account.",
        request_id=REQUEST_ID_CTX.get(""),
    )


@router.post(
    "/register/pharmacy",
    response_model=APIResponse[RegisterResponse],
    status_code=201,
    summary="Register a new pharmacy",
)
async def register_pharmacy(
    body: PharmacyRegisterRequest,
    request: Request,
    background_tasks: BackgroundTasks,
) -> APIResponse:
    user, pharmacy, raw_token = await _auth_service.register_pharmacy(
        pharmacy_name=body.pharmacy_name,
        owner_name=body.owner_name,
        email=body.email,
        phone=body.phone,
        license_number=body.license_number,
        gst_number=body.gst_number,
        street=body.street,
        city=body.city,
        state=body.state,
        pincode=body.pincode,
        password=body.password,
        ip_address=_client_ip(request),
    )
    background_tasks.add_task(_send_verification_email, user.email, user.full_name, raw_token)

    return APIResponse.ok(
        data=RegisterResponse(
            user_id=user.id,
            message="Registration successful. Verify your email and await admin verification.",
        ),
        message="Pharmacy registration submitted. Pending admin verification.",
        request_id=REQUEST_ID_CTX.get(""),
    )


@router.post(
    "/login",
    response_model=APIResponse[TokenResponse],
    summary="Login with email/phone and password",
)
async def login(
    body: LoginRequest,
    request: Request,
) -> APIResponse:
    result = await _auth_service.login(
        identifier=body.identifier,
        password=body.password,
        ip_address=_client_ip(request),
        device_name=body.device_name,
        device_os=body.device_os,
        device_fingerprint=body.device_fingerprint,
    )
    return APIResponse.ok(
        data=TokenResponse(**result),
        message="Login successful.",
        request_id=REQUEST_ID_CTX.get(""),
    )


@router.post(
    "/login/firebase",
    response_model=APIResponse[TokenResponse],
    summary="Login with Firebase Phone Authentication",
)
async def login_with_firebase(
    body: FirebaseLoginRequest,
    request: Request,
) -> APIResponse:
    result = await _auth_service.login_with_firebase(
        id_token=body.id_token,
        ip_address=_client_ip(request),
        device_name=body.device_name,
        device_os=body.device_os,
        device_fingerprint=body.device_fingerprint,
    )
    return APIResponse.ok(
        data=TokenResponse(**result),
        message="Firebase Login successful.",
        request_id=REQUEST_ID_CTX.get(""),
    )


@router.post("/refresh", response_model=APIResponse[dict], summary="Refresh access token")
async def refresh_token(
    body: RefreshTokenRequest,
    request: Request,
) -> APIResponse:
    tokens = await _auth_service.refresh_access_token(
        raw_refresh_token=body.refresh_token,
        ip_address=_client_ip(request),
    )
    return APIResponse.ok(data=tokens, message="Token refreshed.", request_id=REQUEST_ID_CTX.get(""))


@router.post("/logout", response_model=APIResponse[None], summary="Logout current session")
async def logout(
    body: LogoutRequest,
    user: User = Depends(get_current_active_user),
) -> APIResponse:
    await _auth_service.logout(body.refresh_token, user.id)
    return APIResponse.ok(message="Logged out successfully.", request_id=REQUEST_ID_CTX.get(""))


@router.post("/logout-all", response_model=APIResponse[None], summary="Logout all devices")
async def logout_all(
    user: User = Depends(get_current_active_user),
) -> APIResponse:
    await _auth_service.logout_all_devices(user.id)
    return APIResponse.ok(message="Logged out from all devices.", request_id=REQUEST_ID_CTX.get(""))


@router.post("/send-verification", response_model=APIResponse[None], summary="Resend email verification")
async def send_verification(
    body: SendVerificationRequest,
    background_tasks: BackgroundTasks,
) -> APIResponse:
    raw_token = await _auth_service.resend_verification(body.email)
    if raw_token:
        background_tasks.add_task(_send_verification_email, body.email, "", raw_token)
    return APIResponse.ok(message="If your email is registered, you will receive a verification link.")


@router.post("/verify-email", response_model=APIResponse[None], summary="Verify email address")
async def verify_email(
    body: VerifyEmailRequest,
    request: Request,
) -> APIResponse:
    await _auth_service.verify_email(body.token, ip_address=_client_ip(request))
    return APIResponse.ok(message="Email verified successfully.", request_id=REQUEST_ID_CTX.get(""))


@router.post("/request-password-reset", response_model=APIResponse[None], summary="Request password reset")
async def request_password_reset(
    body: RequestPasswordResetRequest,
    background_tasks: BackgroundTasks,
) -> APIResponse:
    raw_token = await _auth_service.request_password_reset(body.email)
    if raw_token:
        background_tasks.add_task(_send_password_reset_email, body.email, raw_token)
    return APIResponse.ok(message="If your email is registered, you will receive a reset link.")


@router.post("/reset-password", response_model=APIResponse[None], summary="Reset password")
async def reset_password(
    body: ResetPasswordRequest,
    request: Request,
) -> APIResponse:
    await _auth_service.reset_password(
        raw_token=body.token,
        new_password=body.new_password,
        ip_address=_client_ip(request),
    )
    return APIResponse.ok(message="Password reset successfully. Please login.")


@router.get("/me", response_model=APIResponse[MeResponse], summary="Get current user profile")
async def get_me(user: User = Depends(get_current_active_user)) -> APIResponse:
    permissions = await _auth_service.get_user_permissions(user.id)
    return APIResponse.ok(
        data=MeResponse(
            user=UserSummaryResponse(
                id=user.id,
                full_name=user.full_name,
                email=user.email,
                phone=user.phone,
                role=user.role.value,
                status=user.status.value,
                email_verified=user.email_verified,
                profile_photo_url=user.profile_photo_url,
                last_login_at=user.last_login_at,
                created_at=user.created_at,
            ),
            permissions=permissions,
        ),
        message="User profile retrieved.",
        request_id=REQUEST_ID_CTX.get(""),
    )



async def _send_verification_email(email: str, name: str, token: str) -> None:
    try:
        from app.services.notification_service import NotificationService
        await NotificationService().send_email_verification(email, name, token)
    except Exception as exc:
        from app.core.logging.logger import get_logger
        get_logger(__name__).error("Failed to send verification email", error=str(exc))


async def _send_password_reset_email(email: str, token: str) -> None:
    try:
        from app.services.notification_service import NotificationService
        await NotificationService().send_password_reset(email, token)
    except Exception as exc:
        from app.core.logging.logger import get_logger
        get_logger(__name__).error("Failed to send reset email", error=str(exc))
