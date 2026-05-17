"""Repository used by auth to resolve users and refresh tokens."""

from __future__ import annotations

from datetime import datetime, timezone
import uuid
from typing import Optional

from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import decode_token
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import RegisterRequest
from app.schemas.user import UsersRequest, UsersResponse


class UserRepository:
    """DB-backed repository for auth lookups and refresh-token persistence."""

    def __init__(self, db):
        if db is None:
            raise ValueError("UserRepository requires an async database session")
        self.db = db

    async def get_by_username(self, username: str) -> Optional[object]:
        """Return the matching user row by username only."""
        
        stmt = select(User).where(User.username == username)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def save_refresh_token(self, user_id: str, token: str) -> None:
        """Persist a refresh token in the refresh_tokens table."""
        
        payload = decode_token(token)
        self.db.add(
            RefreshToken(
                jti=uuid.UUID(payload["jti"]),
                user_id=uuid.UUID(str(user_id)),
                expires_at=datetime.fromtimestamp(int(payload["exp"]), tz=timezone.utc),
            )
        )
        await self.db.commit()

    async def get_user_by_refresh_token(self, token: str) -> Optional[object]:
        """Return the user that owns a valid refresh token."""
        
        payload = decode_token(token)
        stmt = (
            select(User)
            .join(RefreshToken, RefreshToken.user_id == User.id)
            .where(
                RefreshToken.jti == uuid.UUID(payload["jti"]),
                RefreshToken.revoked_at.is_(None),
                RefreshToken.expires_at > datetime.now(timezone.utc),
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def get_user_by_id(self, user_id: str) -> Optional[User]:
        stmt = select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def revoke_refresh_token(self, token: str) -> None:
        """Mark one refresh token as revoked."""
        
        payload = decode_token(token)
        stmt = update(RefreshToken).where(RefreshToken.jti == uuid.UUID(payload["jti"])).values(
            revoked_at=datetime.now(timezone.utc)
        )
        await self.db.execute(stmt)
        await self.db.commit()

    async def revoke_all_refresh_tokens(self, user_id: str) -> None:
        """Revoke every refresh token for a given user."""

        stmt = update(RefreshToken).where(RefreshToken.user_id == uuid.UUID(str(user_id))).values(
            revoked_at=datetime.now(timezone.utc)
        )
        await self.db.execute(stmt)
        await self.db.commit()

    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self.db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def create(self, req: RegisterRequest, hashed_password: str) -> User:
        user = User(
            username=req.username,
            email=req.email,
            first_name=req.first_name,
            last_name=req.last_name,
            hashed_password=hashed_password,
            role=req.requested_role.value,
            is_active=False,
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user
    async def get_users(self, req: UsersRequest ) -> list[UsersResponse]:
        stmt = select(User)

        if req.is_active is not None:
            stmt = stmt.where(User.is_active == req.is_active)
        
        if req.role is not None:
            stmt = stmt.where(User.role == req.role.value)

        offset = (req.page - 1) * req.page_size

        stmt = stmt.limit(req.page_size).offset(offset)

        result = await self.db.execute(stmt)

        return result.scalars().all()
    
    async def count_users(self, req: UsersRequest) -> int:
        stmt = select(func.count()).select_from(User)

        if req.is_active is not None:
            stmt = stmt.where(User.is_active == req.is_active)

        if req.role is not None:
            stmt = stmt.where(User.role == req.role.value)

        result = await self.db.execute(stmt)
        return result.scalar()
