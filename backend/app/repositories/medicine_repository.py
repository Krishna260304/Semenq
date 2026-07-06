
from __future__ import annotations

from typing import Optional

from app.models.medicine import (
    FavoriteMedicine,
    InventoryAlert,
    InventoryBatch,
    InventoryTransaction,
    Medicine,
    MedicineCategory,
    MedicineBrand,
    MedicineInventory,
    MedicineSearchHistory,
    InventoryStatus,
    BatchStatus,
    TransactionType,
)
from app.repositories.base import BaseRepository


class MedicineRepository(BaseRepository[Medicine]):
    def __init__(self) -> None:
        super().__init__(Medicine)

    async def search(
        self,
        query: str,
        category_id: Optional[str] = None,
        prescription_required: Optional[bool] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[list[Medicine], int]:
        filters: dict = {"is_deleted": False, "status": "active"}
        if query:
            filters["$text"] = {"$search": query}
        if category_id:
            filters["category_id"] = category_id
        if prescription_required is not None:
            filters["prescription_required"] = prescription_required

        results = await Medicine.find(filters).skip(skip).limit(limit).to_list()
        total = await Medicine.find(filters).count()
        return results, total

    async def get_by_barcode(self, barcode: str) -> Optional[Medicine]:
        return await Medicine.find_one(Medicine.barcode == barcode, Medicine.is_deleted == False)

    async def get_by_name_exact(self, name: str) -> Optional[Medicine]:
        return await Medicine.find_one(Medicine.name == name.strip(), Medicine.is_deleted == False)


class MedicineCategoryRepository(BaseRepository[MedicineCategory]):
    def __init__(self) -> None:
        super().__init__(MedicineCategory)

    async def get_by_slug(self, slug: str) -> Optional[MedicineCategory]:
        return await MedicineCategory.find_one(MedicineCategory.slug == slug)

    async def get_root_categories(self) -> list[MedicineCategory]:
        return await MedicineCategory.find(
            MedicineCategory.parent_category_id == None,
            MedicineCategory.is_active == True,
        ).sort([("display_order", 1)]).to_list()


class MedicineBrandRepository(BaseRepository[MedicineBrand]):
    def __init__(self) -> None:
        super().__init__(MedicineBrand)


class MedicineInventoryRepository(BaseRepository[MedicineInventory]):
    def __init__(self) -> None:
        super().__init__(MedicineInventory)

    async def get_by_pharmacy_medicine(
        self, pharmacy_id: str, medicine_id: str
    ) -> Optional[MedicineInventory]:
        return await MedicineInventory.find_one(
            MedicineInventory.pharmacy_id == pharmacy_id,
            MedicineInventory.medicine_id == medicine_id,
            MedicineInventory.is_deleted == False,
        )

    async def get_pharmacy_inventory(
        self,
        pharmacy_id: str,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[MedicineInventory], int]:
        filters: dict = {"pharmacy_id": pharmacy_id, "is_deleted": False}
        if status:
            filters["status"] = status
        items = await MedicineInventory.find(filters).skip(skip).limit(limit).to_list()
        total = await MedicineInventory.find(filters).count()
        return items, total

    async def find_pharmacies_with_stock(
        self, medicine_id: str, min_quantity: int = 1
    ) -> list[MedicineInventory]:
        return await MedicineInventory.find(
            MedicineInventory.medicine_id == medicine_id,
            MedicineInventory.available_quantity >= min_quantity,
            MedicineInventory.is_deleted == False,
        ).to_list()

    async def atomic_reserve_stock(
        self, inventory_id: str, quantity: int
    ) -> bool:
        result = await MedicineInventory.get_motor_collection().update_one(
            {
                "_id": inventory_id,
                "available_quantity": {"$gte": quantity},
                "is_deleted": False,
            },
            {
                "$inc": {
                    "available_quantity": -quantity,
                    "reserved_quantity": quantity,
                }
            },
        )
        return result.modified_count == 1

    async def release_reservation(self, inventory_id: str, quantity: int) -> None:
        await MedicineInventory.get_motor_collection().update_one(
            {"_id": inventory_id},
            {"$inc": {"available_quantity": quantity, "reserved_quantity": -quantity}},
        )

    async def confirm_sale(self, inventory_id: str, quantity: int) -> None:
        await MedicineInventory.get_motor_collection().update_one(
            {"_id": inventory_id},
            {"$inc": {"reserved_quantity": -quantity, "sold_quantity": quantity}},
        )


class InventoryBatchRepository(BaseRepository[InventoryBatch]):
    def __init__(self) -> None:
        super().__init__(InventoryBatch)

    async def get_active_batches(
        self, pharmacy_id: str, medicine_id: str
    ) -> list[InventoryBatch]:
        return await InventoryBatch.find(
            InventoryBatch.pharmacy_id == pharmacy_id,
            InventoryBatch.medicine_id == medicine_id,
            InventoryBatch.status == BatchStatus.ACTIVE,
            InventoryBatch.remaining_quantity > 0,
            InventoryBatch.is_deleted == False,
        ).sort([("expiry_date", 1)]).to_list()

    async def get_expiring_soon(self, days: int = 30) -> list[InventoryBatch]:
        from datetime import datetime, timezone, timedelta
        threshold = datetime.now(timezone.utc) + timedelta(days=days)
        return await InventoryBatch.find(
            InventoryBatch.expiry_date <= threshold,
            InventoryBatch.expiry_date > datetime.now(timezone.utc),
            InventoryBatch.status == BatchStatus.ACTIVE,
            InventoryBatch.is_deleted == False,
        ).to_list()


class InventoryTransactionRepository(BaseRepository[InventoryTransaction]):
    def __init__(self) -> None:
        super().__init__(InventoryTransaction)

    async def get_history(
        self,
        pharmacy_id: str,
        medicine_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[InventoryTransaction], int]:
        filters: dict = {"pharmacy_id": pharmacy_id}
        if medicine_id:
            filters["medicine_id"] = medicine_id
        items = await InventoryTransaction.find(filters).sort(
            [("timestamp", -1)]
        ).skip(skip).limit(limit).to_list()
        total = await InventoryTransaction.find(filters).count()
        return items, total


class InventoryAlertRepository(BaseRepository[InventoryAlert]):
    def __init__(self) -> None:
        super().__init__(InventoryAlert)

    async def get_unresolved(self, pharmacy_id: str) -> list[InventoryAlert]:
        return await InventoryAlert.find(
            InventoryAlert.pharmacy_id == pharmacy_id,
            InventoryAlert.resolved == False,
        ).sort([("priority", -1), ("generated_at", -1)]).to_list()


class FavoriteMedicineRepository(BaseRepository[FavoriteMedicine]):
    def __init__(self) -> None:
        super().__init__(FavoriteMedicine)

    async def get_patient_favorites(self, patient_id: str) -> list[FavoriteMedicine]:
        return await FavoriteMedicine.find(
            FavoriteMedicine.patient_id == patient_id,
            FavoriteMedicine.is_deleted == False,
        ).sort([("added_at", -1)]).to_list()

    async def get_favorite(self, patient_id: str, medicine_id: str) -> Optional[FavoriteMedicine]:
        return await FavoriteMedicine.find_one(
            FavoriteMedicine.patient_id == patient_id,
            FavoriteMedicine.medicine_id == medicine_id,
            FavoriteMedicine.is_deleted == False,
        )
