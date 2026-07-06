
from __future__ import annotations

import hashlib
import hmac
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class PaymentOrderResult:
    order_id: str
    amount: int          # in paise
    currency: str
    receipt: str
    status: str
    provider: str = "razorpay"


@dataclass
class PaymentVerificationResult:
    is_valid: bool
    payment_id: str
    order_id: str
    status: str
    method: Optional[str] = None
    error: Optional[str] = None


@dataclass
class RefundResult:
    refund_id: str
    payment_id: str
    amount: int
    status: str
    speed: str = "normal"


class BasePaymentProvider(ABC):
    @abstractmethod
    async def create_order(self, amount_inr: float, currency: str, receipt: str, notes: dict) -> PaymentOrderResult:
        ...

    @abstractmethod
    async def verify_payment(self, order_id: str, payment_id: str, signature: str) -> PaymentVerificationResult:
        ...

    @abstractmethod
    async def refund(self, payment_id: str, amount_inr: float, notes: dict) -> RefundResult:
        ...

    @abstractmethod
    async def get_payment_status(self, payment_id: str) -> dict:
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        ...


class RazorpayProvider(BasePaymentProvider):

    def __init__(self) -> None:
        from app.core.config import get_settings
        self._settings = get_settings()

    def _get_client(self):
        import razorpay
        return razorpay.Client(
            auth=(self._settings.RAZORPAY_KEY_ID, self._settings.RAZORPAY_KEY_SECRET)
        )

    async def create_order(
        self, amount_inr: float, currency: str = "INR", receipt: str = "", notes: dict = None
    ) -> PaymentOrderResult:
        import asyncio
        client = self._get_client()
        amount_paise = int(amount_inr * 100)

        def _create():
            return client.order.create({
                "amount": amount_paise,
                "currency": currency,
                "receipt": receipt,
                "notes": notes or {},
            })

        result = await asyncio.get_event_loop().run_in_executor(None, _create)
        return PaymentOrderResult(
            order_id=result["id"],
            amount=result["amount"],
            currency=result["currency"],
            receipt=result.get("receipt", ""),
            status=result["status"],
        )

    async def verify_payment(
        self, order_id: str, payment_id: str, signature: str
    ) -> PaymentVerificationResult:
        body = f"{order_id}|{payment_id}"
        expected_signature = hmac.new(
            self._settings.RAZORPAY_KEY_SECRET.encode(),
            body.encode(),
            hashlib.sha256,
        ).hexdigest()

        is_valid = hmac.compare_digest(expected_signature, signature)
        return PaymentVerificationResult(
            is_valid=is_valid,
            payment_id=payment_id,
            order_id=order_id,
            status="captured" if is_valid else "failed",
            error=None if is_valid else "Signature mismatch",
        )

    async def refund(
        self, payment_id: str, amount_inr: float, notes: dict = None
    ) -> RefundResult:
        import asyncio
        client = self._get_client()
        amount_paise = int(amount_inr * 100)

        def _refund():
            return client.payment.refund(payment_id, {
                "amount": amount_paise,
                "speed": "normal",
                "notes": notes or {},
            })

        result = await asyncio.get_event_loop().run_in_executor(None, _refund)
        return RefundResult(
            refund_id=result["id"],
            payment_id=result["payment_id"],
            amount=result["amount"],
            status=result["status"],
        )

    async def get_payment_status(self, payment_id: str) -> dict:
        import asyncio
        client = self._get_client()
        result = await asyncio.get_event_loop().run_in_executor(
            None, lambda: client.payment.fetch(payment_id)
        )
        return result

    async def health_check(self) -> bool:
        try:
            client = self._get_client()
            import asyncio
            await asyncio.get_event_loop().run_in_executor(
                None, lambda: client.order.all({"count": 1})
            )
            return True
        except Exception:
            return False
