<<<<<<< HEAD
from fastapi import HTTPException, status

from app.core.security import get_password_hash, verify_password
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import UpdateProfileRequest


class UserService:
	def __init__(self, repo: UserRepository):
		self.repo = repo

	async def get_me(self, user: User) -> User:
		return user

	async def update_me(self, user: User, body: UpdateProfileRequest) -> User:
		updated = False

		if body.first_name is not None:
			user.first_name = body.first_name
			updated = True

		if body.last_name is not None:
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
					detail="Current password is required when changing password",
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
=======
from app.schemas.user import UsersRequest, UsersResultResponse

class UserService:
    def __init__(self, repo):
        self.repo = repo

    async def get_users(self, req: UsersRequest):
        results = await self.repo.get_users(req)
        total_count = await self.repo.count_users(req)

        return UsersResultResponse(
            total=total_count,
            page=req.page,
            page_size=req.page_size,
            results=results
        )
    async def switch_status(self, is_active: bool, user_id: str):
        results = await self.repo.switch_status(is_active, user_id)

        if results is None:
            return None
        
        return results
    
    async def admin_delete(self, user_id: str):
        results = await self.repo.admin_delete(user_id)

        if results is None:
            return None
        
        return results

    async def change_role(self, user_id: str, new_role: str):
        result = await self.repo.update_role(user_id, new_role)
        return result
>>>>>>> dev
