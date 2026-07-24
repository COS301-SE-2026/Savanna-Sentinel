import pytest
from pydantic import ValidationError

from app.schemas.geo import GeoPoint
from app.schemas.route import MAX_NUM_ALTERNATIVES, RouteRequest


def _make_request(**overrides):
    fields = {
        "park_id": "klaserie",
        "start_point": GeoPoint(coordinates=(31.05, -24.3)),
        "end_point": GeoPoint(coordinates=(31.1, -24.2)),
        "max_time": 120.0,
        "max_fuel": 10.0,
        **overrides,
    }
    return RouteRequest(**fields)


def test_num_alternatives_defaults_to_three():
    request = _make_request()
    assert request.num_alternatives == 3


def test_num_alternatives_accepts_max_allowed_value():
    request = _make_request(num_alternatives=MAX_NUM_ALTERNATIVES)
    assert request.num_alternatives == MAX_NUM_ALTERNATIVES


def test_num_alternatives_above_max_is_rejected():
    """Reject requests above MAX_NUM_ALTERNATIVES up front.

    plan_routes() can never return more alternatives than that, so a
    higher request should be rejected, not silently truncated.
    """
    with pytest.raises(ValidationError):
        _make_request(num_alternatives=MAX_NUM_ALTERNATIVES + 1)


def test_num_alternatives_below_one_is_rejected():
    with pytest.raises(ValidationError):
        _make_request(num_alternatives=0)
