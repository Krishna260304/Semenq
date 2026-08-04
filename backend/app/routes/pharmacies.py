from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends

from app.core.database.redis_client import cache_delete, cache_get, cache_set
from app.core.responses import APIResponse
from app.dependencies.auth import require_admin, require_pharmacy
from app.models.medicine import MedicineInventory
from app.models.user import Pharmacy, PharmacyVerificationStatus, User

router = APIRouter(prefix="/pharmacies", tags=["Pharmacies"])

_PROFILE_CACHE_TTL = 300  # 5 minutes


def _safe_serialize(value: Any) -> Any:
    """Recursively make a value JSON-serializable (handles datetime, Beanie IDs, etc.)."""
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: _safe_serialize(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_safe_serialize(v) for v in value]
    return value


def _build_profile_payload(pharmacy: Pharmacy | None, user: User) -> dict:
    """Build the canonical pharmacy profile dict from DB documents."""
    profile_complete = pharmacy is not None

    address = ""
    pharmacy_name = ""
    owner_name = user.full_name
    verification_status = "profile_incomplete"
    city = state = pincode = gst_number = street = area = landmark = ""
    country = "India"
    license_number = ""
    phone = user.phone or ""
    latitude = longitude = None
    delivery_radius_km = 5.0
    courier_enabled = home_delivery_enabled = False
    working_hours = alternate_phone = None
    record_id = user.id

    if pharmacy:
        address = ", ".join(
            part for part in [pharmacy.street, pharmacy.area, pharmacy.city, pharmacy.state, pharmacy.pincode]
            if part
        )
        pharmacy_name = pharmacy.pharmacy_name or ""
        owner_name = pharmacy.owner_name or user.full_name
        verification_status = (
            pharmacy.verification_status.value
            if hasattr(pharmacy.verification_status, "value")
            else str(pharmacy.verification_status)
        )
        city = pharmacy.city or ""
        state = pharmacy.state or ""
        pincode = pharmacy.pincode or ""
        phone = pharmacy.phone or user.phone or ""
        gst_number = pharmacy.gst_number or ""
        street = pharmacy.street or ""
        area = pharmacy.area or ""
        country = pharmacy.country or "India"
        license_number = pharmacy.license_number or ""
        landmark = pharmacy.landmark or ""
        latitude = pharmacy.latitude
        longitude = pharmacy.longitude
        delivery_radius_km = pharmacy.delivery_radius_km
        courier_enabled = pharmacy.courier_enabled
        home_delivery_enabled = pharmacy.home_delivery_enabled
        working_hours = pharmacy.working_hours
        alternate_phone = pharmacy.alternate_phone
        record_id = pharmacy.id

    return _safe_serialize({
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
    })


@router.get("", response_model=APIResponse[list[dict]], summary="List pharmacies")
async def list_pharmacies() -> APIResponse:
    pharmacies = await Pharmacy.find(Pharmacy.is_deleted == False).to_list()  # noqa: E712
    return APIResponse.ok(
        data=[
            {
                "id": item.id,
                "name": item.pharmacy_name,
                "city": item.city,
                "state": item.state,
                "isVerified": item.verification_status == PharmacyVerificationStatus.VERIFIED,
                "verificationStatus": item.verification_status.value,
                "offersCourier": item.courier_enabled,
                "rating": item.average_rating,
                "reviewCount": item.review_count,
                "totalInventory": item.inventory_count,
            }
            for item in pharmacies
        ],
        message="Pharmacies retrieved.",
    )


@router.patch("/{pharmacy_id}/verification", response_model=APIResponse[dict], summary="Review a pharmacy")
async def review_pharmacy(
    pharmacy_id: str,
    body: dict[str, Any],
    _: User = Depends(require_admin),
) -> APIResponse:
    status_value = str(body.get("status", "")).lower()
    allowed = {
        PharmacyVerificationStatus.VERIFIED,
        PharmacyVerificationStatus.REJECTED,
        PharmacyVerificationStatus.UNDER_REVIEW,
    }
    try:
        next_status = PharmacyVerificationStatus(status_value)
    except ValueError:
        next_status = None
    if next_status not in allowed:
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="Invalid pharmacy verification status.")

    pharmacy = await Pharmacy.get(pharmacy_id)
    if not pharmacy or pharmacy.is_deleted:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Pharmacy not found.")
    pharmacy.verification_status = next_status
    pharmacy.verification_date = datetime.now(timezone.utc) if next_status == PharmacyVerificationStatus.VERIFIED else None
    pharmacy.rejection_reason = str(body.get("reason", "")).strip() or None
    await pharmacy.save()
    await cache_delete(f"pharmacy_profile:{pharmacy.user_id}")
    return APIResponse.ok(data={"id": pharmacy.id, "verificationStatus": next_status.value}, message="Pharmacy status updated.")


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
    cache_key = f"pharmacy_profile:{user.id}"

    # Try Redis cache first for fast response
    cached = await cache_get(cache_key)
    if cached:
        try:
            return APIResponse.ok(
                data=json.loads(cached),
                message="Pharmacy profile retrieved.",
            )
        except Exception:
            pass  # Corrupt cache — fall through to DB

    pharmacy = await Pharmacy.find_one(Pharmacy.user_id == user.id)
    payload = _build_profile_payload(pharmacy, user)

    # Write to Redis (best-effort — Redis may not be running in dev)
    try:
        await cache_set(cache_key, json.dumps(payload), ttl=_PROFILE_CACHE_TTL)
    except Exception:
        pass

    message = (
        "Pharmacy profile retrieved."
        if pharmacy is not None
        else "Pharmacy profile not yet completed. Showing account details."
    )
    return APIResponse.ok(data=payload, message=message)


@router.patch("/me", response_model=APIResponse[dict], summary="Update current pharmacy profile")
async def update_my_pharmacy_profile(
    body: dict[str, Any],
    user: User = Depends(require_pharmacy),
) -> APIResponse:
    pharmacy = await Pharmacy.find_one(Pharmacy.user_id == user.id)
    if not pharmacy:
        pharmacy = Pharmacy(
            user_id=user.id,
            pharmacy_name=body.get("pharmacyName") or body.get("pharmacy_name") or user.full_name,
            owner_name=body.get("ownerName") or body.get("owner_name") or user.full_name,
            license_number=body.get("licenseNumber") or body.get("license_number") or f"LIC-{user.id[:8]}",
            street=body.get("street") or "",
            city=body.get("city") or "",
            state=body.get("state") or "",
            pincode=body.get("pincode") or "",
        )
        await pharmacy.insert()

    user_updated = False

    def _pick(d: dict, *keys: str) -> Any:
        for k in keys:
            if k in d:
                return d[k]
        return None

    if (val := _pick(body, "ownerName", "owner_name")) is not None:
        pharmacy.owner_name = val
        user.full_name = val
        user_updated = True

    if (val := _pick(body, "pharmacyName", "pharmacy_name")) is not None:
        pharmacy.pharmacy_name = val

    if (val := _pick(body, "phone")) is not None:
        pharmacy.phone = val
        user.phone = val
        user_updated = True

    if (val := _pick(body, "licenseNumber", "license_number")) is not None:
        pharmacy.license_number = val

    if (val := _pick(body, "gstNumber", "gst_number")) is not None:
        pharmacy.gst_number = val

    for field in ("street", "area", "city", "state", "pincode", "landmark"):
        if field in body:
            setattr(pharmacy, field, body[field] or "")

    if (val := _pick(body, "latitude")) is not None:
        pharmacy.latitude = val

    if (val := _pick(body, "longitude")) is not None:
        pharmacy.longitude = val

    if (val := _pick(body, "deliveryRadiusKm", "delivery_radius_km")) is not None:
        pharmacy.delivery_radius_km = float(val)

    if (val := _pick(body, "homeDeliveryEnabled", "home_delivery_enabled")) is not None:
        pharmacy.home_delivery_enabled = bool(val)

    if (val := _pick(body, "courierEnabled", "courier_enabled")) is not None:
        pharmacy.courier_enabled = bool(val)

    if (val := _pick(body, "workingHours", "working_hours")) is not None:
        pharmacy.working_hours = val

    if (val := _pick(body, "alternatePhone", "alternate_phone")) is not None:
        pharmacy.alternate_phone = val

    await pharmacy.save()
    if user_updated:
        await user.save()

    # Invalidate and repopulate cache
    cache_key = f"pharmacy_profile:{user.id}"
    await cache_delete(cache_key)
    payload = _build_profile_payload(pharmacy, user)
    try:
        await cache_set(cache_key, json.dumps(payload), ttl=_PROFILE_CACHE_TTL)
    except Exception:
        pass

    return APIResponse.ok(data=payload, message="Pharmacy profile updated.")


@router.get("/{pharmacy_id}", response_model=APIResponse[dict], summary="Get pharmacy")
async def get_pharmacy(pharmacy_id: str) -> APIResponse:
    pharmacy = await Pharmacy.get(pharmacy_id)
    if not pharmacy:
        return APIResponse.ok(data={}, message="Pharmacy not found.")
    return APIResponse.ok(data=pharmacy.model_dump(), message="Pharmacy retrieved.")


@router.get("/{pharmacy_id}/inventory", response_model=APIResponse[list[dict]], summary="Get pharmacy inventory")
async def get_pharmacy_inventory(pharmacy_id: str) -> APIResponse:
    inventory = await MedicineInventory.find(
        MedicineInventory.pharmacy_id == pharmacy_id
    ).sort([("medicine_name", 1)]).to_list()
    return APIResponse.ok(data=[item.model_dump() for item in inventory], message="Inventory retrieved.")
