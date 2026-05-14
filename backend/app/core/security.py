from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# bcrypt context this is the only place password hashing is done
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Constant-time comparison — safe against timing attacks.
    Always call this even when the user does not exist (use a dummy hash)
    so the response time does not reveal whether an email is registered.
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a plain-text password. Use this at registration time."""
    return pwd_context.hash(password)


def create_access_token(subject: str, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a signed JWT access token.

    subject: the user's ID as a string
    expires_delta: override the default expiry (useful in tests)
    """
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(seconds=settings.ACCESS_TOKEN_EXPIRE_SECONDS)
    )

    payload = {
        "sub": subject, # subject = user ID
        "exp": expire, # expiry timestamp
        "type": "access", # lets us reject refresh tokens used as access tokens
    }

    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(subject: str) -> str:
    """Create a signed JWT refresh token with a longer expiry."""
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )

    payload = {
        "sub": subject,
        "exp": expire,
        "type": "refresh",
    }

    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    """
    Decode and verify a JWT token.
    Raises jose.JWTError if the token is invalid expired or tampered with
    Callers must catch JWTError and convert it to an appropriate HTTP error
    """
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])