from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.responses import APIResponse
from app.dependencies.auth import get_current_active_user
from app.models.user import Address, AddressType, Patient, Pharmacy, User

router = APIRouter(prefix="/users", tags=["Users"])


class AddressCreateRequest(BaseModel):
    address_name: str = "Home"
    street: str
    area: str = ""
    city: str
    state: str
    pincode: str
    landmark: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address_type: str = "home"
    is_default: bool = False


def _serialize_address(addr: Address) -> dict:
    return {
        "id": addr.id,
        "address_name": addr.address_name,
        "street": addr.street,
        "area": addr.area,
        "city": addr.city,
        "state": addr.state,
        "pincode": addr.pincode,
        "landmark": addr.landmark,
        "latitude": addr.latitude,
        "longitude": addr.longitude,
        "address_type": addr.address_type.value if hasattr(addr.address_type, "value") else str(addr.address_type),
        "is_default": addr.is_default,
    }


@router.get("/me", response_model=APIResponse[dict], summary="Get current user profile")
async def get_me(user: User = Depends(get_current_active_user)) -> APIResponse:
    role = user.role.value if hasattr(user.role, "value") else str(user.role)
    patient = await Patient.find_one(Patient.user_id == user.id)
    pharmacy = await Pharmacy.find_one(Pharmacy.user_id == user.id)

    city = None
    state = None
    pincode = None
    address = None

    if pharmacy:
        city = pharmacy.city
        state = pharmacy.state
        pincode = pharmacy.pincode
        address = ", ".join(
            part for part in [pharmacy.street, pharmacy.area, pharmacy.city, pharmacy.state, pharmacy.pincode] if part
        )
    else:
        default_addr = await Address.find_one(
            Address.user_id == user.id, Address.is_default == True
        )
        if not default_addr:
            default_addr = await Address.find_one(Address.user_id == user.id)
        if default_addr:
            city = default_addr.city
            state = default_addr.state
            pincode = default_addr.pincode
            address = ", ".join(
                part
                for part in [
                    default_addr.street,
                    default_addr.area,
                    default_addr.city,
                    default_addr.state,
                    default_addr.pincode,
                ]
                if part
            )

    return APIResponse.ok(
        data={
            "id": user.id,
            "name": user.full_name,
            "email": user.email,
            "phone": user.phone,
            "role": role,
            "city": city,
            "state": state,
            "pincode": pincode,
            "address": address,
            "avatarUrl": user.profile_photo_url,
            "isVerified": user.email_verified,
            "createdAt": user.created_at,
        },
        message="User profile retrieved.",
    )


@router.patch("/me", response_model=APIResponse[dict], summary="Update current user profile")
async def update_me(body: dict[str, Any], user: User = Depends(get_current_active_user)) -> APIResponse:
    if name := body.get("name"):
        user.full_name = name
    if phone := body.get("phone"):
        user.phone = phone
    await user.save()
    return await get_me(user=user)


@router.get("/me/addresses", response_model=APIResponse[list], summary="Get saved addresses")
async def get_addresses(user: User = Depends(get_current_active_user)) -> APIResponse:
    addresses = await Address.find(Address.user_id == user.id).to_list()
    return APIResponse.ok(data=[_serialize_address(a) for a in addresses], message="Addresses retrieved.")


@router.post("/me/addresses", response_model=APIResponse[dict], summary="Add a new address")
async def add_address(body: AddressCreateRequest, user: User = Depends(get_current_active_user)) -> APIResponse:
    if body.is_default:
        existing = await Address.find(Address.user_id == user.id, Address.is_default == True).to_list()
        for addr in existing:
            addr.is_default = False
            await addr.save()

    addr_type = AddressType.HOME
    try:
        addr_type = AddressType(body.address_type.lower())
    except ValueError:
        pass

    addr = Address(
        user_id=user.id,
        address_name=body.address_name,
        street=body.street,
        area=body.area,
        city=body.city,
        state=body.state,
        pincode=body.pincode,
        landmark=body.landmark,
        latitude=body.latitude,
        longitude=body.longitude,
        address_type=addr_type,
        is_default=body.is_default,
    )
    await addr.insert()
    return APIResponse.ok(data=_serialize_address(addr), message="Address saved.")


@router.patch("/me/addresses/{address_id}", response_model=APIResponse[dict], summary="Update an address")
async def update_address(
    address_id: str,
    body: AddressCreateRequest,
    user: User = Depends(get_current_active_user),
) -> APIResponse:
    addr = await Address.find_one(Address.id == address_id, Address.user_id == user.id)
    if not addr:
        raise HTTPException(status_code=404, detail="Address not found.")

    if body.is_default:
        existing = await Address.find(Address.user_id == user.id, Address.is_default == True).to_list()
        for existing_addr in existing:
            existing_addr.is_default = False
            await existing_addr.save()

    addr_type = AddressType.HOME
    try:
        addr_type = AddressType(body.address_type.lower())
    except ValueError:
        pass

    addr.address_name = body.address_name
    addr.street = body.street
    addr.area = body.area
    addr.city = body.city
    addr.state = body.state
    addr.pincode = body.pincode
    addr.landmark = body.landmark
    addr.latitude = body.latitude
    addr.longitude = body.longitude
    addr.address_type = addr_type
    addr.is_default = body.is_default
    await addr.save()
    return APIResponse.ok(data=_serialize_address(addr), message="Address updated.")


@router.delete("/me/addresses/{address_id}", response_model=APIResponse[None], summary="Delete an address")
async def delete_address(address_id: str, user: User = Depends(get_current_active_user)) -> APIResponse:
    addr = await Address.find_one(Address.id == address_id, Address.user_id == user.id)
    if not addr:
        raise HTTPException(status_code=404, detail="Address not found.")
    await addr.delete()
    return APIResponse.ok(message="Address deleted.")


@router.get("/me/dashboard", response_model=APIResponse[dict], summary="Get patient dashboard")
async def get_patient_dashboard(user: User = Depends(get_current_active_user)) -> APIResponse:
    from app.models.notification import Notification
    from app.models.order import Order
    from app.models.prescription import Prescription
    from app.models.reservation import Reservation

    patient = await Patient.find_one(Patient.user_id == user.id)
    patient_id = patient.user_id if patient else user.id

    reservations = await Reservation.find(Reservation.patient_id == patient_id).sort([("created_at", -1)]).limit(5).to_list()
    orders = await Order.find(Order.patient_id == patient_id).sort([("created_at", -1)]).limit(5).to_list()
    prescriptions = await Prescription.find(Prescription.patient_id == patient_id).sort([("created_at", -1)]).limit(5).to_list()
    notifications = await Notification.find(Notification.user_id == patient_id).sort([("created_at", -1)]).limit(5).to_list()

    return APIResponse.ok(
        data={
            "pendingReservations": sum(1 for item in reservations if getattr(item, "status", "") in {"pending", "confirmed"}),
            "activeOrders": sum(
                1
                for item in orders
                if getattr(item, "status", "") in {"created", "confirmed", "packed", "dispatched", "in_transit", "out_for_delivery"}
            ),
            "totalOrders": len(orders),
            "recentPrescriptions": [item.model_dump() for item in prescriptions],
            "upcomingReservations": [item.model_dump() for item in reservations],
            "recentOrders": [item.model_dump() for item in orders],
            "aiRecommendations": [
                {
                    "id": 1,
                    "type": "refill",
                    "title": "Search your next refill",
                    "description": "Use live inventory search to find the nearest pharmacy with stock.",
                    "medicineId": None,
                    "medicineName": None,
                    "actionLabel": "Search Now",
                }
            ],
            "notifications": [item.model_dump() for item in notifications],
        },
        message="Patient dashboard retrieved.",
    )
