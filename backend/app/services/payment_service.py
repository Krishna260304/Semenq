from __future__ import annotations

import hmac
import hashlib
from datetime import datetime, timezone
from typing import Optional

from app.core.config import get_settings
from app.core.exceptions import (
    InvalidPaymentStateException,
    PaymentFailedException,
    PaymentVerificationException,
    ReservationNotFoundException,
)
from app.core.logging.logger import get_logger
from app.models.payment import Payment, PaymentMethod, PaymentRefund, PaymentStatus, PaymentTransaction, RefundStatus
from app.models.reservation import Reservation, ReservationStatus
from app.providers.payment.razorpay_provider import RazorpayProvider
from app.services.reservation_service import ReservationService

logger = get_logger(__name__)
settings = get_settings()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class PaymentService:
    def __init__(self) -> None:
        self._provider = RazorpayProvider()
        self._reservation_service = ReservationService()

    async def initiate_payment(self, reservation_id: str, patient_id: str) -> Payment:
        reservation = await Reservation.find_one(
            Reservation.id == reservation_id,
            Reservation.patient_id == patient_id,
        )
        if not reservation:
            raise ReservationNotFoundException()

        if reservation.status != ReservationStatus.CONFIRMED:
            raise InvalidPaymentStateException(
                f"Cannot initiate payment. Reservation is in {reservation.status.value} state."
            )

        notes = {
            "reservation_id": str(reservation.id),
            "patient_id": str(patient_id),
            "pharmacy_id": str(reservation.pharmacy_id),
        }

        order_result = await self._provider.create_order(
            amount_inr=reservation.grand_total,
            currency="INR",
            receipt=f"rcpt_{reservation.reservation_number}",
            notes=notes,
        )

        payment = Payment(
            reservation_id=reservation.id,
            patient_id=patient_id,
            provider="razorpay",
            provider_order_id=order_result.order_id,
            amount=reservation.grand_total,
            amount_in_paise=order_result.amount,
            currency=order_result.currency,
            status=PaymentStatus.CREATED,
        )
        await payment.insert()

        await self._reservation_service.transition_state(
            reservation_id=reservation.id,
            new_status=ReservationStatus.AWAITING_PAYMENT,
            changed_by=patient_id,
        )

        logger.info("Payment initiated", payment_id=payment.id, order_id=order_result.order_id)
        return payment

    async def verify_payment(
        self,
        razorpay_order_id: str,
        razorpay_payment_id: str,
        razorpay_signature: str,
    ) -> Payment:
        payment = await Payment.find_one(Payment.provider_order_id == razorpay_order_id)
        if not payment:
            raise PaymentFailedException("Payment order not found.")

        if payment.status in (PaymentStatus.CAPTURED, PaymentStatus.AUTHORIZED):
            return payment

        verify_result = await self._provider.verify_payment(
            order_id=razorpay_order_id,
            payment_id=razorpay_payment_id,
            signature=razorpay_signature,
        )

        if not verify_result.is_valid:
            payment.status = PaymentStatus.FAILED
            payment.failed_at = _utcnow()
            payment.failure_reason = verify_result.error
            await payment.save()

            await self._record_transaction(payment, "failed", verify_result.error)

            raise PaymentVerificationException(verify_result.error or "Signature verification failed.")

        payment.provider_payment_id = razorpay_payment_id
        payment.provider_signature = razorpay_signature
        payment.status = PaymentStatus.CAPTURED
        payment.captured_at = _utcnow()
        await payment.save()

        await self._record_transaction(payment, "captured", "Payment verified and captured.")

        reservation = await Reservation.find_one(Reservation.id == payment.reservation_id)
        if reservation:
            reservation.payment_id = payment.id
            reservation.payment_status = "paid"
            await reservation.save()

            await self._reservation_service.transition_state(
                reservation_id=reservation.id,
                new_status=ReservationStatus.PAID,
                changed_by="system",
            )

        logger.info("Payment verified", payment_id=payment.id, provider_payment_id=razorpay_payment_id)
        return payment

    async def handle_webhook(self, event_type: str, payload: dict, signature: str) -> bool:
        body_bytes = payload.get("_raw_body", b"")
        expected_sig = hmac.new(
            settings.RAZORPAY_WEBHOOK_SECRET.encode(),
            body_bytes,
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(expected_sig, signature):
            logger.warning("Webhook signature mismatch", signature=signature)
            return False

        if event_type == "payment.captured":
            order_id = payload["payload"]["payment"]["entity"]["order_id"]
            payment_id = payload["payload"]["payment"]["entity"]["id"]
            payment = await Payment.find_one(Payment.provider_order_id == order_id)
            if payment and payment.status != PaymentStatus.CAPTURED:
                payment.provider_payment_id = payment_id
                payment.status = PaymentStatus.CAPTURED
                payment.captured_at = _utcnow()
                await payment.save()
                await self._record_transaction(payment, "captured", "Webhook capture")
                await self._reservation_service.transition_state(
                    reservation_id=payment.reservation_id,
                    new_status=ReservationStatus.PAID,
                    changed_by="system",
                )

        elif event_type == "payment.failed":
            order_id = payload["payload"]["payment"]["entity"]["order_id"]
            payment = await Payment.find_one(Payment.provider_order_id == order_id)
            if payment and payment.status == PaymentStatus.CREATED:
                payment.status = PaymentStatus.FAILED
                payment.failed_at = _utcnow()
                payment.failure_reason = payload["payload"]["payment"]["entity"]["error_description"]
                await payment.save()
                await self._record_transaction(payment, "failed", payment.failure_reason)

        return True

    async def process_refund(self, reservation_id: str, reason: str, initiated_by: str) -> PaymentRefund:
        payment = await Payment.find_one(
            Payment.reservation_id == reservation_id,
            Payment.status == PaymentStatus.CAPTURED
        )
        if not payment or not payment.provider_payment_id:
            raise PaymentFailedException("No captured payment found for this reservation.")

        existing_refund = await PaymentRefund.find_one(PaymentRefund.payment_id == payment.id)
        if existing_refund:
            return existing_refund

        refund = PaymentRefund(
            payment_id=payment.id,
            reservation_id=reservation_id,
            patient_id=payment.patient_id,
            amount=payment.amount,
            reason=reason,
            initiated_by=initiated_by,
        )
        await refund.insert()

        try:
            result = await self._provider.refund(
                payment_id=payment.provider_payment_id,
                amount_inr=payment.amount,
                notes={"reservation_id": reservation_id, "reason": reason},
            )

            refund.provider_refund_id = result.refund_id
            refund.status = RefundStatus.COMPLETED
            refund.processed_at = _utcnow()
            await refund.save()

            payment.status = PaymentStatus.REFUNDED
            await payment.save()

            await self._record_transaction(payment, "refunded", f"Refund {result.refund_id} processed")

        except Exception as exc:
            logger.error("Refund failed", error=str(exc))
            refund.status = RefundStatus.FAILED
            refund.failure_reason = str(exc)
            await refund.save()
            raise PaymentFailedException(f"Refund processing failed: {exc}")

        return refund

    async def _record_transaction(self, payment: Payment, event_type: str, status: str) -> None:
        tx = PaymentTransaction(
            payment_id=payment.id,
            event_type=event_type,
            provider_event_id=payment.provider_payment_id,
            amount=payment.amount,
            currency=payment.currency,
            status=status,
        )
        await tx.insert()
