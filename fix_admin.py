import asyncio
from dotenv import load_dotenv
load_dotenv()

async def main():
    from backend.database import init_db
    from backend.models import User

    await init_db()

    user = await User.find_one(User.email == "admin@hireraft.com")
    if not user:
        print("User admin@hireraft.com not found!")
        return

    print(f"Current role: {user.role}")
    user.role = "admin"
    await user.save()
    
    # Verify
    user2 = await User.find_one(User.email == "admin@hireraft.com")
    print(f"Updated role: {user2.role}")
    print("Done! admin@hireraft.com is now an admin.")

if __name__ == "__main__":
    asyncio.run(main())
