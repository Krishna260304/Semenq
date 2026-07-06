from __future__ import annotations

from fastapi import APIRouter

from app.core.responses import APIResponse
from app.models.medicine import MedicineInventory
from app.models.user import Pharmacy

router = APIRouter(prefix="/pharmacies", tags=["Pharmacies"])


@router.get("", response_model=APIResponse[list[dict]], summary="List pharmacies")
async def list_pharmacies() -> APIResponse:
    pharmacies = await Pharmacy.find(Pharmacy.is_deleted == False).to_list()  # noqa: E712
    return APIResponse.ok(data=[item.model_dump() for item in pharmacies], message="Pharmacies retrieved.")


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