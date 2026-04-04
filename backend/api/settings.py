import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import PlatformSetting, GlobalSetting, User
from backend.schemas import PlatformSettingRead, PlatformSettingUpdate, GlobalSettingRead, GlobalSettingUpdate
from backend.config import RESUME_DIR, encrypt, decrypt
from backend.auth import get_current_user

router = APIRouter(tags=["settings"])


@router.get("/settings/platforms", response_model=list[PlatformSettingRead])
async def get_platform_settings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PlatformSetting)
        .where(PlatformSetting.user_id == user.id)
        .order_by(PlatformSetting.platform)
    )
    items = []
    for r in result.scalars().all():
        dto = PlatformSettingRead.model_validate(r)
        if dto.password:
            dto.password = decrypt(dto.password)
        items.append(dto)
    return items


@router.put("/settings/platforms/{platform}", response_model=PlatformSettingRead)
async def update_platform_setting(
    platform: str,
    body: PlatformSettingUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PlatformSetting).where(
            PlatformSetting.user_id == user.id,
            PlatformSetting.platform == platform,
        )
    )
    ps = result.scalar_one_or_none()
    if not ps:
        raise HTTPException(status_code=404, detail=f"Platform {platform} not found")

    updates = body.model_dump(exclude_unset=True)
    if "password" in updates:
        pw = updates["password"]
        if not pw or pw == "********":
            del updates["password"]
        else:
            current_decrypted = decrypt(ps.password) if ps.password else ""
            if pw == current_decrypted:
                del updates["password"]
            else:
                updates["password"] = encrypt(pw)
    for field, value in updates.items():
        setattr(ps, field, value)

    await db.commit()
    await db.refresh(ps)

    response = PlatformSettingRead.model_validate(ps)
    if response.password:
        response.password = decrypt(response.password)
    return response


@router.get("/settings/global", response_model=GlobalSettingRead)
async def get_global_settings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(GlobalSetting).where(GlobalSetting.user_id == user.id)
    )
    gs = result.scalar_one_or_none()
    if not gs:
        raise HTTPException(status_code=404, detail="Global settings not found")
    return GlobalSettingRead.model_validate(gs)


@router.put("/settings/global", response_model=GlobalSettingRead)
async def update_global_settings(
    body: GlobalSettingUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(GlobalSetting).where(GlobalSetting.user_id == user.id)
    )
    gs = result.scalar_one_or_none()
    if not gs:
        raise HTTPException(status_code=404, detail="Global settings not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(gs, field, value)

    if body.schedule_time:
        from backend.scheduler import reschedule
        reschedule(body.schedule_time)

    await db.commit()
    await db.refresh(gs)
    return GlobalSettingRead.model_validate(gs)


@router.post("/settings/resume")
async def upload_resume(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    dest = RESUME_DIR / f"{user.id}_{file.filename}"
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    result = await db.execute(
        select(GlobalSetting).where(GlobalSetting.user_id == user.id)
    )
    gs = result.scalar_one_or_none()
    if gs:
        gs.resume_path = str(dest)
        await db.commit()

    return {"filename": file.filename, "path": str(dest)}
