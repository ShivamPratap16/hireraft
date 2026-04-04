from sqlalchemy.ext.asyncio import AsyncSession

from backend.models import Notification


async def create_notification(
    session: AsyncSession,
    user_id: int,
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
    session.add(n)
    await session.commit()
