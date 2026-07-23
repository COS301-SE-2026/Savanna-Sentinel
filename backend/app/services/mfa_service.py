"""Email MFA storage with redis."""

import hashlib
import hmac
import secrets

from app.core.config import settings
from app.core.redis_client import redis_client

_CODE_KEY = "mfa:code:{user_id}"
_ATTEMPTS_KEY = "mfa:attempts:{user_id}"
_COOLDOWN_KEY = "mfa:resend_cooldown:{user_id}"


def _hash_code(user_id: str, code: str) -> str:
    digest = hmac.new(
        settings.JWT_SECRET.encode("utf-8"),
        f"{user_id}:{code}".encode("utf-8"),
        hashlib.sha256,
    )
    return digest.hexdigest()


class MFAService:
    def __init__(self, redis=None):
        self._redis = redis if redis is not None else redis_client

    async def issue_code(self, user_id: str) -> str:
        """Generate a new 6-digit code, store its hash, and reset attempts."""
        code = f"{secrets.randbelow(1_000_000):06d}"
        await self._redis.set(
            _CODE_KEY.format(user_id=user_id),
            _hash_code(user_id, code),
            ex=settings.MFA_CODE_TTL_SECONDS,
        )
        await self._redis.delete(_ATTEMPTS_KEY.format(user_id=user_id))
        return code

    async def verify_code(self, user_id: str, code: str) -> bool:
        code_key = _CODE_KEY.format(user_id=user_id)
        attempts_key = _ATTEMPTS_KEY.format(user_id=user_id)

        stored_hash = await self._redis.get(code_key)
        if stored_hash is None:
            return False

        attempts = await self._redis.incr(attempts_key)
        if attempts == 1:
            await self._redis.expire(
                attempts_key,
                settings.MFA_CODE_TTL_SECONDS,
            )

        if attempts > settings.MFA_MAX_ATTEMPTS:
            await self._redis.delete(code_key)
            return False

        if not hmac.compare_digest(_hash_code(user_id, code), stored_hash):
            return False

        await self._redis.delete(code_key)
        await self._redis.delete(attempts_key)
        return True

    async def can_resend(self, user_id: str) -> bool:
        key = _COOLDOWN_KEY.format(user_id=user_id)
        return not await self._redis.exists(key)

    async def start_resend_cooldown(self, user_id: str) -> None:
        await self._redis.set(
            _COOLDOWN_KEY.format(user_id=user_id),
            "1",
            ex=settings.MFA_RESEND_COOLDOWN_SECONDS,
        )
