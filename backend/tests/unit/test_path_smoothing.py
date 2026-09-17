import pytest

from app.workers.ml.path_smoothing import round_corners, simplify, smooth_route


def test_smooth_route_returns_empty_for_no_points():
    assert smooth_route([], 0.5) == []


def test_smooth_route_returns_a_single_point_unchanged():
    assert smooth_route([(31.0, -24.0)], 0.5) == [(31.0, -24.0)]


def test_smooth_route_keeps_the_endpoints():
    points = [(0.0, 0.0), (1.0, 1.0), (2.0, 0.0)]
    smoothed = smooth_route(points, 0.1)
    assert smoothed[0] == points[0]
    assert smoothed[-1] == pytest.approx(points[-1])


def test_smooth_route_leaves_a_two_point_line_straight():
    smoothed = smooth_route([(0.0, 0.0), (2.0, 0.0)], 0.1)
    assert all(y == 0.0 for _, y in smoothed)


def test_simplify_straightens_a_grid_staircase():
    staircase = [(0, 0), (1, 0), (1, 1), (2, 1), (2, 2), (3, 2), (3, 3)]
    assert simplify(staircase, 0.75) == [(0, 0), (3, 3)]


def test_simplify_keeps_a_real_corner():
    corner = [(0, 0), (1, 0), (2, 0), (2, 1), (2, 2)]
    assert simplify(corner, 0.5) == [(0, 0), (2, 0), (2, 2)]


def test_simplify_keeps_the_tip_of_an_out_and_back():
    spur = [(0, 0), (1, 0), (2, 0), (3, 0), (2, 0), (1, 0), (0, 0), (0, 1)]
    assert (3, 0) in simplify(spur, 0.5)


def test_simplify_with_no_tolerance_changes_nothing():
    points = [(0, 0), (1, 0), (1, 1)]
    assert simplify(points, 0.0) == points


def test_round_corners_stays_inside_the_corner():
    points = [(0.0, 0.0), (10.0, 0.0), (10.0, 10.0)]
    curve = round_corners(points, radius=2.0)
    assert all(0.0 <= x <= 10.0 and 0.0 <= y <= 10.0 for x, y in curve)


def test_round_corners_starts_and_ends_the_curve_radius_away():
    points = [(0.0, 0.0), (10.0, 0.0), (10.0, 10.0)]
    curve = round_corners(points, radius=2.0, samples=4)
    assert curve[1] == pytest.approx((8.0, 0.0))
    assert curve[5] == pytest.approx((10.0, 2.0))


def test_round_corners_shrinks_the_radius_on_short_legs():
    points = [(0.0, 0.0), (1.0, 0.0), (1.0, 10.0)]
    curve = round_corners(points, radius=5.0, samples=4)
    assert curve[1] == pytest.approx((0.5, 0.0))


def test_round_corners_leaves_a_straight_line_alone():
    points = [(0.0, 0.0), (1.0, 0.0)]
    assert round_corners(points, radius=1.0) == points
