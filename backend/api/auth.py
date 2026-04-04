from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from backend.models import User, PlatformSetting, GlobalSetting, Profile
from backend.auth import hash_password, verify_password, create_token, get_current_user

router = APIRouter(tags=["auth"])

PLATFORMS = ["linkedin", "indeed", "naukri", "internshala"]

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str = ""

class LoginRequest(BaseModel):
    email: str
    password: str

class AuthResponse(BaseModel):
    token: str
    user: dict

class MeResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str

@router.post("/auth/register", response_model=AuthResponse)
async def register(body: RegisterRequest):
    existing = await User.find_one(User.email == body.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        name=body.name or body.email.split("@")[0],
    )
    await user.insert()

    platform_settings = []
    for p in PLATFORMS:
        platform_settings.append(PlatformSetting(user_id=str(user.id), platform=p))
    await PlatformSetting.insert_many(platform_settings)

    global_setting = GlobalSetting(user_id=str(user.id))
    await global_setting.insert()

    profile = Profile(user_id=str(user.id), full_name=user.name)
    await profile.insert()

    token = create_token(str(user.id), user.email)
    return AuthResponse(
        token=token,
        user={"id": str(user.id), "email": user.email, "name": user.name, "role": getattr(user, "role", "user")},
    )

@router.post("/auth/login", response_model=AuthResponse)
async def login(body: LoginRequest):
    user = await User.find_one(User.email == body.email)
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_token(str(user.id), user.email)
    return AuthResponse(
        token=token,
        user={"id": str(user.id), "email": user.email, "name": user.name, "role": getattr(user, "role", "user")},
    )

@router.get("/auth/me", response_model=MeResponse)
async def me(user: User = Depends(get_current_user)):
    return MeResponse(id=str(user.id), email=user.email, name=user.name, role=getattr(user, "role", "user"))
