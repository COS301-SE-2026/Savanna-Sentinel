import os


class Settings:
    # JWT
    JWT_SECRET: str = os.getenv("JWT_SECRET", "change-me-before-production")
    ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_SECONDS: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_SECONDS", "3600"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

    # DB NOTE: add DATABASE_URL here when the database is ready.
    # For example:
    # DATABASE_URL: str = "postgresql+asyncpg://user:pass@localhost/savana"


settings = Settings()