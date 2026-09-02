import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    DATABASE_URL: str = os.environ["DATABASE_URL"]

    # JWT
    JWT_SECRET: str = os.environ["JWT_SECRET"]
    ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_SECONDS: int = int(
        os.getenv(
            "ACCESS_TOKEN_EXPIRE_SECONDS",
            "3600",
        ),
    )
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(
        os.getenv(
            "REFRESH_TOKEN_EXPIRE_DAYS",
            "30",
        ),
    )

    # Email (Resend)
    RESEND_API_KEY: str = os.environ["RESEND_API_KEY"]
    RESEND_FROM_ADDRESS: str = os.environ["RESEND_FROM_ADDRESS"]
    FRONTEND_BASE_URL: str = os.environ["FRONTEND_BASE_URL"]

    # Redis
    REDIS_URL: str = os.environ["REDIS_URL"]

    # MinIO / object storage
    MINIO_ENDPOINT: str = os.getenv("MINIO_ENDPOINT", "seaweedfs:9000")
    MINIO_ACCESS_KEY: str = os.environ["MINIO_ACCESS_KEY"]
    MINIO_SECRET_KEY: str = os.environ["MINIO_SECRET_KEY"]
    MINIO_BUCKET: str = os.getenv("MINIO_BUCKET", "savanna-sentinel-media")
    MINIO_USE_SSL: bool = os.getenv("MINIO_USE_SSL", "false").lower() == "true"
    MINIO_PUBLIC_ENDPOINT: str = os.getenv(
        "MINIO_PUBLIC_ENDPOINT",
        os.getenv("MINIO_ENDPOINT", "seaweedfs:9000"),
    )

    MINIO_REGION: str = os.getenv("MINIO_REGION", "us-east-1")

    # Admin MFA (email otp)
    MFA_ENABLED: bool = os.getenv("MFA_ENABLED", "true").lower() == "true"
    MFA_CODE_TTL_SECONDS: int = int(
        os.getenv(
            "MFA_CODE_TTL_SECONDS",
            "300",
        ),
    )
    MFA_MAX_ATTEMPTS: int = int(
        os.getenv(
            "MFA_MAX_ATTEMPTS",
            "5",
        ),
    )
    MFA_RESEND_COOLDOWN_SECONDS: int = int(
        os.getenv(
            "MFA_RESEND_COOLDOWN_SECONDS",
            "30",
        ),
    )
    # CORS - deployed frontend origin
    FRONTEND_ORIGIN: str | None = os.getenv("FRONTEND_ORIGIN")

    # One park per deployment, id is this constant
    PARK_ID: str = os.getenv("PARK_ID", "klaserie")


settings = Settings()
