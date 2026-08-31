from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.schemas.report import PostCommentRequest
from app.services.comment_service import CommentService

_NOW = datetime.now(timezone.utc)
_REPORT_ID = "aaaaaaaa-0000-0000-0000-000000000001"
_AUTHOR_ID = "bbbbbbbb-0000-0000-0000-000000000002"


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
    author_id: str = _AUTHOR_ID,
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


@pytest.mark.asyncio
async def test_post_comment_returns_expected_structure():
    mock_comment = _fake_comment(status_change="unresolved")
    service = _make_comment_service(upload_result=mock_comment)

    result = await service.post_comment(
        _REPORT_ID,
        _ranger(),
        _comment_payload(),
    )

    assert result == {
        "id": mock_comment.id,
        "report_id": _REPORT_ID,
        "author_id": _AUTHOR_ID,
        "author_username": "ranger2",
        "body": mock_comment.body,
        "photo_urls": [],
        "status_change": "unresolved",
        "created_at": _NOW,
    }


@pytest.mark.asyncio
async def test_post_comment_transforms_urls():
    raw_urls = [
        "http://minio/bucket/comments/1.jpg",
        "http://minio/bucket/comments/2.jpg",
    ]
    mock_comment = _fake_comment(photo_urls=raw_urls)
    media_service = _make_media_service()
    service = _make_comment_service(
        upload_result=mock_comment,
        media_service=media_service,
    )

    result = await service.post_comment(
        _REPORT_ID,
        _ranger(),
        _comment_payload(),
    )

    assert media_service.generate_view_url.call_count == 2
    assert (
        result["photo_urls"][0] == "http://minio/bucket/comments/1.jpg?signed=1"
    )
    assert (
        result["photo_urls"][1] == "http://minio/bucket/comments/2.jpg?signed=1"
    )


@pytest.mark.asyncio
async def test_post_comment_handles_no_photos():
    mock_comment = _fake_comment(photo_urls=None)
    media_service = _make_media_service()
    service = _make_comment_service(
        upload_result=mock_comment,
        media_service=media_service,
    )

    result = await service.post_comment(
        _REPORT_ID,
        _ranger(),
        _comment_payload(),
    )

    media_service.generate_view_url.assert_not_called()
    assert result["photo_urls"] == []


@pytest.mark.asyncio
async def test_get_comments_calls_repo_and_returns_list():
    comments = [
        {
            "id": "c1",
            "body": "First comment",
            "photo_urls": [],
        },
        {
            "id": "c2",
            "body": "Second comment",
            "photo_urls": [],
        },
    ]

    service = _make_comment_service(get_comments_result=comments)
    result = await service.get_comments(_REPORT_ID)

    service.repo.get_comments.assert_called_once_with(_REPORT_ID)
    assert len(result) == 2
    assert result[0]["id"] == "c1"


@pytest.mark.asyncio
async def test_get_comments_transforms_photo_urls():
    comments = [
        {
            "id": "c1",
            "body": "First comment",
            "photo_urls": ["http://minio/bucket/comments/a.jpg"],
        },
        {
            "id": "c2",
            "body": "Second comment",
            "photo_urls": [],
        },
    ]

    media_service = _make_media_service()
    service = _make_comment_service(
        get_comments_result=comments,
        media_service=media_service,
    )

    result = await service.get_comments(_REPORT_ID)

    media_service.generate_view_url.assert_called_once_with(
        "http://minio/bucket/comments/a.jpg",
    )
    assert result[0]["photo_urls"] == [
        "http://minio/bucket/comments/a.jpg?signed=1",
    ]
    assert result[1]["photo_urls"] == []


@pytest.mark.asyncio
async def test_comment_handles_empty_photo_field():
    comments = [
        {
            "id": "c1",
            "body": "Legacy record missing key",
            "photo_urls": None,
        },
    ]

    media_service = _make_media_service()
    service = _make_comment_service(
        get_comments_result=comments,
        media_service=media_service,
    )

    result = await service.get_comments(_REPORT_ID)
    media_service.generate_view_url.assert_not_called()
    assert result[0]["photo_urls"] is None


@pytest.mark.asyncio
async def test_get_comments_returns_empty_list():
    service = _make_comment_service(get_comments_result=[])

    result = await service.get_comments(_REPORT_ID)
    assert result == []
