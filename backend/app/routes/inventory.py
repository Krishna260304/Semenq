
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.middleware.request_id import REQUEST_ID_CTX
from app.core.responses import APIResponse
from app.dependencies.auth import require_pharmacy
from app.models.user import User
from app.schemas.medicine import InventoryBatchRequest, MedicineInventoryResponse
from app.services.medicine_service import MedicineService

router = APIRouter(prefix="/inventory", tags=["Inventory (Pharmacy)"])
_medicine_service = MedicineService()


@router.post("/{medicine_id}/batches", response_model=APIResponse[MedicineInventoryResponse], summary="Add Batch to Inventory")
async def add_inventory_batch(
    medicine_id: str,
    body: InventoryBatchRequest,
    user: User = Depends(require_pharmacy),
) -> APIResponse:
    from app.repositories.user_repository import PharmacyRepository
    pharmacy = await PharmacyRepository().get_by_user_id(user.id)
    if not pharmacy:
        return APIResponse.error(message="Pharmacy profile not found.")

    inventory, batch = await _medicine_service.add_to_inventory(
        pharmacy_id=pharmacy.id,
        medicine_id=medicine_id,
        batch_data=body.model_dump(),
        performed_by=user.id,
    )

    data = MedicineInventoryResponse(
        id=inventory.id,
        medicine_id=inventory.medicine_id,
        medicine_name=inventory.medicine_name,
        available_quantity=inventory.available_quantity,
        reserved_quantity=inventory.reserved_quantity,
        unit_price=inventory.unit_price,
        mrp=inventory.mrp,
        status=inventory.status.value,
        last_restocked_at=inventory.last_restocked_at,
    )

    return APIResponse.ok(
        data=data,
        message="Batch added to inventory successfully.",
        request_id=REQUEST_ID_CTX.get(""),
    )


@router.get("/expiring", response_model=APIResponse[list[dict]], summary="Get Expiring Batches")
async def get_expiring_batches(
    user: User = Depends(require_pharmacy),
) -> APIResponse:
    from app.repositories.user_repository import PharmacyRepository
    pharmacy = await PharmacyRepository().get_by_user_id(user.id)
    
    batches = await _medicine_service.check_expiring_batches(pharmacy_id=pharmacy.id)
    return APIResponse.ok(data=batches, request_id=REQUEST_ID_CTX.get(""))
