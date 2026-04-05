import asyncio
from dotenv import load_dotenv
load_dotenv()

async def main():
    from backend.database import init_db
    from backend.models import User, Profile
    
    await init_db()
    
    user = await User.find_one(User.email == "admin@hireraft.com")
    print(f"User: {user.id} / {user.email} / role={user.role}")
    
    profile = await Profile.find_one({"user_id": str(user.id)})
    if not profile:
        print("No profile found, creating one...")
        profile = Profile(user_id=str(user.id), full_name=user.name)
        await profile.insert()
        print("Created profile")
    
    print(f"\nProfile.id = {profile.id}")
    print(f"Profile.id type = {type(profile.id)}")
    
    d = profile.model_dump()
    print(f"\nmodel_dump keys: {list(d.keys())}")
    print(f"model_dump _id type: {type(d.get('_id', 'MISSING'))}")
    print(f"model_dump id type: {type(d.get('id', 'MISSING'))}")
    
    # Try the exact conversion we do in the endpoint
    d["id"] = str(profile.id)
    
    from backend.schemas import ProfileRead
    try:
        pr = ProfileRead(**d)
        print(f"\nProfileRead created successfully: {pr.id}")
    except Exception as e:
        print(f"\nProfileRead FAILED: {e}")
        # Try filtering only expected fields
        expected = ProfileRead.model_fields.keys()
        filtered = {k: d[k] for k in expected if k in d}
        print(f"Filtered keys: {list(filtered.keys())}")
        try:
            pr2 = ProfileRead(**filtered)
            print(f"Filtered ProfileRead worked: {pr2.id}")
        except Exception as e2:
            print(f"Filtered also failed: {e2}")

if __name__ == "__main__":
    asyncio.run(main())
