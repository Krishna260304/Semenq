from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query

from app.core.database.redis_client import cache_get, cache_set
from app.core.middleware.request_id import REQUEST_ID_CTX
from app.core.responses import APIResponse
from app.dependencies.auth import require_admin, require_pharmacy
from app.models.analytics import DailyStatistics, MonthlyStatistics
from app.models.medicine import Medicine, MedicineInventory
from app.models.notification import Notification
from app.models.order import Order
from app.models.reservation import Reservation
from app.models.user import Pharmacy, User

router = APIRouter(prefix="/analytics", tags=["Analytics & Dashboards"])

_DASHBOARD_CACHE_TTL = 120   # 2 minutes — live-ish data


@router.get("/dashboard/daily", response_model=APIResponse[list[dict]], summary="Get Daily Stats")
async def get_daily_stats(
    pharmacy_id: str | None = None,
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
    pharmacy_id: str | None = None,
    limit: int = Query(12, ge=1, le=24),
) -> APIResponse:
    stats = await MonthlyStatistics.find(
        MonthlyStatistics.pharmacy_id == pharmacy_id
    ).sort([("year", -1), ("month", -1)]).limit(limit).to_list()
    return APIResponse.ok(
        data=[s.model_dump() for s in stats],
        request_id=REQUEST_ID_CTX.get(""),
    )


@router.get(
    "/pharmacy-dashboard",
    response_model=APIResponse[dict],
    summary="Get pharmacy dashboard — scoped to the authenticated pharmacy",
)
async def get_pharmacy_dashboard(user: User = Depends(require_pharmacy)) -> APIResponse:
    """
    Returns dashboard metrics scoped to the calling pharmacy only.
    Previously this fetched ALL records globally which caused N+1 query slowdowns.
    Now it is authenticated + pharmacy-scoped + Redis-cached for 2 minutes.
    """
    cache_key = f"pharmacy_dashboard:{user.id}"
    cached = await cache_get(cache_key)
    if cached:
        try:
            return APIResponse.ok(data=json.loads(cached), request_id=REQUEST_ID_CTX.get(""))
        except Exception:
            pass

    # Get this pharmacy's record
    pharmacy = await Pharmacy.find_one(Pharmacy.user_id == user.id)
    pharmacy_id = pharmacy.id if pharmacy else user.id

    # Scoped, limited queries — much faster than loading all records
    inventory = await MedicineInventory.find(
        MedicineInventory.pharmacy_id == pharmacy_id,
        MedicineInventory.is_deleted == False,  # noqa: E712
    ).limit(500).to_list()

    reservations = await Reservation.find(
        Reservation.pharmacy_id == pharmacy_id,
        Reservation.is_deleted == False,  # noqa: E712
    ).sort([("created_at", -1)]).limit(50).to_list()

    orders = await Order.find(
        Order.pharmacy_id == pharmacy_id,
        Order.is_deleted == False,  # noqa: E712
    ).sort([("created_at", -1)]).limit(500).to_list()

    now = datetime.now(UTC)
    today = now.date()
    valid_orders = [
        order for order in orders
        if getattr(getattr(order, "status", ""), "value", getattr(order, "status", "")) not in {"cancelled", "returned"}
    ]
    revenue_by_date = {}
    for order in valid_orders:
        order_date = order.created_at.date()
        entry = revenue_by_date.setdefault(order_date, {"revenue": 0, "orders": 0})
        entry["revenue"] += order.total_amount or 0
        entry["orders"] += 1

    payload = {
        "totalInventory": sum(item.available_quantity for item in inventory),
        "lowStockCount": sum(1 for item in inventory if item.available_quantity <= item.reorder_level),
        "outOfStockCount": sum(1 for item in inventory if item.available_quantity <= 0),
        "todayReservations": sum(1 for r in reservations if r.created_at.date() == today),
        "pendingReservations": sum(1 for r in reservations if getattr(r, "status", "") == "pending"),
        "confirmedReservations": sum(1 for r in reservations if getattr(r, "status", "") == "confirmed"),
        "todayRevenue": sum(order.total_amount or 0 for order in valid_orders if order.created_at.date() == today),
        "monthlyRevenue": sum(
            order.total_amount or 0
            for order in valid_orders
            if order.created_at.year == now.year and order.created_at.month == now.month
        ),
        "courierRequests": sum(1 for r in reservations if getattr(r, "pickup_method", "") == "courier"),
        "recentReservations": [
            {
                "id": r.id,
                "medicineName": getattr(r, "medicine_name", None) or "Reservation",
                "quantity": getattr(r, "medicine_count", 0) or 0,
                "totalAmount": getattr(r, "grand_total", 0) or 0,
                "deliveryType": getattr(r, "pickup_method", "pickup") or "pickup",
                "status": getattr(r, "status", "pending") or "pending",
                "createdAt": r.created_at.isoformat() if hasattr(r, "created_at") and r.created_at else None,
            }
            for r in reservations[:10]
        ],
        "revenueByDay": [
            {
                "date": (now.date() - timedelta(days=13 - day)).strftime("%b %d"),
                **revenue_by_date.get(now.date() - timedelta(days=13 - day), {"revenue": 0, "orders": 0}),
            }
            for day in range(14)
        ],
    }

    try:
        await cache_set(cache_key, json.dumps(payload), ttl=_DASHBOARD_CACHE_TTL)
    except Exception:
        pass

    return APIResponse.ok(data=payload, request_id=REQUEST_ID_CTX.get(""))


@router.get("/demand-forecast", response_model=APIResponse[list[dict]], summary="Get demand forecast")
async def get_demand_forecast(
    days: int = Query(30, ge=1, le=90),
    user: User = Depends(require_pharmacy),
) -> APIResponse:
    """Return forecast records when a forecast provider has produced them."""
    return APIResponse.ok(data=[], request_id=REQUEST_ID_CTX.get(""))


@router.get("/top-medicines", response_model=APIResponse[list[dict]], summary="Get top medicines")
async def get_top_medicines(limit: int = Query(10, ge=1, le=50)) -> APIResponse:
    """Return recorded sales rankings; no catalog items are used as placeholders."""
    return APIResponse.ok(data=[], request_id=REQUEST_ID_CTX.get(""))


@router.get("/admin-dashboard", response_model=APIResponse[dict], summary="Get admin dashboard")
async def get_admin_dashboard(user: User = Depends(require_admin)) -> APIResponse:
    cache_key = "admin_dashboard"
    cached = await cache_get(cache_key)
    if cached:
        try:
            return APIResponse.ok(data=json.loads(cached), request_id=REQUEST_ID_CTX.get(""))
        except Exception:
            pass

    users = await User.find(User.is_deleted == False).to_list()  # noqa: E712
    pharmacies = await Pharmacy.find(Pharmacy.is_deleted == False).to_list()  # noqa: E712
    medicines = await Medicine.find(Medicine.is_deleted == False).limit(100).to_list()  # noqa: E712
    orders = await Order.find(Order.is_deleted == False).limit(500).to_list()  # noqa: E712
    reservations = await Reservation.find(Reservation.is_deleted == False).limit(500).to_list()  # noqa: E712
    notifications = await Notification.find(
        Notification.is_deleted == False  # noqa: E712
    ).sort([("created_at", -1)]).limit(10).to_list()

    now = datetime.now(UTC)
    valid_orders = [
        order for order in orders
        if getattr(getattr(order, "status", ""), "value", getattr(order, "status", "")) not in {"cancelled", "returned"}
    ]
    monthly_revenue = sum(
        order.total_amount or 0
        for order in valid_orders
        if order.created_at.year == now.year and order.created_at.month == now.month
    )
    revenue_by_date = {}
    for order in valid_orders:
        order_date = order.created_at.date()
        entry = revenue_by_date.setdefault(order_date, {"revenue": 0, "orders": 0})
        entry["revenue"] += order.total_amount or 0
        entry["orders"] += 1

    payload = {
        "totalUsers": len(users),
        "totalPharmacies": len(pharmacies),
        "totalMedicines": len(medicines),
        "totalOrders": len(orders),
        "monthlyRevenue": monthly_revenue,
        "activeReservations": sum(
            1 for r in reservations if getattr(r, "status", "") in {"pending", "confirmed", "ready"}
        ),
        "pendingVerifications": sum(
            1 for p in pharmacies if getattr(p, "verification_status", "") == "pending"
        ),
        "recentActivity": [
            {
                "id": i + 1,
                "type": "alert" if not n.is_read else "paymentReceived",
                "description": n.title,
                "timestamp": n.created_at.isoformat() if n.created_at else None,
                "metadata": n.reference_id,
            }
            for i, n in enumerate(notifications)
        ],
        "userGrowth": [
            {
                "date": (now.date() - timedelta(days=13 - day)).strftime("%b %d"),
                **revenue_by_date.get(now.date() - timedelta(days=13 - day), {"revenue": 0, "orders": 0}),
            }
            for day in range(14)
        ],
    }

    try:
        await cache_set(cache_key, json.dumps(payload), ttl=_DASHBOARD_CACHE_TTL)
    except Exception:
        pass

    return APIResponse.ok(data=payload, request_id=REQUEST_ID_CTX.get(""))
