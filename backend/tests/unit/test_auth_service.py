"""
Unit tests for AuthService

These tests call AuthService directly without starting an HTTP server
The in memory stub repository is used no database connection needed
"""

import pytest
from app.services.auth_service import AuthService

# Helpers

def make_service() -> AuthService:
    """Return a fresh AuthService backed by the in memory stub."""
    return AuthService(db=None)


# Login tests

@pytest.mark.asyncio
async def test_login_valid_active_user_returns_tokens():
    """correct credentials for an active user → both tokens returned."""
    service = make_service()
    result = await service.login("ranger", "SecurePass1!")

    assert result is not None
    assert result.access_token != ""
    assert result.refresh_token != ""
    assert result.token_type == "bearer"
    assert result.expires_in == 3600


@pytest.mark.asyncio
async def test_login_wrong_password_returns_none():
    """wrong password None (caller raises vague 401)."""
    service = make_service()
    result = await service.login("ranger", "WrongPassword!")
    assert result is None


@pytest.mark.asyncio
async def test_login_unknown_email_returns_none():
    """unknown username None, same as wrong password (no enumeration)."""
    service = make_service()
    result = await service.login("ghost", "AnyPassword1!")
    assert result is None


@pytest.mark.asyncio
async def test_login_inactive_account_returns_none():
    """inactive account None (same vague 401, no enumeration)."""
    service = make_service()
    result = await service.login("inactive", "SecurePass1!")
    assert result is None


#Refresh tests

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

    # The old token must now be invalid (revoked)
    second_refresh = await service.refresh(old_refresh)
    assert second_refresh is None


@pytest.mark.asyncio
async def test_refresh_invalid_token_returns_none():
    """garbage token None (caller raises 401)."""
    service = make_service()
    result = await service.refresh("this.is.garbage")
    assert result is None


@pytest.mark.asyncio
async def test_refresh_access_token_as_refresh_returns_none():
    """Reject access tokens presented as refresh tokens."""
    service = make_service()
    login_result = await service.login("ranger", "SecurePass1!")
    # Use the access token where a refresh token is expected
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

    # Token must now be invalid
    result = await service.refresh(refresh_token)
    assert result is None


@pytest.mark.asyncio
async def test_logout_already_revoked_token_is_silent():
    """Logging out twice with the same token does not raise an error."""
    service = make_service()
    login_result = await service.login("ranger@savana.test", "SecurePass1!")

    await service.logout(login_result.refresh_token)
    # Should not raise
    await service.logout(login_result.refresh_token)