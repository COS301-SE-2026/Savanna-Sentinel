from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.comment_repository import CommentRepository
from app.models.user import User
from app.schemas.report import PostCommentRequest


class CommentService:
    def __init__(
        self,
        db: AsyncSession,
    ):
        self.repo = CommentRepository(db)

    async def post_comment(
        self,
        report_id: str,
        user: User,
        payload: PostCommentRequest,
    ):
        await self.repo.upload_comment(
            report_id=report_id,
            author_id=user.id,
            body=payload.body,
            photo_urls=payload.photo_urls,
            created_at=payload.created_at,
            status=payload.status,
        )

    async def get_comments(self, report_id):
        return await self.repo.get_comments(report_id)
