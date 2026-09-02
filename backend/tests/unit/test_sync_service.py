from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

from fastapi import HTTPException

from app.services.sync_service import SyncService

_NOW = datetime.now(timezone.utc)
_LOCAL_ID = "aaaaaaaa-0000-0000-0000-000000000001"
_REPORT_ID = "bbbbbbbb-0000-0000-0000-000000000002"


def _ranger() -> SimpleNamespace:
    return SimpleNamespace(
        id="cccccccc-0000-0000-0000-000000000003",
        role="ranger",
        username="ranger1",
    )


def _entry(**overrides) -> dict:
    entry = {
        "local_id": _LOCAL_ID,
        "report_type": "incident",
        "location": {"lat": -24.2, "lon": 31.18},
        "occurred_at": _NOW.isoformat(),
        "description": "Snare found near the fence",
        "incident_type": "Snare Found",
        "severity": "low",
    }
    entry.update(overrides)
    return entry


def _existing(occurred_at=_NOW, deleted_at=None) -> dict:
    return {
        "report_id": _REPORT_ID,
        "report_type": "incident",
        "occurred_at": occurred_at,
        "deleted_at": deleted_at,
    }


def _make_service(existing=None):
    repo = AsyncMock()
    repo.find_sync_target.return_value = existing
    report_service = AsyncMock()
    report_service.create_report.return_value = {"report_id": _REPORT_ID}
    return SyncService(repo, report_service), repo, report_service


async def test_unknown_report_is_created():
    service, _, report_service = _make_service(existing=None)

    results = await service.sync_batch(_ranger(), [_entry()])

    assert results[0].status == "created"
    assert results[0].report_id == _REPORT_ID
    report_service.create_report.assert_awaited_once()


async def test_create_carries_local_id_as_client_id():
    service, _, report_service = _make_service(existing=None)

    await service.sync_batch(_ranger(), [_entry()])

    sent = report_service.create_report.await_args.args[1]
    assert sent.client_id == _LOCAL_ID


async def test_newer_record_wins():
    service, _, report_service = _make_service(
        existing=_existing(occurred_at=_NOW - timedelta(days=1)),
    )

    results = await service.sync_batch(_ranger(), [_entry()])

    assert results[0].status == "updated"
    assert results[0].report_id == _REPORT_ID
    report_service.update_report.assert_awaited_once()


async def test_older_record_loses_and_is_not_written():
    service, _, report_service = _make_service(
        existing=_existing(occurred_at=_NOW + timedelta(days=1)),
    )

    results = await service.sync_batch(_ranger(), [_entry()])

    assert results[0].status == "conflict"
    report_service.update_report.assert_not_awaited()


async def test_equal_timestamps_leave_the_server_copy_alone():
    service, _, report_service = _make_service(existing=_existing())

    results = await service.sync_batch(_ranger(), [_entry()])

    assert results[0].status == "conflict"
    report_service.update_report.assert_not_awaited()


async def test_naive_timestamp_is_compared_as_utc():
    service, _, report_service = _make_service(
        existing=_existing(occurred_at=_NOW - timedelta(days=1)),
    )
    naive = (_NOW.replace(tzinfo=None)).isoformat()

    results = await service.sync_batch(
        _ranger(),
        [_entry(occurred_at=naive)],
    )

    assert results[0].status == "updated"
    report_service.update_report.assert_awaited_once()


async def test_offline_delete_soft_deletes_the_server_record():
    service, repo, _ = _make_service(existing=_existing())

    results = await service.sync_batch(
        _ranger(),
        [_entry(deleted_at=_NOW.isoformat())],
    )

    assert results[0].status == "deleted"
    repo.soft_delete.assert_awaited_once_with(_REPORT_ID)


async def test_delete_of_a_draft_that_never_synced_is_not_an_error():
    service, repo, _ = _make_service(existing=None)

    results = await service.sync_batch(
        _ranger(),
        [_entry(deleted_at=_NOW.isoformat())],
    )

    assert results[0].status == "deleted"
    repo.soft_delete.assert_not_awaited()


async def test_delete_is_not_repeated_for_an_already_deleted_record():
    service, repo, _ = _make_service(existing=_existing(deleted_at=_NOW))

    results = await service.sync_batch(
        _ranger(),
        [_entry(deleted_at=_NOW.isoformat())],
    )

    assert results[0].status == "deleted"
    repo.soft_delete.assert_not_awaited()


async def test_non_object_entry_is_an_error():
    service, _, _ = _make_service()

    results = await service.sync_batch(_ranger(), ["not-an-object"])

    assert results[0].status == "error"


async def test_missing_local_id_is_an_error():
    service, _, _ = _make_service()
    entry = _entry()
    del entry["local_id"]

    results = await service.sync_batch(_ranger(), [entry])

    assert results[0].status == "error"
    assert "local_id" in results[0].message


async def test_non_uuid_local_id_never_reaches_the_database():
    service, repo, _ = _make_service()

    results = await service.sync_batch(
        _ranger(),
        [_entry(local_id="not-a-uuid")],
    )

    assert results[0].status == "error"
    assert results[0].message == "local_id must be a UUID"
    repo.find_sync_target.assert_not_awaited()


async def test_invalid_report_body_is_an_error():
    service, _, _ = _make_service()
    entry = _entry()
    del entry["report_type"]

    results = await service.sync_batch(_ranger(), [entry])

    assert results[0].status == "error"
    assert "report_type" in results[0].message


async def test_rejected_report_is_reported_not_raised():
    service, _, report_service = _make_service(existing=None)
    report_service.create_report.side_effect = HTTPException(
        status_code=422,
        detail="occurred_at cannot be in the future",
    )

    results = await service.sync_batch(_ranger(), [_entry()])

    assert results[0].status == "error"
    assert results[0].message == "occurred_at cannot be in the future"


async def test_one_bad_record_does_not_block_the_rest():
    service, _, report_service = _make_service(existing=None)
    good = _entry(local_id="dddddddd-0000-0000-0000-000000000004")

    results = await service.sync_batch(
        _ranger(),
        [_entry(local_id="not-a-uuid"), good],
    )

    assert [r.status for r in results] == ["error", "created"]
    report_service.create_report.assert_awaited_once()


async def test_every_entry_gets_a_result():
    service, _, _ = _make_service(existing=None)
    entries = [
        _entry(local_id="dddddddd-0000-0000-0000-00000000000%d" % i)
        for i in range(1, 4)
    ]

    results = await service.sync_batch(_ranger(), entries)

    assert len(results) == len(entries)
