"""Unit tests for AuthService.

These tests call AuthService directly with a fake repository so production code
can stay DB-only and free of hardcoded login users.
"""

from dataclasses import dataclass

import pytest
from pydantic import ValidationError

import app.services.auth_service as auth_service_module
from app.core.security import get_password_hash
from app.schemas.auth import RegisterRequest, RequestedRole
from app.services.auth_service import AuthService
from app.services.mfa_service import MFAService


class FakeMFARedis:
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


@dataclass
class AuthUser:
    id: str
    username: str
    email: str
    hashed_password: str
    is_active: bool
    role: str


class FakeAuthRepository:
    def __init__(self):
        self.users = {
            "ranger": AuthUser(
                id="user-001",
                username="ranger",
                email="ranger@savanna.com",
                hashed_password=get_password_hash("SecurePass1!"),
                is_active=True,
                role="ranger",
            ),
            "inactive": AuthUser(
                id="user-002",
                username="inactive",
                email="inactive@savanna.com",
                hashed_password=get_password_hash("SecurePass1!"),
                is_active=False,
                role="analyst",
            ),
            "admin": AuthUser(
                id="user-003",
                username="admin",
                email="admin@savanna.com",
                hashed_password=get_password_hash("SecurePass1!"),
                is_active=True,
                role="admin",
            ),
        }
        self.refresh_tokens: dict[str, set[str]] = {}

    async def get_by_username(self, username: str):
        return self.users.get(username)

    async def get_by_id(self, user_id: str):
        for user in self.users.values():
            if user.id == user_id:
                return user
        return None

    async def save_refresh_token(self, user_id: str, token: str) -> None:
        self.refresh_tokens.setdefault(user_id, set()).add(token)

    async def get_user_by_refresh_token(self, token: str):
        for user_id, tokens in self.refresh_tokens.items():
            if token in tokens:
                for user in self.users.values():
                    if user.id == user_id:
                        return user
        return None

    async def revoke_refresh_token(self, token: str) -> None:
        for tokens in self.refresh_tokens.values():
            tokens.discard(token)

    async def revoke_all_refresh_tokens(self, user_id: str) -> None:
        self.refresh_tokens.pop(user_id, None)


class FakeRegisterRepository:
    def __init__(self, email_taken=False, username_taken=False):  # noqa: D107
        self._email_taken = email_taken
        self._username_taken = username_taken

    async def get_by_email(self, email: str):  # noqa: D102
        return (
            AuthUser("x", "x", email, "x", True, "ranger")
            if self._email_taken
            else None
        )

    async def get_by_username(self, username: str):  # noqa: D102
        return (
            AuthUser("x", username, "x", "x", True, "ranger")
            if self._username_taken
            else None
        )

    async def create(self, req, hashed_password: str):  # noqa: D102
        return AuthUser(
            id="new-001",
            username=req.username,
            email=req.email,
            hashed_password=hashed_password,
            is_active=False,
            role=req.requested_role.value,
        )


# Helpers


def make_service() -> AuthService:
    """Return a fresh AuthService backed by the fake repository."""
    return AuthService(FakeAuthRepository())


def make_mfa_service(monkeypatch):
    sent = []
    monkeypatch.setattr(
        auth_service_module,
        "send_mfa_code",
        lambda to_email, code: sent.append((to_email, code)),
    )
    fake_redis = FakeMFARedis()
    service = AuthService(
        FakeAuthRepository(),
        mfa_service=MFAService(redis=fake_redis),
        mfa_enabled=True,
    )
    return service, sent, fake_redis


# Login tests


@pytest.mark.asyncio
async def test_login_valid_active_user_returns_tokens():
    """Correct credentials for an active user → both tokens returned."""
    service = make_service()
    result = await service.login("ranger", "SecurePass1!")

    assert result is not None
    assert result.access_token != ""
    assert result.refresh_token != ""
    assert result.token_type == "bearer"
    assert result.expires_in == 3600


@pytest.mark.asyncio
async def test_login_wrong_password_returns_none():
    """Wrong password None (caller raises vague 401)."""
    service = make_service()
    result = await service.login("ranger", "WrongPassword!")
    assert result is None


@pytest.mark.asyncio
async def test_login_unknown_username_returns_none():
    """Unknown username None, same as wrong password (no enumeration)."""
    service = make_service()
    result = await service.login("ghost", "AnyPassword1!")
    assert result is None


@pytest.mark.asyncio
async def test_login_inactive_account_returns_none():
    """Inactive account None (same vague 401, no enumeration)."""
    service = make_service()
    result = await service.login("inactive", "SecurePass1!")
    assert result is None


# Admin MFA tests


@pytest.mark.asyncio
async def test_admin_login_returns_mfa_challenge_not_tokens(monkeypatch):
    service, sent, _ = make_mfa_service(monkeypatch)
    result = await service.login("admin", "SecurePass1!")

    assert result is not None
    assert result.mfa_required is True
    assert result.mfa_token != ""
    assert not hasattr(result, "access_token")
    assert len(sent) == 1
    assert sent[0][0] == "admin@savanna.com"
    assert len(sent[0][1]) == 6


@pytest.mark.asyncio
async def test_admin_login_wrong_password_returns_none(monkeypatch):
    service, sent, _ = make_mfa_service(monkeypatch)
    result = await service.login("admin", "WrongPassword!")

    assert result is None
    assert sent == []


@pytest.mark.asyncio
async def test_admin_login_bypasses_mfa_when_disabled(monkeypatch):
    sent = []
    monkeypatch.setattr(
        auth_service_module,
        "send_mfa_code",
        lambda to_email, code: sent.append((to_email, code)),
    )
    service = AuthService(
        FakeAuthRepository(),
        mfa_service=MFAService(redis=FakeMFARedis()),
        mfa_enabled=False,
    )

    result = await service.login("admin", "SecurePass1!")

    assert result is not None
    assert result.access_token != ""
    assert result.user.role == "admin"
    assert sent == []


@pytest.mark.asyncio
async def test_verify_mfa_correct_code_returns_tokens(monkeypatch):
    service, sent, _ = make_mfa_service(monkeypatch)

    challenge = await service.login("admin", "SecurePass1!")
    code = sent[0][1]

    result = await service.verify_mfa(challenge.mfa_token, code)

    assert result is not None
    assert result.access_token != ""
    assert result.user.role == "admin"


@pytest.mark.asyncio
async def test_verify_mfa_wrong_code_returns_none(monkeypatch):
    service, sent, _ = make_mfa_service(monkeypatch)

    challenge = await service.login("admin", "SecurePass1!")

    result = await service.verify_mfa(challenge.mfa_token, "000000")

    assert result is None


@pytest.mark.asyncio
async def test_verify_mfa_garbage_token_returns_none(monkeypatch):
    service, _, _r = make_mfa_service(monkeypatch)
    result = await service.verify_mfa("not.a.token", "123456")
    assert result is None


@pytest.mark.asyncio
async def test_verify_mfa_rejects_non_pending_token_type(monkeypatch):
    service, sent, _ = make_mfa_service(monkeypatch)

    ranger_login = await service.login("ranger", "SecurePass1!")
    result = await service.verify_mfa(ranger_login.access_token, "123456")

    assert result is None
    assert sent == []


@pytest.mark.asyncio
async def test_verify_mfa_code_is_single_use(monkeypatch):
    service, sent, _ = make_mfa_service(monkeypatch)
    challenge = await service.login("admin", "SecurePass1!")
    code = sent[0][1]

    first = await service.verify_mfa(challenge.mfa_token, code)
    second = await service.verify_mfa(challenge.mfa_token, code)

    assert first is not None
    assert second is None


@pytest.mark.asyncio
async def test_resend_mfa_respects_cooldown_right_after_login(monkeypatch):
    from fastapi import HTTPException

    service, sent, _ = make_mfa_service(monkeypatch)
    challenge = await service.login("admin", "SecurePass1!")

    with pytest.raises(HTTPException) as exc:
        await service.resend_mfa(challenge.mfa_token)

    assert exc.value.status_code == 429
    assert len(sent) == 1


@pytest.mark.asyncio
async def test_resend_mfa_sends_new_code_once_cooldown_clears(monkeypatch):
    service, sent, fake_redis = make_mfa_service(monkeypatch)
    challenge = await service.login("admin", "SecurePass1!")

    fake_redis.store.pop("mfa:resend_cooldown:user-003")

    ok = await service.resend_mfa(challenge.mfa_token)

    assert ok is True
    assert len(sent) == 2


@pytest.mark.asyncio
async def test_resend_mfa_invalid_token_returns_false(monkeypatch):
    service, _, _ = make_mfa_service(monkeypatch)
    ok = await service.resend_mfa("garbage")
    assert ok is False


# Refresh tests


@pytest.mark.asyncio
async def test_refresh_valid_token_returns_new_tokens():
    """Valid refresh token new access + refresh tokens."""
    service = make_service()

    login_result = await service.login("ranger", "SecurePass1!")
    assert login_result is not None

    refresh_result = await service.refresh(login_result.refresh_token)
    assert refresh_result is not None
    assert refresh_result.access_token != login_result.access_token


@pytest.mark.asyncio
async def test_refresh_rotates_token():
    """Each refresh issues a NEW refresh token and invalidates the old one."""
    service = make_service()

    login_result = await service.login("ranger", "SecurePass1!")
    old_refresh = login_result.refresh_token

    refresh_result = await service.refresh(old_refresh)
    assert refresh_result is not None

    second_refresh = await service.refresh(old_refresh)
    assert second_refresh is None


@pytest.mark.asyncio
async def test_refresh_invalid_token_returns_none():
    """Garbage token None (caller raises 401)."""
    service = make_service()
    result = await service.refresh("this.is.garbage")
    assert result is None


@pytest.mark.asyncio
async def test_refresh_access_token_as_refresh_returns_none():
    """Reject access tokens presented as refresh tokens."""
    service = make_service()
    login_result = await service.login("ranger", "SecurePass1!")
    result = await service.refresh(login_result.access_token)
    assert result is None


# Logout tests


@pytest.mark.asyncio
async def test_logout_revokes_refresh_token():
    """After logout the refresh token can no longer be used."""
    service = make_service()

    login_result = await service.login("ranger", "SecurePass1!")
    refresh_token = login_result.refresh_token

    await service.logout(refresh_token)

    result = await service.refresh(refresh_token)
    assert result is None


@pytest.mark.asyncio
async def test_logout_already_revoked_token_is_silent():
    """Logging out twice with the same token does not raise an error."""
    service = make_service()
    login_result = await service.login("ranger", "SecurePass1!")

    await service.logout(login_result.refresh_token)
    await service.logout(login_result.refresh_token)


# Register tests


@pytest.mark.asyncio
async def test_register_creates_inactive_user():
    """Successful registration returns a user with is_active=False."""
    from app.schemas.auth import RegisterRequest, RequestedRole

    service = AuthService(FakeRegisterRepository())

    req = RegisterRequest(
        username="newranger",
        email="newranger@savanna.com",
        password="SecurePass1!",
        first_name="New",
        last_name="Ranger",
        requested_role=RequestedRole.ranger,
    )
    user = await service.register(req)

    assert user.username == "newranger"
    assert user.email == "newranger@savanna.com"
    assert user.role == "ranger"
    assert user.is_active is False


@pytest.mark.asyncio
async def test_register_duplicate_email_raises_409():
    """Registration with an already-used email raises a 409 HTTPException."""
    from fastapi import HTTPException

    from app.schemas.auth import RegisterRequest, RequestedRole

    service = AuthService(FakeRegisterRepository(email_taken=True))

    req = RegisterRequest(
        username="uniqueuser",
        email="ranger@savanna.com",
        password="SecurePass1!",
        first_name="Unique",
        last_name="User",
        requested_role=RequestedRole.ranger,
    )
    with pytest.raises(HTTPException) as exc:
        await service.register(req)

    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_register_duplicate_username_raises_409():
    """Registration with an already-used username raises a 409 HTTPException."""
    from fastapi import HTTPException

    from app.schemas.auth import RegisterRequest, RequestedRole

    service = AuthService(FakeRegisterRepository(username_taken=True))

    req = RegisterRequest(
        username="ranger",
        email="brand.new@savanna.com",
        password="SecurePass1!",
        first_name="Brand",
        last_name="New",
        requested_role=RequestedRole.analyst,
    )
    with pytest.raises(HTTPException) as exc:
        await service.register(req)

    assert exc.value.status_code == 409


def test_register_short_password_raises_validation_error():
    """RegisterRequest rejects passwords shorter than 8 characters."""
    with pytest.raises(ValidationError):
        RegisterRequest(
            username="someone",
            email="someone@savanna.com",
            password="short",
            first_name="Some",
            last_name="One",
            requested_role=RequestedRole.ranger,
        )
