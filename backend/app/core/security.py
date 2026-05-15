from datetime import datetime, timedelta, timezone
from typing import Optional

import base64
import hashlib
import hmac
import json
import secrets
import uuid

from app.core.config import settings


class JWTError(Exception):
    """Raised when a token cannot be decoded or validated."""


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _serialize_payload(payload: dict) -> dict:
    serialized = {}
    for key, value in payload.items():
        if isinstance(value, datetime):
            serialized[key] = int(value.timestamp())
        else:
            serialized[key] = value
    return serialized


class _JWTAdapter:
    @staticmethod
    def encode(payload: dict, secret_key: str, algorithm: str = "HS256") -> str:
        if algorithm != "HS256":
            raise JWTError("Unsupported algorithm")

        header = {"alg": "HS256", "typ": "JWT"}
        header_segment = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
        payload_segment = _b64url_encode(
            json.dumps(_serialize_payload(payload), separators=(",", ":")).encode("utf-8")
        )
        signing_input = f"{header_segment}.{payload_segment}".encode("ascii")
        signature = hmac.new(secret_key.encode("utf-8"), signing_input, hashlib.sha256).digest()
        signature_segment = _b64url_encode(signature)
        return f"{header_segment}.{payload_segment}.{signature_segment}"

    @staticmethod
    def decode(token: str, secret_key: str, algorithms: Optional[list[str]] = None) -> dict:
        if algorithms is not None and "HS256" not in algorithms:
            raise JWTError("Unsupported algorithm")

        try:
            header_segment, payload_segment, signature_segment = token.split(".", 2)
            signing_input = f"{header_segment}.{payload_segment}".encode("ascii")
            expected_signature = hmac.new(
                secret_key.encode("utf-8"), signing_input, hashlib.sha256
            ).digest()
            if not hmac.compare_digest(_b64url_decode(signature_segment), expected_signature):
                raise JWTError("Invalid token signature")

            header = json.loads(_b64url_decode(header_segment))
            if header.get("alg") != "HS256":
                raise JWTError("Unsupported algorithm")

            payload = json.loads(_b64url_decode(payload_segment))
            expires_at = payload.get("exp")
            if expires_at is not None and datetime.now(timezone.utc).timestamp() >= float(expires_at):
                raise JWTError("Token has expired")
            return payload
        except JWTError:
            raise
        except Exception as exc:
            raise JWTError("Invalid token") from exc


jwt = _JWTAdapter()


class CryptContext:
    """Small compatibility layer for password hashing when passlib is absent."""

    def __init__(self, schemes=None, deprecated=None):
        self.algorithm = "pbkdf2_sha256"
        self.iterations = 390000

    def _derive(self, password: str, salt: str, iterations: int) -> str:
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            iterations,
        )
        return base64.b64encode(digest).decode("ascii")

    def hash(self, password: str) -> str:
        salt = secrets.token_hex(16)
        digest = self._derive(password, salt, self.iterations)
        return f"{self.algorithm}${self.iterations}${salt}${digest}"

    def verify(self, plain_password: str, hashed_password: str) -> bool:
        try:
            algorithm, iteration_text, salt, digest = hashed_password.split("$", 3)
            if algorithm != self.algorithm:
                return False

            expected = self._derive(plain_password, salt, int(iteration_text))
            return hmac.compare_digest(expected, digest)
        except Exception:
            return False


# Password hashing is centralized here so the seed data and auth flow stay aligned.
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
        "iat": datetime.now(timezone.utc),
        "jti": str(uuid.uuid4()),
    }

    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.ALGORITHM)


def create_refresh_token(subject: str) -> str:
    """Create a signed JWT refresh token with a longer expiry."""
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )

    payload = {
        "sub": subject,
        "exp": expire,
        "type": "refresh",
        "iat": datetime.now(timezone.utc),
        "jti": str(uuid.uuid4()),
    }

    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    """
    Decode and verify a JWT token.
    Raises jose.JWTError if the token is invalid expired or tampered with
    Callers must catch JWTError and convert it to an appropriate HTTP error
    """
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.ALGORITHM])