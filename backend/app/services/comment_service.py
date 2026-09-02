from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.repositories.comment_repository import CommentRepository
from app.schemas.report import PostCommentRequest
from app.services.media_service import MediaService


class CommentService:
    def __init__(
        self,
        db: AsyncSession,
    ):
        self.repo = CommentRepository(db)
        self.media_service = MediaService()

    async def post_comment(
        self,
        report_id: str,
        user: User,
        payload: PostCommentRequest,
    ):
        comment = await self.repo.upload_comment(
            report_id=report_id,
            author_id=user.id,
            body=payload.body,
            photo_urls=payload.photo_urls,
            created_at=payload.created_at,
            status=payload.status,
        )

        photo_urls = comment.photo_urls or []
        if photo_urls:
            photo_urls = [
                self.media_service.generate_view_url(url) for url in photo_urls
            ]

        return {
            "id": comment.id,
            "report_id": comment.report_id,
            "author_id": comment.author_id,
            "author_username": user.username,
            "body": comment.body,
            "photo_urls": photo_urls,
            "status_change": comment.status_change,
            "created_at": comment.created_at,
        }

    async def get_comments(self, report_id):
        comments = await self.repo.get_comments(report_id)

        for comment in comments:
            photo_urls = comment.get("photo_urls") or []
            if photo_urls:
                comment["photo_urls"] = [
                    self.media_service.generate_view_url(url)
                    for url in photo_urls
                ]

        return comments
