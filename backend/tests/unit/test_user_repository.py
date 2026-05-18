"""Unit tests for UserRepository."""

from unittest.mock import AsyncMock

import pytest

from app.core.security import JWTError
from app.repositories.user_repository import UserRepository
import app.repositories.user_repository as user_repository


@pytest.mark.asyncio
async def test_revoke_refresh_token_invalid_token_is_silent(monkeypatch):
    db = AsyncMock()
    repo = UserRepository(db)

    def _raise(_token: str):
        raise JWTError()

    monkeypatch.setattr(user_repository, "decode_token", _raise)

    await repo.revoke_refresh_token("not-a-valid-token")

    db.execute.assert_not_called()
    db.commit.assert_not_called()