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

