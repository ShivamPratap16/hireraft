from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import Profile, User
from backend.schemas import ProfileRead, ProfileUpdate
from backend.auth import get_current_user

router = APIRouter(tags=["profile"])


@router.get("/profile", response_model=ProfileRead)
async def get_profile(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Profile).where(Profile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        profile = Profile(user_id=user.id, full_name=user.name)
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
    return ProfileRead.model_validate(profile)


@router.put("/profile", response_model=ProfileRead)
async def update_profile(
    body: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Profile).where(Profile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        profile = Profile(user_id=user.id)
        db.add(profile)
        await db.flush()

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)

    await db.commit()
    await db.refresh(profile)
    return ProfileRead.model_validate(profile)
