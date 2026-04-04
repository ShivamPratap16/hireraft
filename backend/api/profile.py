from fastapi import APIRouter, Depends
from backend.models import Profile, User
from backend.schemas import ProfileRead, ProfileUpdate
from backend.auth import get_current_user

router = APIRouter(tags=["profile"])

@router.get("/profile", response_model=ProfileRead)
async def get_profile(
    user: User = Depends(get_current_user),
):
    profile = await Profile.find_one({"user_id": str(user.id)})
    if not profile:
        profile = Profile(user_id=str(user.id), full_name=user.name)
        await profile.insert()
    return ProfileRead.model_validate(profile)

@router.put("/profile", response_model=ProfileRead)
async def update_profile(
    body: ProfileUpdate,
    user: User = Depends(get_current_user),
):
    profile = await Profile.find_one({"user_id": str(user.id)})
    if not profile:
        profile = Profile(user_id=str(user.id))
        await profile.insert()

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)

    await profile.save()
    return ProfileRead.model_validate(profile)
