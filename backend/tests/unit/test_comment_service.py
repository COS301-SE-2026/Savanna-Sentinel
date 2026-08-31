from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.schemas.report import PostCommentRequest
from app.services.comment_service import CommentService

_NOW = datetime.now(timezone.utc)
_REPORT_ID = "aaaaaaaa-0000-0000-0000-000000000001"


def _ranger(
    user_id: str = "bbbbbbbb-0000-0000-0000-000000000002",
    username: str = "ranger2",
) -> SimpleNamespace:
    return SimpleNamespace(id=user_id, role="ranger", username=username)


def _make_media_service():
    media_service = MagicMock()
    media_service.generate_view_url.side_effect = lambda url: f"{url}?signed=1"
    return media_service


def _comment_payload(**overrides) -> PostCommentRequest:
    defaults = dict(
        body="Spotted track nearby",
        photo_urls=[],
        created_at=_NOW,
        status=None,
    )
    defaults.update(overrides)
    return PostCommentRequest(**defaults)


def _make_comment_service(
    upload_result=None,
    get_comments_result=None,
    media_service=None,
):
    service = CommentService(db=AsyncMock())
    service.repo = AsyncMock()

    if upload_result is not None:
        service.repo.upload_comment.return_value = upload_result
    if get_comments_result is not None:
        service.repo.get_comments.return_value = get_comments_result

    service.media_service = media_service or _make_media_service()
    return service


def _fake_comment(
    comment_id: str = "cccccccc-0000-0000-0000-000000000001",
    report_id: str = _REPORT_ID,
    author_id: str = "bbbbbbbb-0000-0000-0000-000000000002",
    body: str = "Test comment body",
    photo_urls: list[str] | None = None,
    status_change: str | None = None,
    created_at: datetime = _NOW,
) -> SimpleNamespace:
    return SimpleNamespace(
        id=comment_id,
        report_id=report_id,
        author_id=author_id,
        body=body,
        photo_urls=photo_urls or [],
        status_change=status_change,
        created_at=created_at,
    )


@pytest.mark.asyncio
async def test_post_comment_calls_repo():
    mock_comment = _fake_comment()
    service = _make_comment_service(upload_result=mock_comment)
    payload = _comment_payload(
        body="Test comment body",
        photo_urls=["http://minio/bucket/reports/img1.jpg"],
        status="resolved",
    )
    ranger = _ranger()

    await service.post_comment(_REPORT_ID, ranger, payload)

    service.repo.upload_comment.assert_called_once_with(
        report_id=_REPORT_ID,
        author_id=ranger.id,
        body="Test comment body",
        photo_urls=["http://minio/bucket/reports/img1.jpg"],
        created_at=_NOW,
        status="resolved",
    )
