
from __future__ import annotations

import hashlib
import hmac
import io
import json
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import qrcode
from qrcode.image.pil import PilImage

from app.core.config import get_settings
from app.core.exceptions import (
    QRAlreadyUsedException,
    QRExpiredException,
    QRInvalidException,
    ReservationNotFoundException,
)
from app.core.logging.logger import get_logger
from app.models.reservation import QRCode, QRStatus, Reservation, ReservationStatus

logger = get_logger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class QRService:
    def __init__(self) -> None:
        self._settings = get_settings()

    def _sign_payload(self, payload: dict) -> str:
        body = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        signature = hmac.new(
            self._settings.SECRET_KEY.encode(),
            body.encode(),
            hashlib.sha256,
        ).hexdigest()
        return signature

    def _build_qr_payload(
        self, reservation_id: str, pharmacy_id: str, expiry_ts: int
    ) -> dict:
        base = {
            "rid": reservation_id,
            "pid": pharmacy_id,
            "exp": expiry_ts,
            "v": 1,
        }
        base["sig"] = self._sign_payload(base)
        return base

    def _verify_qr_payload(self, payload: dict) -> bool:
        sig = payload.pop("sig", None)
        if not sig:
            return False
        expected = self._sign_payload(payload)
        payload["sig"] = sig
        return hmac.compare_digest(expected, sig)

    async def generate_qr(self, reservation: Reservation) -> QRCode:
        if reservation.status not in (
            ReservationStatus.PAID,
            ReservationStatus.READY_FOR_PICKUP,
        ):
            raise ReservationNotFoundException("Reservation is not ready for QR generation.")

        expiry = _utcnow() + timedelta(hours=self._settings.RESERVATION_EXPIRY_HOURS * 4)
        expiry_ts = int(expiry.timestamp())

        payload = self._build_qr_payload(reservation.id, reservation.pharmacy_id, expiry_ts)
        qr_payload_str = json.dumps(payload)

        qr = qrcode.QRCode(
            version=2,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=4,
        )
        qr.add_data(qr_payload_str)
        qr.make(fit=True)
        img: PilImage = qr.make_image(fill_color="black", back_color="white")

        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        qr_bytes = buffer.getvalue()

        from app.providers.storage.local_provider import LocalStorageProvider
        self._storage = LocalStorageProvider()
        upload = await self._storage.upload(
            file_bytes=qr_bytes,
            folder="semenq/qr",
            public_id=f"qr_{reservation.id}",
        )

        qr_record = QRCode(
            reservation_id=reservation.id,
            qr_payload=qr_payload_str,
            qr_image_url=upload.secure_url,
            status=QRStatus.ACTIVE,
            expires_at=expiry,
        )
        await qr_record.insert()

        reservation.qr_code_id = qr_record.id
        reservation.qr_generated = True
        await reservation.save()

        logger.info("QR generated", reservation_id=reservation.id, qr_id=qr_record.id)
        return qr_record

    async def verify_qr(
        self, qr_payload_str: str, scanning_pharmacy_id: str
    ) -> dict:
        try:
            payload = json.loads(qr_payload_str)
        except (json.JSONDecodeError, ValueError):
            raise QRInvalidException("QR payload is malformed.")

        if not self._verify_qr_payload(payload):
            raise QRInvalidException("QR signature verification failed.")

        if payload.get("pid") != scanning_pharmacy_id:
            raise QRInvalidException("QR code does not belong to this pharmacy.")

        expiry_ts = payload.get("exp", 0)
        if int(time.time()) > expiry_ts:
            raise QRExpiredException()

        reservation_id = payload.get("rid")

        reservation = await Reservation.find_one(Reservation.id == reservation_id)
        if not reservation:
            raise ReservationNotFoundException()

        qr_record = await QRCode.find_one(QRCode.reservation_id == reservation_id)
        if qr_record and qr_record.status == QRStatus.USED:
            raise QRAlreadyUsedException()

        if qr_record:
            qr_record.status = QRStatus.USED
            qr_record.scan_count += 1
            qr_record.last_scanned_at = _utcnow()
            qr_record.last_scanned_by = scanning_pharmacy_id
            await qr_record.save()

        return {
            "valid": True,
            "reservation_id": reservation_id,
            "reservation_number": reservation.reservation_number,
            "patient_id": reservation.patient_id,
            "status": reservation.status.value,
            "grand_total": reservation.grand_total,
        }
