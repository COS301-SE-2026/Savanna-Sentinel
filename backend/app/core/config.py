from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # JWT
    JWT_SECRET: str = "change-me-before-production"   # override in .env
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_SECONDS: int = 3600
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # DB NOTE: add DATABASE_URL here when the database is ready.
    # For example:
    # DATABASE_URL: str = "postgresql+asyncpg://user:pass@localhost/savana"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()