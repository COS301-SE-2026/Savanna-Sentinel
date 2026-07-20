import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    DATABASE_URL: str = os.environ["DATABASE_URL"]

    # JWT
    JWT_SECRET: str = os.environ["JWT_SECRET"]
    ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_SECONDS: int = int(os.getenv(
        "ACCESS_TOKEN_EXPIRE_SECONDS",
        "3600",
    ))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv(
        "REFRESH_TOKEN_EXPIRE_DAYS",
        "30",
    ))

    # Email (Resend)
    RESEND_API_KEY: str = os.environ["RESEND_API_KEY"]
    RESEND_FROM_ADDRESS: str = os.environ["RESEND_FROM_ADDRESS"]
    FRONTEND_BASE_URL: str = os.environ["FRONTEND_BASE_URL"]


settings = Settings()
