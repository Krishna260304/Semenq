
from __future__ import annotations

import io
from datetime import datetime, timezone
from typing import Optional

from app.core.exceptions import CourierException, OrderNotFoundException
from app.core.logging.logger import get_logger
from app.models.order import CourierShipment, CourierTracking, Order, OrderStatus, Receipt, TrackingEventType
from app.models.reservation import Reservation, ReservationStatus
from app.providers.courier.shiprocket_provider import ShiprocketProvider
from app.services.reservation_service import ReservationService

logger = get_logger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _generate_order_number(reservation_number: str) -> str:
    return reservation_number.replace("SEM", "ORD")


def _generate_invoice_number(reservation_number: str) -> str:
    return reservation_number.replace("SEM", "INV")


class OrderService:
    def __init__(self) -> None:
        self._courier_provider = ShiprocketProvider()
        self._reservation_service = ReservationService()

    async def create_order_from_reservation(self, reservation_id: str) -> Order:
        reservation = await Reservation.find_one(Reservation.id == reservation_id)
        if not reservation or reservation.status != ReservationStatus.PAID:
            raise OrderNotFoundException("Reservation not paid.")

        existing_order = await Order.find_one(Order.reservation_id == reservation_id)
        if existing_order:
            return existing_order

        receipt = await self._generate_receipt(reservation)

        order = Order(
            order_number=_generate_order_number(reservation.reservation_number),
            reservation_id=reservation.id,
            patient_id=reservation.patient_id,
            pharmacy_id=reservation.pharmacy_id,
            payment_id=reservation.payment_id,
            receipt_id=receipt.id,
            status=OrderStatus.CREATED,
            pharmacy_name=reservation.pharmacy_name,
            total_amount=reservation.grand_total,
        )
        await order.insert()
        return order

    async def _generate_receipt(self, reservation: Reservation) -> Receipt:
        from app.models.user import Patient, Pharmacy, User
        patient_user = await User.find_one(User.id == reservation.patient_id)
        pharmacy = await Pharmacy.find_one(Pharmacy.id == reservation.pharmacy_id)
        
        items = []
        from app.models.reservation import ReservationItem
        res_items = await ReservationItem.find(ReservationItem.reservation_id == reservation.id).to_list()
        for i in res_items:
            items.append({
                "medicine_name": i.medicine_name,
                "quantity": i.reserved_quantity,
                "unit_price": i.unit_price,
                "total": i.total_price,
            })

        receipt = Receipt(
            invoice_number=_generate_invoice_number(reservation.reservation_number),
            reservation_id=reservation.id,
            payment_id=reservation.payment_id,
            patient_id=reservation.patient_id,
            pharmacy_id=reservation.pharmacy_id,
            patient_name=patient_user.full_name if patient_user else "Unknown",
            patient_phone=patient_user.phone if patient_user else "",
            pharmacy_name=pharmacy.pharmacy_name if pharmacy else reservation.pharmacy_name,
            pharmacy_address=f"{pharmacy.street}, {pharmacy.city}" if pharmacy else reservation.pharmacy_address,
            pharmacy_license=pharmacy.license_number if pharmacy else "",
            items=items,
            subtotal=reservation.subtotal,
            reservation_fee=reservation.reservation_fee,
            platform_fee=reservation.platform_fee,
            courier_fee=reservation.courier_fee,
            taxes=reservation.taxes,
            grand_total=reservation.grand_total,
        )
        await receipt.insert()
        return receipt

    async def request_courier(self, order_id: str) -> CourierShipment:
        order = await Order.find_one(Order.id == order_id)
        if not order:
            raise OrderNotFoundException()
        reservation = await Reservation.find_one(Reservation.id == order.reservation_id)
        if not reservation or reservation.pickup_method != "courier":
            raise CourierException("Reservation is not set for courier pickup.")

        payload = {
            "order_id": order.order_number,
            "order_date": _utcnow().strftime("%Y-%m-%d %H:%M"),
            "pickup_location": "Primary",
            "billing_customer_name": order.patient_name,
            "billing_last_name": "",
            "billing_address": "Customer Address Line 1",
            "billing_city": "Customer City",
            "billing_pincode": "110001",
            "billing_state": "Delhi",
            "billing_country": "India",
            "billing_email": "customer@example.com",
            "billing_phone": "9876543210",
            "shipping_is_billing": True,
            "order_items": [{"name": "Medicines", "sku": "MED", "units": 1, "selling_price": str(order.total_amount)}],
            "payment_method": "Prepaid",
            "sub_total": order.total_amount,
            "length": 10,
            "breadth": 10,
            "height": 10,
            "weight": 0.5,
        }

        try:
            result = await self._courier_provider.create_shipment(payload)
        except Exception as exc:
            logger.error("Courier request failed", error=str(exc))
            raise CourierException("Failed to request courier from provider.")

        shipment = CourierShipment(
            reservation_id=reservation.id,
            order_id=order.id,
            provider_shipment_id=result.shipment_id,
            tracking_number=result.awb_code,
            awb_code=result.awb_code,
            current_status="booked",
            charges=result.charges,
        )
        await shipment.insert()

        order.shipment_id = shipment.id
        await order.save()

        await self._reservation_service.transition_state(
            reservation_id=reservation.id,
            new_status=ReservationStatus.COURIER_ASSIGNED,
            changed_by="system",
        )

        return shipment

    async def update_tracking(self, awb_code: str) -> Optional[CourierTracking]:
        shipment = await CourierShipment.find_one(CourierShipment.awb_code == awb_code)
        if not shipment:
            return None

        result = await self._courier_provider.track_shipment(awb_code)
        
        latest_event = result.events[-1] if result.events else None
        if not latest_event:
            return None

        mapped_event_type = TrackingEventType.IN_TRANSIT
        if "pick" in latest_event.status.lower():
            mapped_event_type = TrackingEventType.PICKED_UP
        elif "out for delivery" in latest_event.status.lower():
            mapped_event_type = TrackingEventType.OUT_FOR_DELIVERY
        elif "delivered" in latest_event.status.lower():
            mapped_event_type = TrackingEventType.DELIVERED
        
        tracking = CourierTracking(
            shipment_id=shipment.id,
            reservation_id=shipment.reservation_id,
            event_type=mapped_event_type,
            event_description=latest_event.description,
            location=latest_event.location,
            raw_data={"status": latest_event.status, "timestamp": latest_event.timestamp},
        )
        await tracking.insert()

        shipment.current_status = result.current_status
        if mapped_event_type == TrackingEventType.DELIVERED:
            shipment.delivered_at = _utcnow()
            order = await Order.find_one(Order.id == shipment.order_id)
            if order:
                order.status = OrderStatus.DELIVERED
                order.delivered_at = _utcnow()
                await order.save()
            await self._reservation_service.transition_state(
                reservation_id=shipment.reservation_id,
                new_status=ReservationStatus.COMPLETED,
                changed_by="courier",
                reason="Package delivered",
            )
        await shipment.save()
        
        return tracking
