from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query

from app.core.responses import APIResponse
from app.models.notification import Notification
from app.models.order import Order
from app.models.prescription import Prescription
from app.models.reservation import Reservation
from app.models.user import Patient, Pharmacy, User

router = APIRouter(prefix="/users", tags=["Users"])


async def _first_user() -> User | None:
    return await User.find_one(User.is_deleted == False)  # noqa: E712


@router.get("/me", response_model=APIResponse[dict], summary="Get current user profile")
async def get_me() -> APIResponse:
    user = await _first_user()
    if not user:
        return APIResponse.ok(
            data={
                "id": 0,
                "name": "Guest User",
                "email": "guest@semenq.local",
                "phone": "",
                "role": "patient",
                "city": "",
                "state": "",
                "pincode": "",
                "address": "",
                "avatarUrl": None,
                "isVerified": False,
                "createdAt": None,
            },
            message="User profile retrieved.",
        )

    role = user.role.value if hasattr(user.role, "value") else str(user.role)
    patient = await Patient.find_one(Patient.user_id == user.id)
    pharmacy = await Pharmacy.find_one(Pharmacy.user_id == user.id)
    city = pharmacy.city if pharmacy else None
    state = pharmacy.state if pharmacy else None
    pincode = pharmacy.pincode if pharmacy else None
    address = None
    if pharmacy:
        address = ", ".join(part for part in [pharmacy.street, pharmacy.area, pharmacy.city, pharmacy.state, pharmacy.pincode] if part)
    elif patient:
        address = patient.medical_notes or None

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
async def update_me(body: dict[str, Any]) -> APIResponse:
    user = await _first_user()
    if not user:
        return APIResponse.ok(data={}, message="No profile available to update.")

    if name := body.get("name"):
        user.full_name = name
    if phone := body.get("phone"):
        user.phone = phone
    await user.save()
    return await get_me()


@router.get("/me/dashboard", response_model=APIResponse[dict], summary="Get patient dashboard")
async def get_patient_dashboard() -> APIResponse:
    user = await _first_user()
    patient = await Patient.find_one(Patient.user_id == user.id) if user else None
    patient_id = patient.user_id if patient else (user.id if user else None)

    reservations = []
    orders = []
    prescriptions = []
    notifications = []
    if patient_id:
        reservations = await Reservation.find(Reservation.patient_id == patient_id).sort([("created_at", -1)]).limit(5).to_list()
        orders = await Order.find(Order.patient_id == patient_id).sort([("created_at", -1)]).limit(5).to_list()
        prescriptions = await Prescription.find(Prescription.patient_id == patient_id).sort([("created_at", -1)]).limit(5).to_list()
        notifications = await Notification.find(Notification.user_id == patient_id).sort([("created_at", -1)]).limit(5).to_list()

    return APIResponse.ok(
        data={
            "pendingReservations": sum(1 for item in reservations if getattr(item, "status", "") in {"pending", "confirmed"}),
            "activeOrders": sum(1 for item in orders if getattr(item, "status", "") in {"created", "confirmed", "packed", "dispatched", "in_transit", "out_for_delivery"}),
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