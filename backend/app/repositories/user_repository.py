"""Repository used by auth to resolve users and refresh tokens."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional

from sqlalchemy import delete, func, select, update

from app.core.security import JWTError, decode_token
from app.models.refresh_token import RefreshToken
from app.models.user import User

if TYPE_CHECKING:
    from app.schemas.auth import RegisterRequest
    from app.schemas.user import UsersRequest, UsersResponse


class UserRepository:
    """DB-backed repository for auth lookups and refresh-token persistence."""

    def __init__(self, db):
        if db is None:
            raise ValueError("UserRepository needs an async database session")
        self.db = db

    async def get_by_username(self, username: str) -> Optional[object]:
        """Return the matching user row by username only."""
        stmt = select(User).where(User.username == username)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_id(self, user_id: str) -> Optional[User]:
        """Return the matching user row by primary key."""
        stmt = select(User).where(User.id == str(user_id))
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def save_refresh_token(self, user_id: str, token: str) -> None:
        """Persist a refresh token in the refresh_tokens table."""
        payload = decode_token(token)
        self.db.add(
            RefreshToken(
                jti=uuid.UUID(payload["jti"]),
                user_id=uuid.UUID(str(user_id)),
                expires_at=datetime.fromtimestamp(
                    int(payload["exp"]),
                    tz=timezone.utc,
                ),
            ),
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
        try:
            payload = decode_token(token)
        except JWTError:
            return
        stmt = (
            update(
                RefreshToken,
            )
            .where(
                RefreshToken.jti == uuid.UUID(payload["jti"]),
            )
            .values(
                revoked_at=datetime.now(timezone.utc),
            )
        )
        await self.db.execute(stmt)
        await self.db.commit()

    async def revoke_all_refresh_tokens(self, user_id: str) -> None:
        """Revoke every refresh token for a given user."""
        stmt = (
            update(RefreshToken)
            .where(
                RefreshToken.user_id == uuid.UUID(str(user_id)),
            )
            .values(
                revoked_at=datetime.now(timezone.utc),
            )
        )
        await self.db.execute(stmt)
        await self.db.commit()

    async def get_by_email(self, email: str) -> Optional[User]:
        stmt = select(User).where(User.email == email)
        result = await self.db.execute(stmt)
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

    async def save_user(self, user: User) -> User:
        """Persist an in-memory user instance and refresh it from the DB."""
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def get_users(self, req: UsersRequest) -> list[UsersResponse]:
        stmt = select(User).where(
            User.role != "admin",
            User.deleted_at.is_(None),
        )

        if req.is_active is not None:
            stmt = stmt.where(User.is_active == req.is_active)

        if req.role is not None:
            stmt = stmt.where(User.role == req.role.value)

        if req.search is not None:
            stmt = stmt.where(User.username.ilike(f"%{req.search}%"))

        offset = (req.page - 1) * req.page_size

        stmt = stmt.limit(req.page_size).offset(offset)

        result = await self.db.execute(stmt)

        return result.scalars().all()

    async def count_users(self, req: UsersRequest) -> int:
        stmt = (
            select(func.count())
            .select_from(User)
            .where(User.role != "admin", User.deleted_at.is_(None))
        )

        if req.is_active is not None:
            stmt = stmt.where(User.is_active == req.is_active)

        if req.role is not None:
            stmt = stmt.where(User.role == req.role.value)

        result = await self.db.execute(stmt)
        return result.scalar()

    async def switch_status(
        self,
        is_active: bool,
        user_id: str,
    ) -> UsersResponse:
        stmt = select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user or user.deleted_at is not None:
            return None

        user.is_active = is_active

        await self.db.commit()
        await self.db.refresh(user)

        return user

    async def admin_delete(self, user_id: str) -> UsersResponse:
        stmt = select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user or user.is_active or user.deleted_at is not None:
            return None

        del_stmt = delete(User).where(User.id == user_id)
        await self.db.execute(del_stmt)

        await self.db.commit()

        return user

    async def update_role(self, user_id: str, new_role: str) -> Optional[User]:
        stmt = select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            return None

        user.role = new_role
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def soft_delete_user(self, user_id: str) -> Optional[User]:
        stmt = select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user or not user.is_active or user.deleted_at is not None:
            return None

        user.is_active = False
        user.deleted_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(user)
        return user
