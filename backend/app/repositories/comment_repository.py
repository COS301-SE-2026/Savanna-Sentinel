from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.comment import Comment
from app.models.user import User


class CommentRepository:
    def __init__(self, db: AsyncSession):
        if db is None:
            raise ValueError(
                "CommentRepository needs an async database session",
            )
        self.db = db

    async def upload_comment(
        self,
        report_id: str,
        author_id: str,
        body: str,
        photo_urls: list[str],
        created_at: datetime,
        status: Optional[str] = None,
    ) -> Comment:

        comment = Comment(
            report_id=report_id,
            author_id=author_id,
            body=body,
            photo_urls=photo_urls,
            created_at=created_at,
            status_change=status,
        )
        self.db.add(comment)
        await self.db.commit()
        await self.db.refresh(comment)
        return comment

    async def get_comments(self, report_id):
        stmt = (
            select(Comment, User.username.label("author_username"))
            .join(User, Comment.author_id == User.id)
            .where(
                Comment.report_id == report_id,
            )
            .order_by(Comment.created_at.asc())
        )

        result = await self.db.execute(stmt)
        rows = result.all()

        return [
            {
                **comment.__dict__,
                "author_username": author_username,
            }
            for comment, author_username in rows
        ]
