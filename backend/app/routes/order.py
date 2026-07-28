
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.middleware.request_id import REQUEST_ID_CTX
from app.core.responses import APIResponse
from app.dependencies.auth import require_patient, require_pharmacy_or_admin
from app.models.user import User
from app.models.order import Order
from app.services.order_service import OrderService

router = APIRouter(prefix="/orders", tags=["Orders & Courier"])
_order_service = OrderService()


@router.get("", response_model=APIResponse[list[dict]], summary="List orders")
async def list_orders() -> APIResponse:
    items = await Order.find(Order.is_deleted == False).sort([("created_at", -1)]).limit(100).to_list()  # noqa: E712
    return APIResponse.ok(data=[item.model_dump() for item in items], request_id=REQUEST_ID_CTX.get(""))


@router.get("/{order_id}", response_model=APIResponse[dict], summary="Get order")
async def get_order(order_id: str) -> APIResponse:
    order = await Order.get(order_id)
    if not order:
        return APIResponse.ok(data={}, message="Order not found.")
    return APIResponse.ok(data=order.model_dump(), request_id=REQUEST_ID_CTX.get(""))


@router.post("/{order_id}/courier", response_model=APIResponse[dict], summary="Request Courier Pickup")
async def request_courier(
    order_id: str,
    user: User = Depends(require_pharmacy_or_admin),
) -> APIResponse:
    shipment = await _order_service.request_courier(order_id)
    return APIResponse.ok(
        data={
            "shipment_id": shipment.id,
            "tracking_number": shipment.tracking_number,
            "status": shipment.current_status,
        },
        message="Courier pickup requested successfully.",
        request_id=REQUEST_ID_CTX.get(""),
    )


@router.post("/track/{awb_code}", response_model=APIResponse[dict], summary="Update Tracking Information")
async def update_tracking(
    awb_code: str,
    user: User = Depends(require_patient),
) -> APIResponse:
    tracking = await _order_service.update_tracking(awb_code)
    if not tracking:
        return APIResponse.error(message="Shipment not found or no tracking updates.")
    
    return APIResponse.ok(
        data={
            "event": tracking.event_type.value,
            "description": tracking.event_description,
            "location": tracking.location,
            "timestamp": tracking.event_timestamp,
        },
        message="Tracking updated.",
        request_id=REQUEST_ID_CTX.get(""),
    )
