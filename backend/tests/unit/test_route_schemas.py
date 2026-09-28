import pytest
from pydantic import ValidationError

from app.schemas.geo import GeoPoint
from app.schemas.route import (
    MAX_NUM_ALTERNATIVES,
    MAX_WAYPOINTS,
    RouteRequest,
)

_STOP = GeoPoint(coordinates=(31.06, -24.25))


def _make_request(**overrides):
    fields = {
        "start_point": GeoPoint(coordinates=(31.05, -24.3)),
        "end_point": GeoPoint(coordinates=(31.1, -24.2)),
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


def test_risk_by_cell_defaults_to_empty_dict():
    request = _make_request()
    assert request.risk_by_cell == {}


def test_risk_by_cell_accepts_valid_scores():
    request = _make_request(
        risk_by_cell={"cell-1": 0.0, "cell-2": 0.5, "cell-3": 1.0},
    )
    assert request.risk_by_cell == {"cell-1": 0.0, "cell-2": 0.5, "cell-3": 1.0}


def test_risk_by_cell_clamps_out_of_range_scores():
    request = _make_request(risk_by_cell={"cell-1": -0.4, "cell-2": 1.7})
    assert request.risk_by_cell == {"cell-1": 0.0, "cell-2": 1.0}


def test_waypoints_default_to_empty_list():
    assert _make_request().waypoints == []


def test_waypoints_accept_max_allowed():
    request = _make_request(waypoints=[_STOP] * MAX_WAYPOINTS)
    assert len(request.waypoints) == MAX_WAYPOINTS


def test_waypoints_above_max_are_rejected():
    with pytest.raises(ValidationError):
        _make_request(waypoints=[_STOP] * (MAX_WAYPOINTS + 1))


def test_waypoints_keep_their_order():
    first = GeoPoint(coordinates=(31.06, -24.25))
    second = GeoPoint(coordinates=(31.07, -24.26))
    request = _make_request(waypoints=[first, second])
    assert request.waypoints == [first, second]
