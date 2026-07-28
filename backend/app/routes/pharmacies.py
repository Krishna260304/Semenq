from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from app.core.responses import APIResponse
from app.dependencies.auth import require_pharmacy
from app.models.medicine import MedicineInventory
from app.models.user import Pharmacy, User

router = APIRouter(prefix="/pharmacies", tags=["Pharmacies"])


@router.get("", response_model=APIResponse[list[dict]], summary="List pharmacies")
async def list_pharmacies() -> APIResponse:
    pharmacies = await Pharmacy.find(Pharmacy.is_deleted == False).to_list()  # noqa: E712
    return APIResponse.ok(data=[item.model_dump() for item in pharmacies], message="Pharmacies retrieved.")


@router.get("/me/inventory", response_model=APIResponse[list[dict]], summary="Get current pharmacy inventory")
async def get_my_inventory(user: User = Depends(require_pharmacy)) -> APIResponse:
    pharmacy = await Pharmacy.find_one(Pharmacy.user_id == user.id)
    if not pharmacy:
        return APIResponse.ok(data=[], message="No pharmacy profile found.")
    inventory = await MedicineInventory.find(
        MedicineInventory.pharmacy_id == pharmacy.id
    ).sort([("medicine_name", 1)]).to_list()
    return APIResponse.ok(data=[item.model_dump() for item in inventory], message="Inventory retrieved.")


@router.get("/me", response_model=APIResponse[dict], summary="Get current pharmacy profile")
async def get_my_pharmacy_profile(user: User = Depends(require_pharmacy)) -> APIResponse:
    pharmacy = await Pharmacy.find_one(Pharmacy.user_id == user.id)
    profile_complete = pharmacy is not None
    address = ""
    pharmacy_name = ""
    owner_name = user.full_name
    verification_status = "profile_incomplete"
    city = ""
    state = ""
    pincode = ""
    phone = user.phone
    gst_number = ""
    street = ""
    area = ""
    country = "India"
    license_number = ""
    landmark = ""
    latitude = None
    longitude = None
    delivery_radius_km = 5.0
    courier_enabled = False
    home_delivery_enabled = False
    working_hours = None
    alternate_phone = None
    record_id = user.id

    if pharmacy:
        address = ", ".join(
            part
            for part in [
                pharmacy.street,
                pharmacy.area,
                pharmacy.city,
                pharmacy.state,
                pharmacy.pincode,
            ]
            if part
        )
        pharmacy_name = pharmacy.pharmacy_name
        owner_name = pharmacy.owner_name or user.full_name
        verification_status = (
            pharmacy.verification_status.value
            if hasattr(pharmacy.verification_status, "value")
            else str(pharmacy.verification_status)
        )
        city = pharmacy.city
        state = pharmacy.state
        pincode = pharmacy.pincode
        phone = pharmacy.phone or user.phone
        gst_number = pharmacy.gst_number or ""
        street = pharmacy.street
        area = pharmacy.area
        country = pharmacy.country
        license_number = pharmacy.license_number
        landmark = pharmacy.landmark or ""
        latitude = pharmacy.latitude
        longitude = pharmacy.longitude
        delivery_radius_km = pharmacy.delivery_radius_km
        courier_enabled = pharmacy.courier_enabled
        home_delivery_enabled = pharmacy.home_delivery_enabled
        working_hours = pharmacy.working_hours
        alternate_phone = pharmacy.alternate_phone
        record_id = pharmacy.id

    return APIResponse.ok(
        data={
            "id": record_id,
            "userId": pharmacy.user_id if pharmacy else user.id,
            "name": pharmacy_name or owner_name,
            "ownerName": owner_name,
            "pharmacyName": pharmacy_name,
            "email": user.email,
            "phone": phone,
            "licenseNumber": license_number,
            "gstNumber": gst_number,
            "street": street,
            "area": area,
            "city": city,
            "state": state,
            "pincode": pincode,
            "landmark": landmark,
            "address": address,
            "latitude": latitude,
            "longitude": longitude,
            "deliveryRadiusKm": delivery_radius_km,
            "courierEnabled": courier_enabled,
            "homeDeliveryEnabled": home_delivery_enabled,
            "workingHours": working_hours,
            "alternatePhone": alternate_phone,
            "verificationStatus": verification_status,
            "country": country,
            "profilePhotoUrl": user.profile_photo_url,
            "createdAt": pharmacy.created_at if pharmacy else user.created_at,
            "profileComplete": profile_complete,
        },
        message="Pharmacy profile retrieved." if profile_complete else "Pharmacy profile not yet completed. Showing account details.",
    )


@router.patch("/me", response_model=APIResponse[dict], summary="Update current pharmacy profile")
async def update_my_pharmacy_profile(
    body: dict[str, Any],
    user: User = Depends(require_pharmacy),
) -> APIResponse:
    pharmacy = await Pharmacy.find_one(Pharmacy.user_id == user.id)
    if not pharmacy:
        pharmacy = Pharmacy(
            user_id=user.id,
            pharmacy_name=body.get("pharmacy_name") or body.get("pharmacyName") or user.full_name,
            owner_name=body.get("owner_name") or body.get("ownerName") or user.full_name,
            license_number=body.get("license_number") or body.get("licenseNumber") or f"LIC-{user.id[:8]}",
            street=body.get("street") or "",
            city=body.get("city") or "",
            state=body.get("state") or "",
            pincode=body.get("pincode") or "",
        )
        await pharmacy.insert()

    user_updated = False
    if "owner_name" in body or "ownerName" in body:
        val = body.get("owner_name") if "owner_name" in body else body.get("ownerName")
        if val is not None:
            pharmacy.owner_name = val
            user.full_name = val
            user_updated = True

    if "pharmacy_name" in body or "pharmacyName" in body:
        val = body.get("pharmacy_name") if "pharmacy_name" in body else body.get("pharmacyName")
        if val is not None:
            pharmacy.pharmacy_name = val

    if "phone" in body:
        val = body.get("phone")
        if val is not None:
            pharmacy.phone = val
            user.phone = val
            user_updated = True

    if "license_number" in body or "licenseNumber" in body:
        val = body.get("license_number") if "license_number" in body else body.get("licenseNumber")
        if val is not None:
            pharmacy.license_number = val

    if "gst_number" in body or "gstNumber" in body:
        pharmacy.gst_number = body.get("gst_number") if "gst_number" in body else body.get("gstNumber")

    if "street" in body:
        pharmacy.street = body.get("street") or ""

    if "area" in body:
        pharmacy.area = body.get("area") or ""

    if "city" in body:
        pharmacy.city = body.get("city") or ""

    if "state" in body:
        pharmacy.state = body.get("state") or ""

    if "pincode" in body:
        pharmacy.pincode = body.get("pincode") or ""

    if "landmark" in body:
        pharmacy.landmark = body.get("landmark") or ""

    if "latitude" in body:
        pharmacy.latitude = body.get("latitude")

    if "longitude" in body:
        pharmacy.longitude = body.get("longitude")

    if "delivery_radius_km" in body or "deliveryRadiusKm" in body:
        val = body.get("delivery_radius_km") if "delivery_radius_km" in body else body.get("deliveryRadiusKm")
        if val is not None:
            pharmacy.delivery_radius_km = float(val)

    if "home_delivery_enabled" in body or "homeDeliveryEnabled" in body:
        val = body.get("home_delivery_enabled") if "home_delivery_enabled" in body else body.get("homeDeliveryEnabled")
        pharmacy.home_delivery_enabled = bool(val)

    if "courier_enabled" in body or "courierEnabled" in body:
        val = body.get("courier_enabled") if "courier_enabled" in body else body.get("courierEnabled")
        pharmacy.courier_enabled = bool(val)

    if "working_hours" in body or "workingHours" in body:
        val = body.get("working_hours") if "working_hours" in body else body.get("workingHours")
        pharmacy.working_hours = val

    if "alternate_phone" in body or "alternatePhone" in body:
        val = body.get("alternate_phone") if "alternate_phone" in body else body.get("alternatePhone")
        pharmacy.alternate_phone = val

    await pharmacy.save()
    if user_updated:
        await user.save()

    return await get_my_pharmacy_profile(user=user)



@router.get("/{pharmacy_id}", response_model=APIResponse[dict], summary="Get pharmacy")
async def get_pharmacy(pharmacy_id: str) -> APIResponse:
    pharmacy = await Pharmacy.get(pharmacy_id)
    if not pharmacy:
        return APIResponse.ok(data={}, message="Pharmacy not found.")
    return APIResponse.ok(data=pharmacy.model_dump(), message="Pharmacy retrieved.")


@router.get("/{pharmacy_id}/inventory", response_model=APIResponse[list[dict]], summary="Get pharmacy inventory")
async def get_pharmacy_inventory(pharmacy_id: str) -> APIResponse:
    inventory = await MedicineInventory.find(MedicineInventory.pharmacy_id == pharmacy_id).sort([("medicine_name", 1)]).to_list()
    return APIResponse.ok(data=[item.model_dump() for item in inventory], message="Inventory retrieved.")
