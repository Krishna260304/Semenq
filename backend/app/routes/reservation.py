
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.middleware.request_id import REQUEST_ID_CTX
from app.core.responses import APIResponse
from app.dependencies.auth import get_current_active_user, require_patient, require_pharmacy
from app.models.reservation import ReservationStatus
from app.models.user import User
from app.schemas.reservation import CreateReservationRequest, ReservationResponse
from app.services.qr_service import QRService
from app.services.reservation_service import ReservationService

router = APIRouter(prefix="/reservations", tags=["Reservations"])
_reservation_service = ReservationService()
_qr_service = QRService()


@router.get("", response_model=APIResponse[list[dict]], summary="List reservations")
async def list_reservations() -> APIResponse:
    items = await Reservation.find(Reservation.is_deleted == False).sort([("created_at", -1)]).limit(100).to_list()  # noqa: E712
    return APIResponse.ok(data=[item.model_dump() for item in items], request_id=REQUEST_ID_CTX.get(""))


@router.get("/{reservation_id}", response_model=APIResponse[dict], summary="Get reservation")
async def get_reservation(reservation_id: str) -> APIResponse:
    reservation = await Reservation.get(reservation_id)
    if not reservation:
        return APIResponse.ok(data={}, message="Reservation not found.")
    return APIResponse.ok(data=reservation.model_dump(), request_id=REQUEST_ID_CTX.get(""))


@router.post("/", response_model=APIResponse[ReservationResponse], summary="Create a Reservation")
async def create_reservation(
    body: CreateReservationRequest,
    user: User = Depends(require_patient),
) -> APIResponse:
    reservation = await _reservation_service.create_reservation(
        patient_id=user.id,
        pharmacy_id=body.pharmacy_id,
        items=[item.model_dump() for item in body.items],
        pickup_method=body.pickup_method,
        delivery_address_id=body.delivery_address_id,
        prescription_id=body.prescription_id,
    )
    
    data = ReservationResponse(
        id=reservation.id,
        reservation_number=reservation.reservation_number,
        pharmacy_id=reservation.pharmacy_id,
        pharmacy_name=reservation.pharmacy_name,
        status=reservation.status.value,
        pickup_method=reservation.pickup_method.value,
        medicine_count=reservation.medicine_count,
        subtotal=reservation.subtotal,
        grand_total=reservation.grand_total,
        expires_at=reservation.expires_at,
        created_at=reservation.created_at,
    )

    return APIResponse.ok(
        data=data,
        message="Reservation created and stock locked. Please complete payment within the expiry window.",
        request_id=REQUEST_ID_CTX.get(""),
    )


@router.get("/patient", response_model=APIResponse[list[ReservationResponse]], summary="Get Patient Reservations")
async def get_patient_reservations(
    user: User = Depends(require_patient),
) -> APIResponse:
    items, total = await _reservation_service.get_patient_reservations(patient_id=user.id)
    data = [ReservationResponse(**r.model_dump()) for r in items]
    return APIResponse.ok(data=data, request_id=REQUEST_ID_CTX.get(""))


@router.post("/{reservation_id}/cancel", response_model=APIResponse[ReservationResponse], summary="Cancel Reservation")
async def cancel_reservation(
    reservation_id: str,
    user: User = Depends(require_patient),
) -> APIResponse:
    reservation = await _reservation_service.cancel_reservation(reservation_id, user.id)
    data = ReservationResponse(**reservation.model_dump())
    return APIResponse.ok(data=data, message="Reservation cancelled and stock released.", request_id=REQUEST_ID_CTX.get(""))


@router.patch("/{reservation_id}", response_model=APIResponse[dict], summary="Update reservation")
async def update_reservation(reservation_id: str, body: dict) -> APIResponse:
    reservation = await Reservation.get(reservation_id)
    if not reservation:
        return APIResponse.ok(data={}, message="Reservation not found.")
    if status := body.get("status"):
        reservation.status = status
    if notes := body.get("notes"):
        reservation.notes = notes
    await reservation.save()
    return APIResponse.ok(data=reservation.model_dump(), message="Reservation updated.", request_id=REQUEST_ID_CTX.get(""))


@router.post("/{reservation_id}/qr", response_model=APIResponse[dict], summary="Generate QR Code for Pickup")
async def generate_qr(
    reservation_id: str,
    user: User = Depends(require_patient),
) -> APIResponse:
    reservation = await _reservation_service.get_reservation(reservation_id, user.id)
    qr_record = await _qr_service.generate_qr(reservation)
    
    return APIResponse.ok(
        data={"qr_url": qr_record.qr_image_url, "expires_at": qr_record.expires_at},
        message="QR Code generated.",
        request_id=REQUEST_ID_CTX.get(""),
    )


@router.post("/qr/verify", response_model=APIResponse[dict], summary="Verify QR Code (Pharmacy)")
async def verify_qr(
    qr_payload: dict,
    user: User = Depends(require_pharmacy),
) -> APIResponse:
    import json
    from app.repositories.user_repository import PharmacyRepository
    pharmacy = await PharmacyRepository().get_by_user_id(user.id)
    
    result = await _qr_service.verify_qr(json.dumps(qr_payload.get("payload")), pharmacy.id)
    
    await _reservation_service.transition_state(
        reservation_id=result["reservation_id"],
        new_status=ReservationStatus.COMPLETED,
        changed_by=user.id,
        changed_by_role="pharmacy",
        reason="QR Scanned by pharmacy",
    )

    return APIResponse.ok(
        data=result,
        message="QR Verified and reservation marked as completed.",
        request_id=REQUEST_ID_CTX.get(""),
    )
