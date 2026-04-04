from backend.models import Notification

async def create_notification(
    user_id: str,
    type_: str,
    title: str,
    message: str,
) -> None:
    n = Notification(
        user_id=user_id,
        type=type_,
        title=title,
        message=message,
        is_read=False,
    )
    await n.insert()
