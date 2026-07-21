"""Unit tests for MFAService."""

import pytest

from app.core.config import settings
from app.services.mfa_service import MFAService


class FakeRedis:
    def __init__(self):
        self.store: dict[str, str] = {}

    async def set(self, key, value, ex=None):
        self.store[key] = value

    async def get(self, key):
        return self.store.get(key)

    async def incr(self, key):
        value = int(self.store.get(key, "0")) + 1
        self.store[key] = str(value)
        return value

    async def expire(self, key, seconds):
        return key in self.store

    async def delete(self, key):
        self.store.pop(key, None)

    async def exists(self, key):
        return key in self.store


def make_service() -> tuple[MFAService, FakeRedis]:
    fake = FakeRedis()
    return MFAService(redis=fake), fake


@pytest.mark.asyncio
async def test_issue_code_returns_six_digit_string():
    service, _ = make_service()
    code = await service.issue_code("user-1")
    assert len(code) == 6
    assert code.isdigit()


@pytest.mark.asyncio
async def test_issue_code_stores_hash_not_raw_code():
    service, fake = make_service()
    code = await service.issue_code("user-1")
    stored = fake.store["mfa:code:user-1"]
    assert stored != code


@pytest.mark.asyncio
async def test_verify_code_correct_returns_true_and_consumes_code():
    service, _ = make_service()
    code = await service.issue_code("user-1")

    assert await service.verify_code("user-1", code) is True
    assert await service.verify_code("user-1", code) is False


@pytest.mark.asyncio
async def test_verify_code_wrong_code_returns_false():
    service, _ = make_service()
    await service.issue_code("user-1")

    assert await service.verify_code("user-1", "000000") is False


@pytest.mark.asyncio
async def test_verify_code_no_pending_code_returns_false():
    service, _ = make_service()
    assert await service.verify_code("ghost-user", "123456") is False


@pytest.mark.asyncio
async def test_verify_code_locks_out_after_max_attempts():
    service, _ = make_service()
    code = await service.issue_code("user-1")

    for _ in range(settings.MFA_MAX_ATTEMPTS):
        assert await service.verify_code("user-1", "000000") is False

    assert await service.verify_code("user-1", code) is False


@pytest.mark.asyncio
async def test_verify_code_hash_is_bound_to_user_id():
    service, fake = make_service()
    code = await service.issue_code("user-1")

    fake.store["mfa:code:user-2"] = fake.store["mfa:code:user-1"]

    assert await service.verify_code("user-2", code) is False


@pytest.mark.asyncio
async def test_can_resend_true_until_cooldown_started():
    service, _ = make_service()
    assert await service.can_resend("user-1") is True

    await service.start_resend_cooldown("user-1")
    assert await service.can_resend("user-1") is False


@pytest.mark.asyncio
async def test_issue_code_resets_attempts_counter():
    service, fake = make_service()
    await service.issue_code("user-1")

    await service.verify_code("user-1", "000000")
    assert fake.store["mfa:attempts:user-1"] == "1"

    await service.issue_code("user-1")
    assert "mfa:attempts:user-1" not in fake.store
