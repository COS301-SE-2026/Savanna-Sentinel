from sqlalchemy.ext.asyncio import AsyncSession


class CommentRepository:
    def __init__(self, db: AsyncSession):
        if db is None:
            raise ValueError(
                "CommentRepository needs an async database session",
            )
        self.db = db
