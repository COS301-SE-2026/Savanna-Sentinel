from fastapi import HTTPException, status

from app.core.security import get_password_hash, verify_password
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import (
    UpdateProfileRequest,
    UsersRequest,
    UsersResultResponse,
)
from app.services.audit_service import AuditService


class UserService:  # noqa: D101
    def __init__(self, repo: UserRepository, audit_service: AuditService | None = None):  # noqa: D107
        self.repo = repo
        self.audit_service = audit_service

    def get_me(self, user: User) -> User:  # noqa: D102
        return user

    async def update_me(self, user: User, body: UpdateProfileRequest) -> User:  # noqa: D102
        updated = False

        if body.first_name is not None:
            if body.first_name.strip() == "":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="First name cannot be empty",
                )
            user.first_name = body.first_name
            updated = True

        if body.last_name is not None:
            if body.last_name.strip() == "":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Last name cannot be empty",
                )
            user.last_name = body.last_name
            updated = True

        if body.new_password is not None:
            if len(body.new_password) < 8:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="New password must be at least 8 characters",
                )

            if not body.current_password:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Current password is required.",
                )

            if not verify_password(body.current_password, user.hashed_password):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Current password is incorrect",
                )

            user.hashed_password = get_password_hash(body.new_password)
            await self.repo.revoke_all_refresh_tokens(user.id)
            updated = True

        if not updated:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No updatable fields provided",
            )

        return await self.repo.save_user(user)

    async def get_users(self, req: UsersRequest):  # noqa: D102
        results = await self.repo.get_users(req)
        total_count = await self.repo.count_users(req)

        return UsersResultResponse(
            total=total_count,
            page=req.page,
            page_size=req.page_size,
            results=results,
        )

    async def switch_status(self, is_active: bool, user_id: str, actor_id: str | None = None):  # noqa: D102
        result = await self.repo.switch_status(is_active, user_id)

        if result is None:
            return None

        if self.audit_service and actor_id:
            action = "user.account_accepted" if is_active else "user.account_deactivated"
            await self.audit_service.log(
                actor_id=actor_id,
                action=action,
                target_type="user",
                target_id=user_id,
            )

        return result

    async def admin_delete(self, user_id: str):  # noqa: D102
        results = await self.repo.admin_delete(user_id)

        if results is None:
            return None

        return results

    async def change_role(self, user_id: str, new_role: str, actor_id: str | None = None):  # noqa: D102
        result = await self.repo.update_role(user_id, new_role)

        if result and self.audit_service and actor_id:
            await self.audit_service.log(
                actor_id=actor_id,
                action="user.role_changed",
                target_type="user",
                target_id=user_id,
                details={"new_role": new_role},
            )

        return result
