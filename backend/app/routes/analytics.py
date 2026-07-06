
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.core.middleware.request_id import REQUEST_ID_CTX
from app.core.responses import APIResponse
from app.models.analytics import DailyStatistics, MonthlyStatistics, WeeklyStatistics
from app.models.medicine import Medicine, MedicineInventory
from app.models.notification import Notification
from app.models.order import Order
from app.models.reservation import Reservation
from app.models.user import Pharmacy, User

router = APIRouter(prefix="/analytics", tags=["Analytics & Dashboards"])


def _series(days: int = 14) -> list[dict]:
    now = datetime.now(timezone.utc)
    return [
        {
            "date": (now - timedelta(days=days - 1 - index)).strftime("%b %d"),
            "revenue": 0,
            "orders": 0,
        }
        for index in range(days)
    ]


@router.get("/dashboard/daily", response_model=APIResponse[list[dict]], summary="Get Daily Stats")
async def get_daily_stats(
    pharmacy_id: Optional[str] = None,
    limit: int = Query(7, ge=1, le=30),
) -> APIResponse:
    stats = await DailyStatistics.find(
        DailyStatistics.pharmacy_id == pharmacy_id
    ).sort([("date", -1)]).limit(limit).to_list()
    
    return APIResponse.ok(
        data=[s.model_dump() for s in stats],
        request_id=REQUEST_ID_CTX.get(""),
    )


@router.get("/dashboard/monthly", response_model=APIResponse[list[dict]], summary="Get Monthly Stats")
async def get_monthly_stats(
    pharmacy_id: Optional[str] = None,
    limit: int = Query(12, ge=1, le=24),
) -> APIResponse:
    stats = await MonthlyStatistics.find(
        MonthlyStatistics.pharmacy_id == pharmacy_id
    ).sort([("year", -1), ("month", -1)]).limit(limit).to_list()
    
    return APIResponse.ok(
        data=[s.model_dump() for s in stats],
        request_id=REQUEST_ID_CTX.get(""),
    )


@router.get("/pharmacy-dashboard", response_model=APIResponse[dict], summary="Get pharmacy dashboard")
async def get_pharmacy_dashboard() -> APIResponse:
    pharmacies = await Pharmacy.find(Pharmacy.is_deleted == False).to_list()  # noqa: E712
    inventory = await MedicineInventory.find(MedicineInventory.is_deleted == False).to_list()  # noqa: E712
    reservations = await Reservation.find(Reservation.is_deleted == False).sort([("created_at", -1)]).limit(20).to_list()  # noqa: E712
    medicines = await Medicine.find(Medicine.is_deleted == False).to_list()  # noqa: E712

    return APIResponse.ok(
        data={
            "totalInventory": sum(item.available_quantity for item in inventory),
            "lowStockCount": sum(1 for item in inventory if item.available_quantity <= item.reorder_level),
            "outOfStockCount": sum(1 for item in inventory if item.available_quantity <= 0),
            "todayReservations": sum(1 for item in reservations if item.created_at.date() == datetime.now(timezone.utc).date()),
            "pendingReservations": sum(1 for item in reservations if getattr(item, "status", "") == "pending"),
            "confirmedReservations": sum(1 for item in reservations if getattr(item, "status", "") == "confirmed"),
            "todayRevenue": 0,
            "monthlyRevenue": 0,
            "courierRequests": sum(1 for item in reservations if getattr(item, "pickup_method", "") == "courier"),
            "recentReservations": [item.model_dump() for item in reservations[:10]],
            "topSellingMedicines": [
                {
                    "medicineId": medicine.id,
                    "medicineName": medicine.name,
                    "category": medicine.category,
                    "count": 0,
                    "revenue": 0,
                    "trend": "stable",
                    "percentChange": 0,
                }
                for medicine in medicines[:10]
            ],
            "revenueByDay": _series(),
        },
        request_id=REQUEST_ID_CTX.get(""),
    )


@router.get("/admin-dashboard", response_model=APIResponse[dict], summary="Get admin dashboard")
async def get_admin_dashboard() -> APIResponse:
    users = await User.find(User.is_deleted == False).to_list()  # noqa: E712
    pharmacies = await Pharmacy.find(Pharmacy.is_deleted == False).to_list()  # noqa: E712
    medicines = await Medicine.find(Medicine.is_deleted == False).to_list()  # noqa: E712
    orders = await Order.find(Order.is_deleted == False).to_list()  # noqa: E712
    reservations = await Reservation.find(Reservation.is_deleted == False).to_list()  # noqa: E712
    notifications = await Notification.find(Notification.is_deleted == False).sort([("created_at", -1)]).limit(10).to_list()  # noqa: E712

    return APIResponse.ok(
        data={
            "totalUsers": len(users),
            "totalPharmacies": len(pharmacies),
            "totalMedicines": len(medicines),
            "totalOrders": len(orders),
            "monthlyRevenue": 0,
            "activeReservations": sum(1 for item in reservations if getattr(item, "status", "") in {"pending", "confirmed", "ready"}),
            "pendingVerifications": sum(1 for item in pharmacies if getattr(item, "verification_status", "") == "pending"),
            "platformHealth": {
                "serverStatus": "healthy",
                "dbStatus": "healthy",
                "apiStatus": "healthy",
                "apiResponseTime": 0,
                "uptime": 100,
                "errorRate": 0,
            },
            "recentActivity": [
                {
                    "id": index + 1,
                    "type": "alert" if notification.is_read is False else "paymentReceived",
                    "description": notification.title,
                    "timestamp": notification.created_at,
                    "metadata": notification.reference_id,
                }
                for index, notification in enumerate(notifications)
            ],
            "userGrowth": _series(12),
        },
        request_id=REQUEST_ID_CTX.get(""),
    )


@router.get("/demand-forecast", response_model=APIResponse[list[dict]], summary="Get demand forecast")
async def get_demand_forecast(days: int = Query(30, ge=1, le=90)) -> APIResponse:
    inventory = await MedicineInventory.find(MedicineInventory.is_deleted == False).limit(20).to_list()  # noqa: E712
    data = [
        {
            "medicineId": item.medicine_id,
            "medicineName": item.medicine_name,
            "genericName": item.medicine_generic_name,
            "currentStock": item.available_quantity,
            "predictedDemand": item.available_quantity,
            "reorderSuggestion": item.reorder_level,
            "confidence": 0.5,
            "trend": "stable",
            "healthStatus": "healthy" if item.available_quantity > item.reorder_level else "warning",
            "aiInsight": "Live inventory-based forecast.",
            "daysUntilStockout": None,
        }
        for item in inventory
    ]
    return APIResponse.ok(data=data, request_id=REQUEST_ID_CTX.get(""))


@router.get("/top-medicines", response_model=APIResponse[list[dict]], summary="Get top medicines")
async def get_top_medicines(limit: int = Query(10, ge=1, le=50)) -> APIResponse:
    medicines = await Medicine.find(Medicine.is_deleted == False).limit(limit).to_list()  # noqa: E712
    return APIResponse.ok(
        data=[
            {
                "medicineId": medicine.id,
                "medicineName": medicine.name,
                "category": medicine.category,
                "count": 0,
                "revenue": 0,
                "trend": "stable",
                "percentChange": 0,
            }
            for medicine in medicines
        ],
        request_id=REQUEST_ID_CTX.get(""),
    )
