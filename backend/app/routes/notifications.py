from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.core.responses import APIResponse
from app.dependencies.auth import get_current_active_user
from app.models.notification import Notification
from app.models.user import User

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=APIResponse[list[dict]], summary="List notifications")
async def list_notifications(
    unreadOnly: bool = Query(False),
    user: User = Depends(get_current_active_user),
) -> APIResponse:
    query = Notification.find(
        Notification.user_id == user.id,
        Notification.is_deleted == False,
    )  # noqa: E712
    if unreadOnly:
        query = query.find(Notification.is_read == False)  # noqa: E712
    notifications = await query.sort([("created_at", -1)]).limit(50).to_list()
    return APIResponse.ok(data=[item.model_dump() for item in notifications], message="Notifications retrieved.")


@router.post("/{notification_id}/read", response_model=APIResponse[dict], summary="Mark notification as read")
async def mark_notification_read(
    notification_id: str,
    user: User = Depends(get_current_active_user),
) -> APIResponse:
    notification = await Notification.find_one(
        Notification.id == notification_id,
        Notification.user_id == user.id,
    )
    if not notification:
        return APIResponse.ok(data={}, message="Notification not found.")
    notification.is_read = True
    await notification.save()
    return APIResponse.ok(data=notification.model_dump(), message="Notification marked as read.")
