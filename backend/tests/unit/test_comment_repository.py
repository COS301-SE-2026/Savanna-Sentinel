from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.comment import Comment
from app.repositories.comment_repository import CommentRepository

_NOW = datetime.now(timezone.utc)
_REPORT_ID = "aaaaaaaa-0000-0000-0000-000000000001"
_AUTHOR_ID = "bbbbbbbb-0000-0000-0000-000000000002"


@pytest.mark.asyncio
async def test_upload_comment_saves_comment_to_db():
    db = AsyncMock()
    db.add = MagicMock()
    repo = CommentRepository(db=db)

    comment = await repo.upload_comment(
        report_id=_REPORT_ID,
        author_id=_AUTHOR_ID,
        body="Test comment",
        photo_urls=["http://minio/bucket/reports/img1.jpg"],
        created_at=_NOW,
        status="unresolved",
    )

    db.add.assert_called_once()
    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once_with(comment)

    assert isinstance(comment, Comment)
    assert comment.report_id == _REPORT_ID
    assert comment.author_id == _AUTHOR_ID
    assert comment.body == "Test comment"
    assert comment.photo_urls == ["http://minio/bucket/reports/img1.jpg"]
    assert comment.created_at == _NOW
    assert comment.status_change == "unresolved"


@pytest.mark.asyncio
async def test_upload_comment_defaults_status_to_none():
    db = AsyncMock()
    db.add = MagicMock()
    repo = CommentRepository(db=db)

    comment = await repo.upload_comment(
        report_id=_REPORT_ID,
        author_id=_AUTHOR_ID,
        body="Test comment",
        photo_urls=["http://minio/bucket/reports/img1.jpg"],
        created_at=_NOW,
    )

    assert comment.status_change is None


