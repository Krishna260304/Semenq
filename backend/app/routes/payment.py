
from __future__ import annotations

from fastapi import APIRouter, Depends, Header, Request

from app.core.middleware.request_id import REQUEST_ID_CTX
from app.core.responses import APIResponse
from app.dependencies.auth import require_patient
from app.models.user import User
from app.schemas.reservation import VerifyPaymentWebhookRequest
from app.services.payment_service import PaymentService

router = APIRouter(prefix="/payments", tags=["Payments"])
_payment_service = PaymentService()


@router.post("/{reservation_id}/initiate", response_model=APIResponse[dict], summary="Initiate Payment for Reservation")
async def initiate_payment(
    reservation_id: str,
    user: User = Depends(require_patient),
) -> APIResponse:
    payment = await _payment_service.initiate_payment(reservation_id, user.id)
    return APIResponse.ok(
        data={
            "payment_id": payment.id,
            "razorpay_order_id": payment.provider_order_id,
            "amount": payment.amount_in_paise,
            "currency": payment.currency,
        },
        message="Payment initiated.",
        request_id=REQUEST_ID_CTX.get(""),
    )


@router.post("/verify", response_model=APIResponse[dict], summary="Verify Payment (Client Call)")
async def verify_payment(
    body: VerifyPaymentWebhookRequest,
    user: User = Depends(require_patient),
) -> APIResponse:
    payment = await _payment_service.verify_payment(
        razorpay_order_id=body.razorpay_order_id,
        razorpay_payment_id=body.razorpay_payment_id,
        razorpay_signature=body.razorpay_signature,
    )
    
    from app.services.order_service import OrderService
    await OrderService().create_order_from_reservation(payment.reservation_id)

    return APIResponse.ok(message="Payment verified successfully.", request_id=REQUEST_ID_CTX.get(""))


@router.post("/webhook/razorpay", summary="Razorpay Webhook Endpoint")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(None),
) -> dict:
    body = await request.body()
    payload = await request.json()
    payload["_raw_body"] = body

    is_valid = await _payment_service.handle_webhook(
        event_type=payload.get("event"),
        payload=payload,
        signature=x_razorpay_signature,
    )
    
    if not is_valid:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Invalid signature")

    return {"status": "ok"}
