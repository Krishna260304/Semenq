
from __future__ import annotations

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class MedicineResponse(BaseModel):
    id: str
    name: str
    generic_name: str
    brand_name: Optional[str]
    composition: Optional[str]
    manufacturer: str
    category_id: Optional[str]
    prescription_required: bool
    status: str
    created_at: datetime


class MedicineSearchRequest(BaseModel):
    query: str = Field(min_length=2)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_km: float = 5.0


class InventoryBatchRequest(BaseModel):
    batch_number: str
    expiry_date: datetime
    quantity: int = Field(gt=0)
    mrp: float = Field(gt=0)
    unit_price: float = Field(gt=0)
    purchase_price: float = Field(gt=0)
    supplier_name: Optional[str] = None


class MedicineInventoryResponse(BaseModel):
    id: str
    medicine_id: str
    medicine_name: str
    available_quantity: int
    reserved_quantity: int
    unit_price: float
    mrp: float
    status: str
    last_restocked_at: Optional[datetime]
