from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from backend.config import MONGODB_URI

client = None

async def init_db():
    global client
    client = AsyncIOMotorClient(MONGODB_URI)
    
    import backend.models
    await init_beanie(database=client.get_default_database(), document_models=[
        backend.models.User,
        backend.models.PlatformSetting,
        backend.models.Application,
        backend.models.RunLog,
        backend.models.GlobalSetting,
        backend.models.BotRun,
        backend.models.Notification,
        backend.models.Profile,
    ])

async def get_db():
    # Temporary placeholder to prevent API import breaks until they are refactored
    yield None
