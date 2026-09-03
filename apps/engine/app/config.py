import os
from typing import List
from dotenv import load_dotenv

load_dotenv()

class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres")
    SUPABASE_JWT_SECRET: str = os.getenv("SUPABASE_JWT_SECRET", "super-secret-jwt-token-with-at-least-32-chars-long")
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "http://localhost:54321")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    RAZORPAY_KEY_ID: str = os.getenv("RAZORPAY_KEY_ID", "rzp_test_mockkeyid123")
    RAZORPAY_KEY_SECRET: str = os.getenv("RAZORPAY_KEY_SECRET", "mocksecret123")
    RAZORPAY_WEBHOOK_SECRET: str = os.getenv("RAZORPAY_WEBHOOK_SECRET", "mockwebhooksecret123")
    
    ALLOWED_ORIGINS_RAW: str = os.getenv(
        "ALLOWED_ORIGINS", 
        "http://localhost:3000,http://127.0.0.1:3000"
    )

    @property
    def ALLOWED_ORIGINS(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS_RAW.split(",") if origin.strip()]

settings = Settings()
