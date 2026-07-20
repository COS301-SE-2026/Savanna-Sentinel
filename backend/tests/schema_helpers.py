"""Shared pydantic-schema builders reused across unit and integration tests."""

from app.schemas.audit import AuditLogFilterRequest


def audit_filter_req(**kwargs):
    defaults = {"page": 1, "page_size": 20}
    defaults.update(kwargs)
    return AuditLogFilterRequest(**defaults)
