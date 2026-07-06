
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from beanie import Indexed
from pydantic import Field

from app.models.base import BaseDocument, _utcnow


class DosageForm(str, Enum):
    TABLET = "tablet"
    CAPSULE = "capsule"
    SYRUP = "syrup"
    INJECTION = "injection"
    CREAM = "cream"
    OINTMENT = "ointment"
    DROPS = "drops"
    INHALER = "inhaler"
    PATCH = "patch"
    SUPPOSITORY = "suppository"
    GEL = "gel"
    LOTION = "lotion"
    POWDER = "powder"
    SUSPENSION = "suspension"
    OTHER = "other"


class MedicineStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    DISCONTINUED = "discontinued"
    PENDING_REVIEW = "pending_review"


class InventoryStatus(str, Enum):
    IN_STOCK = "in_stock"
    LOW_STOCK = "low_stock"
    OUT_OF_STOCK = "out_of_stock"
    UNAVAILABLE = "unavailable"


class BatchStatus(str, Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    NEAR_EXPIRY = "near_expiry"
    RECALLED = "recalled"
    DEPLETED = "depleted"


class TransactionType(str, Enum):
    PURCHASE = "purchase"
    SALE = "sale"
    RESERVATION = "reservation"
    RESERVATION_RELEASE = "reservation_release"
    RETURN = "return"
    CANCELLATION = "cancellation"
    ADJUSTMENT = "adjustment"
    DAMAGE = "damage"
    EXPIRY = "expiry"
    TRANSFER = "transfer"


class AlertType(str, Enum):
    LOW_STOCK = "low_stock"
    OUT_OF_STOCK = "out_of_stock"
    NEAR_EXPIRY = "near_expiry"
    EXPIRED = "expired"
    HIGH_DEMAND = "high_demand"
    REORDER = "reorder"


class AlertPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"



class MedicineCategory(BaseDocument):
    name: Indexed(str, unique=True)
    slug: Indexed(str, unique=True)
    description: str = ""
    parent_category_id: Optional[str] = None
    display_order: int = 0
    icon_url: Optional[str] = None
    is_active: bool = True
    medicine_count: int = 0

    class Settings:
        name = "medicine_categories"
        indexes = [
            [("slug", 1)],
            [("parent_category_id", 1)],
            [("is_active", 1), ("display_order", 1)],
        ]



class MedicineBrand(BaseDocument):
    name: Indexed(str, unique=True)
    manufacturer: str
    country_of_origin: str = "India"
    website: Optional[str] = None
    is_active: bool = True

    class Settings:
        name = "medicine_brands"
        indexes = [[("name", 1)], [("manufacturer", 1)]]



class Medicine(BaseDocument):

    name: str
    generic_name: str
    brand_name: Optional[str] = None
    brand_id: Optional[str] = None
    composition: str               # Active ingredients
    strength: str = ""             # e.g. "500mg", "10mg/5ml"
    dosage_form: DosageForm = DosageForm.TABLET
    manufacturer: str = ""
    manufacturer_id: Optional[str] = None
    category_id: Optional[str] = None
    category_name: str = ""

    description: str = ""
    usage_instructions: str = ""
    storage_instructions: str = ""
    side_effects: str = ""
    contraindications: str = ""
    warnings: str = ""
    drug_interactions: str = ""

    prescription_required: bool = False
    scheduled_drug: bool = False   # H, H1, X schedule

    country: str = "India"
    barcode: Optional[str] = None

    primary_image_url: Optional[str] = None
    image_urls: list[str] = Field(default_factory=list)

    search_keywords: list[str] = Field(default_factory=list)

    status: MedicineStatus = MedicineStatus.ACTIVE
    average_price: Optional[float] = None
    review_count: int = 0
    average_rating: float = 0.0

    class Settings:
        name = "medicines"
        indexes = [
            [("name", 1)],
            [("generic_name", 1)],
            [("composition", 1)],
            [("brand_name", 1)],
            [("category_id", 1)],
            [("manufacturer", 1)],
            [("barcode", 1)],
            [("status", 1)],
            [("search_keywords", 1)],
            [("name", "text"), ("generic_name", "text"),
             ("composition", "text"), ("brand_name", "text")],
        ]



class MedicineImage(BaseDocument):
    medicine_id: str
    cloudinary_id: str
    url: str
    thumbnail_url: Optional[str] = None
    image_type: str = "package"   # package | leaflet | storage | primary
    is_primary: bool = False
    file_size: int = 0
    width: int = 0
    height: int = 0

    class Settings:
        name = "medicine_images"
        indexes = [[("medicine_id", 1)]]



class MedicineInventory(BaseDocument):

    pharmacy_id: str
    medicine_id: str
    medicine_name: str              # Denormalized for query performance
    medicine_generic_name: str = ""
    medicine_composition: str = ""

    available_quantity: int = 0
    reserved_quantity: int = 0
    sold_quantity: int = 0

    reorder_level: int = 10
    maximum_stock: int = 500

    current_batch_id: Optional[str] = None
    unit_price: float = 0.0
    mrp: float = 0.0

    status: InventoryStatus = InventoryStatus.OUT_OF_STOCK
    last_restocked_at: Optional[datetime] = None
    last_sold_at: Optional[datetime] = None

    class Settings:
        name = "medicine_inventory"
        indexes = [
            [("pharmacy_id", 1), ("medicine_id", 1)],
            [("medicine_id", 1)],
            [("pharmacy_id", 1), ("status", 1)],
            [("medicine_name", "text"), ("medicine_generic_name", "text"),
             ("medicine_composition", "text")],
        ]

    @property
    def net_available(self) -> int:
        return max(0, self.available_quantity - self.reserved_quantity)



class InventoryBatch(BaseDocument):

    pharmacy_id: str
    medicine_id: str
    inventory_id: str
    batch_number: str
    manufacturer: str = ""
    manufacturing_date: Optional[datetime] = None
    expiry_date: datetime
    quantity: int
    remaining_quantity: int
    supplier: str = ""
    purchase_price: float = 0.0
    selling_price: float = 0.0
    mrp: float = 0.0
    barcode: Optional[str] = None
    qr_code: Optional[str] = None
    status: BatchStatus = BatchStatus.ACTIVE
    notes: str = ""

    class Settings:
        name = "inventory_batches"
        indexes = [
            [("pharmacy_id", 1), ("medicine_id", 1)],
            [("batch_number", 1), ("pharmacy_id", 1)],
            [("expiry_date", 1)],
            [("status", 1)],
        ]



class InventoryTransaction(BaseDocument):

    pharmacy_id: str
    medicine_id: str
    inventory_id: str
    batch_id: Optional[str] = None

    transaction_type: TransactionType
    quantity: int                  # Always positive; direction from type
    quantity_before: int
    quantity_after: int

    reference_id: Optional[str] = None   # reservation_id, order_id, etc.
    reference_type: Optional[str] = None

    performed_by: str = ""         # User ID
    reason: str = ""
    notes: str = ""
    timestamp: datetime = Field(default_factory=_utcnow)

    class Settings:
        name = "inventory_transactions"
        indexes = [
            [("pharmacy_id", 1), ("medicine_id", 1)],
            [("reference_id", 1)],
            [("transaction_type", 1)],
            [("timestamp", -1)],
        ]



class InventoryAlert(BaseDocument):
    pharmacy_id: str
    medicine_id: str
    inventory_id: str
    alert_type: AlertType
    priority: AlertPriority = AlertPriority.MEDIUM
    message: str
    current_quantity: int = 0
    threshold: int = 0
    resolved: bool = False
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    generated_at: datetime = Field(default_factory=_utcnow)
    notification_sent: bool = False

    class Settings:
        name = "inventory_alerts"
        indexes = [
            [("pharmacy_id", 1), ("resolved", 1)],
            [("medicine_id", 1)],
            [("alert_type", 1)],
            [("priority", 1)],
            [("generated_at", -1)],
        ]



class FavoriteMedicine(BaseDocument):
    patient_id: str
    medicine_id: str
    medicine_name: str             # Denormalized
    added_at: datetime = Field(default_factory=_utcnow)

    class Settings:
        name = "favorite_medicines"
        indexes = [
            [("patient_id", 1), ("medicine_id", 1)],
        ]



class MedicineSearchHistory(BaseDocument):
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    search_text: str
    filters_used: dict = Field(default_factory=dict)
    results_count: int = 0
    medicine_selected_id: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    city: Optional[str] = None
    timestamp: datetime = Field(default_factory=_utcnow)

    class Settings:
        name = "medicine_search_history"
        indexes = [
            [("user_id", 1), ("timestamp", -1)],
            [("search_text", "text")],
            [("timestamp", -1)],
        ]
