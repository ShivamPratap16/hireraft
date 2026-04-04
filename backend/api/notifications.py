from fastapi import APIRouter, Depends, HTTPException
from backend.auth import get_current_user
from backend.models import Notification, User
from pydantic import BaseModel

class NotificationRead(BaseModel):
    id: str
    type: str
    title: str
    message: str
    read: bool
    created_at: str | None = None

    model_config = {"from_attributes": True}

router = APIRouter(tags=["notifications"])

def _to_read(n: Notification) -> NotificationRead:
    return NotificationRead(
        id=str(n.id),
        type=n.type,
        title=n.title,
        message=n.message,
        read=n.is_read,
        created_at=n.created_at.isoformat() if n.created_at else None,
    )

@router.get("/notifications", response_model=list[NotificationRead])
async def list_notifications(
    unread_only: bool = False,
    limit: int = 50,
    user: User = Depends(get_current_user),
):
    query = {"user_id": str(user.id)}
    if unread_only:
        query["is_read"] = False
        
    rows = await Notification.find(query).sort("-created_at").limit(min(limit, 100)).to_list()
    return [_to_read(r) for r in rows]

@router.patch("/notifications/{notif_id}/read")
async def mark_notification_read(
    notif_id: str,
    user: User = Depends(get_current_user),
):
    from beanie import PydanticObjectId
    try:
        n_id = PydanticObjectId(notif_id)
    except:
        raise HTTPException(status_code=404, detail="Not found")

    n = await Notification.find_one({"_id": n_id, "user_id": str(user.id)})
    if not n:
        raise HTTPException(status_code=404, detail="Not found")
    n.is_read = True
    await n.save()
    return {"ok": True}

@router.post("/notifications/read-all")
async def mark_all_read(
    user: User = Depends(get_current_user),
):
    await Notification.find({"user_id": str(user.id), "is_read": False}).update({"$set": {"is_read": True}})
    return {"ok": True}

@router.get("/notifications/unread-count")
async def unread_count(
    user: User = Depends(get_current_user),
):
    count = await Notification.find({"user_id": str(user.id), "is_read": False}).count()
    return {"count": count}
