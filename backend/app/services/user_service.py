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
