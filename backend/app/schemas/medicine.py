
from __future__ import annotations

from datetime import datetime
from typing import Optional
from app.models.medicine import DosageForm
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


class MedicineCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    generic_name: str = Field(min_length=2, max_length=200)
    composition: str = Field(min_length=2, max_length=500)
    manufacturer: str = Field(min_length=2, max_length=200)
    category_name: str = Field(default="General", max_length=100)
    strength: str = Field(default="", max_length=100)
    dosage_form: DosageForm = DosageForm.TABLET
    prescription_required: bool = False
    average_price: Optional[float] = Field(default=None, ge=0)


class MedicineUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=200)
    generic_name: Optional[str] = Field(default=None, min_length=2, max_length=200)
    composition: Optional[str] = Field(default=None, min_length=2, max_length=500)
    manufacturer: Optional[str] = Field(default=None, min_length=2, max_length=200)
    category_name: Optional[str] = Field(default=None, max_length=100)
    strength: Optional[str] = Field(default=None, max_length=100)
    dosage_form: Optional[DosageForm] = None
    prescription_required: Optional[bool] = None
    average_price: Optional[float] = Field(default=None, ge=0)


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
