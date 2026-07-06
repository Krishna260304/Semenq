
from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

from app.core.database.redis_client import cache_delete_pattern, cache_get, cache_set
from app.core.exceptions import (
    ConflictException,
    DuplicateBatchException,
    ExpiredMedicineException,
    InsufficientStockException,
    MedicineNotFoundException,
    NotFoundException,
)
from app.core.logging.logger import get_logger
from app.models.medicine import (
    AlertPriority,
    AlertType,
    BatchStatus,
    FavoriteMedicine,
    InventoryAlert,
    InventoryBatch,
    InventoryStatus,
    InventoryTransaction,
    Medicine,
    MedicineCategory,
    MedicineInventory,
    TransactionType,
)
from app.repositories.medicine_repository import (
    FavoriteMedicineRepository,
    InventoryAlertRepository,
    InventoryBatchRepository,
    InventoryTransactionRepository,
    MedicineCategoryRepository,
    MedicineInventoryRepository,
    MedicineRepository,
)

logger = get_logger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _slugify(text: str) -> str:
    return re.sub(r"[^\w-]", "", re.sub(r"\s+", "-", text.lower().strip()))


def _build_search_keywords(medicine: Medicine) -> list[str]:
    raw = " ".join(filter(None, [
        medicine.name,
        medicine.generic_name,
        medicine.brand_name,
        medicine.composition,
        medicine.manufacturer,
        medicine.category_name,
    ]))
    words = {w.lower() for w in re.split(r"[\s,+\-/]+", raw) if len(w) > 2}
    return sorted(words)


class MedicineService:
    def __init__(self) -> None:
        self._medicines = MedicineRepository()
        self._categories = MedicineCategoryRepository()
        self._inventory = MedicineInventoryRepository()
        self._batches = InventoryBatchRepository()
        self._transactions = InventoryTransactionRepository()
        self._alerts = InventoryAlertRepository()
        self._favorites = FavoriteMedicineRepository()


    async def create_medicine(self, data: dict, created_by: str) -> Medicine:
        existing = await self._medicines.get_by_name_exact(data.get("name", ""))
        if existing:
            raise ConflictException(f"Medicine '{data['name']}' already exists.")

        medicine = Medicine(**data, created_by=created_by)
        medicine.search_keywords = _build_search_keywords(medicine)
        await medicine.insert()

        await cache_delete_pattern("medicine:list:*")
        logger.info("Medicine created", medicine_id=medicine.id, name=medicine.name)
        return medicine

    async def update_medicine(self, medicine_id: str, data: dict, updated_by: str) -> Medicine:
        medicine = await self._medicines.get_by_id_or_raise(medicine_id)
        for key, value in data.items():
            if hasattr(medicine, key) and value is not None:
                setattr(medicine, key, value)
        medicine.search_keywords = _build_search_keywords(medicine)
        await self._medicines.update(medicine, updated_by=updated_by)
        await cache_delete_pattern(f"medicine:{medicine_id}:*")
        return medicine

    async def search_medicines(
        self,
        query: str,
        category_id: Optional[str] = None,
        prescription_required: Optional[bool] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Medicine], int]:
        skip = (page - 1) * page_size
        return await self._medicines.search(
            query=query,
            category_id=category_id,
            prescription_required=prescription_required,
            skip=skip,
            limit=page_size,
        )

    async def get_medicine_with_availability(self, medicine_id: str) -> dict:
        cache_key = f"medicine:{medicine_id}:availability"
        cached = await cache_get(cache_key)
        if cached:
            return json.loads(cached)

        medicine = await self._medicines.get_by_id_or_raise(medicine_id)
        inventories = await self._inventory.find_pharmacies_with_stock(medicine_id)

        result = {
            "medicine": medicine.model_dump(),
            "available_pharmacies": len(inventories),
            "inventory_summary": [
                {
                    "pharmacy_id": inv.pharmacy_id,
                    "available_quantity": inv.net_available,
                    "unit_price": inv.unit_price,
                    "status": inv.status.value,
                }
                for inv in inventories
            ],
        }
        await cache_set(cache_key, json.dumps(result, default=str), ttl=300)
        return result


    async def create_category(self, data: dict, created_by: str) -> MedicineCategory:
        slug = _slugify(data.get("name", ""))
        existing = await self._categories.get_by_slug(slug)
        if existing:
            raise ConflictException(f"Category '{slug}' already exists.")
        category = MedicineCategory(**data, slug=slug, created_by=created_by)
        await category.insert()
        await cache_delete_pattern("medicine:categories:*")
        return category

    async def get_categories(self) -> list[MedicineCategory]:
        cache_key = "medicine:categories:root"
        cached = await cache_get(cache_key)
        if cached:
            return [MedicineCategory(**c) for c in json.loads(cached)]
        categories = await self._categories.get_root_categories()
        await cache_set(cache_key, json.dumps([c.model_dump() for c in categories], default=str))
        return categories


    async def add_to_inventory(
        self,
        pharmacy_id: str,
        medicine_id: str,
        batch_data: dict,
        performed_by: str,
    ) -> tuple[MedicineInventory, InventoryBatch]:
        medicine = await self._medicines.get_by_id_or_raise(medicine_id)

        existing_batch = await InventoryBatch.find_one(
            InventoryBatch.pharmacy_id == pharmacy_id,
            InventoryBatch.batch_number == batch_data.get("batch_number", ""),
        )
        if existing_batch:
            raise DuplicateBatchException()

        expiry = batch_data.get("expiry_date")
        if expiry and expiry <= _utcnow():
            raise ExpiredMedicineException("Cannot add an already expired batch.")

        inventory = await self._inventory.get_by_pharmacy_medicine(pharmacy_id, medicine_id)
        if not inventory:
            inventory = MedicineInventory(
                pharmacy_id=pharmacy_id,
                medicine_id=medicine_id,
                medicine_name=medicine.name,
                medicine_generic_name=medicine.generic_name,
                medicine_composition=medicine.composition,
                created_by=performed_by,
            )
            await inventory.insert()

        quantity = batch_data.get("quantity", 0)
        batch = InventoryBatch(
            pharmacy_id=pharmacy_id,
            medicine_id=medicine_id,
            inventory_id=inventory.id,
            created_by=performed_by,
            **batch_data,
        )
        await batch.insert()

        qty_before = inventory.available_quantity
        inventory.available_quantity += quantity
        inventory.current_batch_id = batch.id
        inventory.last_restocked_at = _utcnow()
        inventory.status = self._compute_inventory_status(inventory)
        await inventory.save()

        await self._record_transaction(
            pharmacy_id=pharmacy_id,
            medicine_id=medicine_id,
            inventory_id=inventory.id,
            batch_id=batch.id,
            transaction_type=TransactionType.PURCHASE,
            quantity=quantity,
            qty_before=qty_before,
            qty_after=inventory.available_quantity,
            performed_by=performed_by,
        )

        await cache_delete_pattern(f"medicine:{medicine_id}:*")
        return inventory, batch

    async def reserve_stock(
        self,
        pharmacy_id: str,
        medicine_id: str,
        quantity: int,
        reservation_id: str,
        performed_by: str,
    ) -> MedicineInventory:
        inventory = await self._inventory.get_by_pharmacy_medicine(pharmacy_id, medicine_id)
        if inventory is None:
            raise MedicineNotFoundException(f"Medicine {medicine_id} not in pharmacy {pharmacy_id}.")

        if inventory.net_available < quantity:
            raise InsufficientStockException(
                f"Only {inventory.net_available} units available, requested {quantity}."
            )

        success = await self._inventory.atomic_reserve_stock(inventory.id, quantity)
        if not success:
            raise InsufficientStockException("Stock reservation failed. Please try again.")

        qty_before = inventory.available_quantity
        await self._record_transaction(
            pharmacy_id=pharmacy_id,
            medicine_id=medicine_id,
            inventory_id=inventory.id,
            transaction_type=TransactionType.RESERVATION,
            quantity=quantity,
            qty_before=qty_before,
            qty_after=qty_before - quantity,
            reference_id=reservation_id,
            reference_type="reservation",
            performed_by=performed_by,
        )

        return await self._inventory.get_by_id_or_raise(inventory.id)

    async def release_stock(
        self,
        pharmacy_id: str,
        medicine_id: str,
        quantity: int,
        reference_id: str,
        performed_by: str,
    ) -> None:
        inventory = await self._inventory.get_by_pharmacy_medicine(pharmacy_id, medicine_id)
        if inventory is None:
            return

        await self._inventory.release_reservation(inventory.id, quantity)
        await self._record_transaction(
            pharmacy_id=pharmacy_id,
            medicine_id=medicine_id,
            inventory_id=inventory.id,
            transaction_type=TransactionType.RESERVATION_RELEASE,
            quantity=quantity,
            qty_before=inventory.available_quantity,
            qty_after=inventory.available_quantity + quantity,
            reference_id=reference_id,
            reference_type="reservation",
            performed_by=performed_by,
        )

        refreshed = await self._inventory.get_by_id_or_raise(inventory.id)
        await self._check_and_generate_alerts(refreshed)

    async def confirm_sale(
        self,
        pharmacy_id: str,
        medicine_id: str,
        quantity: int,
        reservation_id: str,
        performed_by: str,
    ) -> None:
        inventory = await self._inventory.get_by_pharmacy_medicine(pharmacy_id, medicine_id)
        if inventory is None:
            return
        await self._inventory.confirm_sale(inventory.id, quantity)
        inventory.last_sold_at = _utcnow()
        await self._record_transaction(
            pharmacy_id=pharmacy_id,
            medicine_id=medicine_id,
            inventory_id=inventory.id,
            transaction_type=TransactionType.SALE,
            quantity=quantity,
            qty_before=inventory.reserved_quantity,
            qty_after=inventory.reserved_quantity - quantity,
            reference_id=reservation_id,
            reference_type="reservation",
            performed_by=performed_by,
        )


    async def check_expiring_batches(self, pharmacy_id: Optional[str] = None) -> list[dict]:
        batches = await self._batches.get_expiring_soon(days=30)
        if pharmacy_id:
            batches = [b for b in batches if b.pharmacy_id == pharmacy_id]

        results = []
        for batch in batches:
            days_left = (batch.expiry_date - _utcnow()).days
            priority = (
                AlertPriority.CRITICAL if days_left <= 7
                else AlertPriority.HIGH if days_left <= 15
                else AlertPriority.MEDIUM
            )
            results.append({
                "batch_id": batch.id,
                "medicine_id": batch.medicine_id,
                "pharmacy_id": batch.pharmacy_id,
                "batch_number": batch.batch_number,
                "expiry_date": batch.expiry_date,
                "remaining_quantity": batch.remaining_quantity,
                "days_until_expiry": days_left,
                "priority": priority.value,
            })
        return results


    async def add_favorite(self, patient_id: str, medicine_id: str) -> FavoriteMedicine:
        existing = await self._favorites.get_favorite(patient_id, medicine_id)
        if existing:
            return existing
        medicine = await self._medicines.get_by_id_or_raise(medicine_id)
        fav = FavoriteMedicine(
            patient_id=patient_id,
            medicine_id=medicine_id,
            medicine_name=medicine.name,
        )
        await fav.insert()
        return fav

    async def remove_favorite(self, patient_id: str, medicine_id: str) -> None:
        fav = await self._favorites.get_favorite(patient_id, medicine_id)
        if fav:
            await fav.soft_delete(deleted_by=patient_id)

    async def get_favorites(self, patient_id: str) -> list[FavoriteMedicine]:
        return await self._favorites.get_patient_favorites(patient_id)


    @staticmethod
    def _compute_inventory_status(inventory: MedicineInventory) -> InventoryStatus:
        net = inventory.net_available
        if net <= 0:
            return InventoryStatus.OUT_OF_STOCK
        if net <= inventory.reorder_level:
            return InventoryStatus.LOW_STOCK
        return InventoryStatus.IN_STOCK

    async def _record_transaction(
        self,
        pharmacy_id: str,
        medicine_id: str,
        inventory_id: str,
        transaction_type: TransactionType,
        quantity: int,
        qty_before: int,
        qty_after: int,
        performed_by: str = "",
        reference_id: Optional[str] = None,
        reference_type: Optional[str] = None,
        batch_id: Optional[str] = None,
        reason: str = "",
    ) -> InventoryTransaction:
        tx = InventoryTransaction(
            pharmacy_id=pharmacy_id,
            medicine_id=medicine_id,
            inventory_id=inventory_id,
            batch_id=batch_id,
            transaction_type=transaction_type,
            quantity=quantity,
            quantity_before=qty_before,
            quantity_after=qty_after,
            reference_id=reference_id,
            reference_type=reference_type,
            performed_by=performed_by,
            reason=reason,
        )
        await tx.insert()
        return tx

    async def _check_and_generate_alerts(self, inventory: MedicineInventory) -> None:
        net = inventory.net_available
        if net <= 0:
            await self._upsert_alert(
                inventory, AlertType.OUT_OF_STOCK, AlertPriority.CRITICAL,
                f"{inventory.medicine_name} is out of stock."
            )
        elif net <= inventory.reorder_level:
            await self._upsert_alert(
                inventory, AlertType.LOW_STOCK, AlertPriority.HIGH,
                f"{inventory.medicine_name} is below reorder level ({net} remaining)."
            )

    async def _upsert_alert(
        self,
        inventory: MedicineInventory,
        alert_type: AlertType,
        priority: AlertPriority,
        message: str,
    ) -> None:
        existing = await InventoryAlert.find_one(
            InventoryAlert.inventory_id == inventory.id,
            InventoryAlert.alert_type == alert_type,
            InventoryAlert.resolved == False,
        )
        if existing:
            return
        alert = InventoryAlert(
            pharmacy_id=inventory.pharmacy_id,
            medicine_id=inventory.medicine_id,
            inventory_id=inventory.id,
            alert_type=alert_type,
            priority=priority,
            message=message,
            current_quantity=inventory.net_available,
            threshold=inventory.reorder_level,
        )
        await alert.insert()
