
from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, Request

from app.core.middleware.request_id import REQUEST_ID_CTX
from app.core.responses import APIResponse
from app.dependencies.auth import get_current_active_user, get_token_payload
from app.models.user import Session, User
from app.schemas.auth import (
    ChangePasswordRequest,
    EmailOtpRequest,
    EmailOtpResponse,
    FirebaseRegisterRequest,
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
    VerifyPasswordResetRequest,
    VerifyEmailRequest,
    VerifyEmailOtpRequest,
)
from app.services.auth_service import AuthService
from app.security.firebase_auth import create_firebase_custom_token, get_or_create_firebase_user

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
    "/register/firebase",
    response_model=APIResponse[dict],
    status_code=201,
    summary="Sync Firebase user to MongoDB after client-side registration",
)
async def register_with_firebase(
    body: FirebaseRegisterRequest,
    request: Request,
) -> APIResponse:
    from app.security.firebase_auth import verify_firebase_token
    from app.models.user import User, Patient, Pharmacy, Address, AddressType, UserRole, UserStatus, UserPreferences
    from app.security.password_handler import hash_password
    import secrets

    try:
        decoded = verify_firebase_token(body.id_token)
    except ValueError as exc:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail=str(exc))

    firebase_uid = decoded.get("uid", "")
    firebase_email = decoded.get("email", "").lower().strip()
    firebase_name = decoded.get("name") or body.full_name

    email = firebase_email or body.email.lower().strip()
    phone = body.phone
    role_str = body.role

    existing_user = await User.find_one(User.email == email)
    if existing_user:
        return APIResponse.ok(
            data={"user_id": existing_user.id, "already_exists": True},
            message="User already registered.",
        )

    dummy_password = secrets.token_urlsafe(32) + "!Aa1"
    password_hash = hash_password(dummy_password)

    role = UserRole.PATIENT
    if role_str == "pharmacy":
        role = UserRole.PHARMACY

    user = User(
        full_name=(firebase_name or body.full_name).strip(),
        email=email,
        phone=phone,
        password_hash=password_hash,
        role=role,
        status=UserStatus.ACTIVE,
        email_verified=True,
    )
    await user.insert()

    prefs = UserPreferences(user_id=user.id)
    await prefs.insert()
    user.preferences_id = prefs.id
    await user.save()

    if role == UserRole.PATIENT:
        patient = Patient(user_id=user.id)
        await patient.insert()
    elif role == UserRole.PHARMACY:
        pharmacy = Pharmacy(
            user_id=user.id,
            pharmacy_name=body.full_name,
            owner_name=body.full_name,
            license_number=body.license_number or f"TEMP-{user.id}",
            street=body.address or "",
            city=body.city or "",
            state=body.state or "",
            pincode=body.pincode or "",
        )
        await pharmacy.insert()

    if body.address or body.city or body.street:
        street = body.street or body.address or ""
        addr = Address(
            user_id=user.id,
            address_name="Home",
            street=street,
            area="",
            city=body.city or "",
            state=body.state or "",
            pincode=body.pincode or "",
            address_type=AddressType.HOME,
            is_default=True,
            latitude=body.latitude,
            longitude=body.longitude,
        )
        await addr.insert()

    return APIResponse.ok(
        data={"user_id": user.id, "already_exists": False},
        message="User profile synced successfully.",
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


@router.post(
    "/request-otp",
    response_model=APIResponse[None],
    summary="Request an OTP",
)
async def request_support_otp(
    body: EmailOtpRequest,
    request: Request,
) -> APIResponse:
    recipient_email = await _auth_service.request_support_otp(
        email=body.email,
        purpose=body.purpose,
        role=body.role,
        ip_address=_client_ip(request),
    )
    if body.purpose == "email_2fa":
        message = "OTP sent to your registered email address for verification."
    else:
        message = f"OTP sent to {recipient_email} for verification."
    return APIResponse.ok(
        message=message,
        request_id=REQUEST_ID_CTX.get(""),
    )


@router.post(
    "/verify-otp",
    response_model=APIResponse[EmailOtpResponse],
    summary="Verify an OTP",
)
async def verify_support_otp(
    body: VerifyEmailOtpRequest,
    request: Request,
) -> APIResponse:
    user = await _auth_service.verify_support_otp(
        email=body.email,
        raw_token=body.otp,
        purpose=body.purpose,
        role=body.role,
        ip_address=_client_ip(request),
    )

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
            "semenq_role": getattr(user.role, "value", str(user.role)),
            "semenq_email": user.email,
        },
    )

    return APIResponse.ok(
        data=EmailOtpResponse(
            firebase_custom_token=firebase_custom_token,
            user_id=user.id,
            role=getattr(user.role, "value", str(user.role)),
            email=user.email,
            full_name=user.full_name,
        ),
        message="OTP verified successfully.",
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


@router.get("/sessions", response_model=APIResponse[list[dict]], summary="List active sessions")
async def list_sessions(
    user: User = Depends(get_current_active_user),
) -> APIResponse:
    sessions = await _auth_service.get_active_sessions(user.id)
    return APIResponse.ok(
        data=[
            {
                "id": session.id,
                "deviceName": session.device_name or "Unknown device",
                "deviceOs": session.device_os,
                "browser": session.browser,
                "operatingSystem": session.operating_system,
                "loginAt": session.login_at,
                "lastActivityAt": session.last_activity_at,
                "current": False,
            }
            for session in sessions
        ],
        message="Active sessions retrieved.",
        request_id=REQUEST_ID_CTX.get(""),
    )


@router.delete("/sessions/{session_id}", response_model=APIResponse[None], summary="Revoke an active session")
async def revoke_session(
    session_id: str,
    user: User = Depends(get_current_active_user),
) -> APIResponse:
    revoked = await _auth_service.revoke_session(session_id, user.id)
    if not revoked:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Active session not found.")
    return APIResponse.ok(message="Session revoked.", request_id=REQUEST_ID_CTX.get(""))


@router.post("/send-verification", response_model=APIResponse[None], summary="Resend email verification")
async def send_verification(
    body: SendVerificationRequest,
    background_tasks: BackgroundTasks,
) -> APIResponse:
    raw_token = await _auth_service.resend_verification(body.email)
    if raw_token:
        background_tasks.add_task(_send_verification_email, body.email, "", raw_token)
    return APIResponse.ok(message="If your email is registered, you will receive a 6-digit verification code.")


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
    return APIResponse.ok(message="If your email is registered, you will receive a 6-digit reset code.")


@router.post("/verify-password-reset", response_model=APIResponse[None], summary="Verify password reset code")
async def verify_password_reset(
    body: VerifyPasswordResetRequest,
) -> APIResponse:
    await _auth_service.verify_password_reset_token(body.token)
    return APIResponse.ok(message="Password reset code verified.")


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
