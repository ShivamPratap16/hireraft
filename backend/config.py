import os
from pathlib import Path
from cryptography.fernet import Fernet
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")
DATA_DIR = BASE_DIR / "data"
RESUME_DIR = DATA_DIR / "resumes"
DB_PATH = DATA_DIR / "jobpilot.db"

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/jobpilot")

_key = os.getenv("ENCRYPTION_KEY", "")
if not _key or _key == "change-me-to-a-real-fernet-key":
    _key = Fernet.generate_key().decode()

try:
    _cipher = Fernet(_key.encode() if isinstance(_key, str) else _key)
except Exception:
    _key = Fernet.generate_key().decode()
    _cipher = Fernet(_key.encode())


def encrypt(plaintext: str) -> str:
    if not plaintext:
        return ""
    return _cipher.encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    if not ciphertext:
        return ""
    try:
        return _cipher.decrypt(ciphertext.encode()).decode()
    except Exception:
        return ciphertext


RESUME_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Optional: Lightcast Open Skills API for job title autocomplete (https://lightcast.io/open-skills/access)
LIGHTCAST_CLIENT_ID = os.getenv("LIGHTCAST_CLIENT_ID", "")
LIGHTCAST_CLIENT_SECRET = os.getenv("LIGHTCAST_CLIENT_SECRET", "")
