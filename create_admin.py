import asyncio
import os
from dotenv import load_dotenv

# Load variables from .env
load_dotenv()

async def main():
    from backend.database import init_db
    from backend.models import User
    from backend.auth import hash_password

    # Initialize Beanie and MongoDB connection
    print("Connecting to MongoDB...")
    await init_db()

    email = "admin@hireraft.com"
    password = "admin"
    
    user = await User.find_one(User.email == email)
    if not user:
        print(f"User {email} not found. Creating new user...")
        user = User(
            email=email,
            name="Super Admin",
            hashed_password=hash_password(password),
            role="admin"
        )
        await user.insert()
        print(f"Successfully created admin user!")
        print(f"Email: {email}")
        print(f"Password: {password}")
    else:
        print(f"User {email} already exists.")
        user.role = "admin"
        await user.save()
        print(f"Successfully elevated {email} to Admin scope.")

if __name__ == "__main__":
    asyncio.run(main())
