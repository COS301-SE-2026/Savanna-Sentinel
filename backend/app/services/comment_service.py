from app.repositories.comment_repository import CommentRepository


class CommentService:
    def __init__(
        self,
        repo: CommentRepository,
    ):
        self.repo = repo

    async def post_comment(
        self,
        user,
        body,
        photo_urls,
        created_at,
        report_id,
        status,
    ):
        await self.repo.upload_comment(
            user,
            body,
            photo_urls,
            created_at,
            report_id,
            status,
        )

    async def get_comments(self, report_id):
        return await self.repo.get_comments(report_id)
