from sqlalchemy import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.comment import Comment


class CommentRepository:
    def __init__(self, db: AsyncSession):
        if db is None:
            raise ValueError(
                "CommentRepository needs an async database session",
            )
        self.db = db

    async def upload_comment(
        self, user, body, photo_urls, created_at, report_id
    ):
        stmt = insert(Comment).values(
            report_id=report_id,
            author_id=user,
            body=body,
            photo_urls=photo_urls,
            created_at=created_at,
        )

        await self.db.execute(stmt)
