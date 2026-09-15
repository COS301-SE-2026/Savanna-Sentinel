from app.workers.ml.path_smoothing import chaikin_smooth


def test_chaikin_smooth_returns_empty_for_no_points():
    assert chaikin_smooth([]) == []


def test_chaikin_smooth_returns_a_single_point_unchanged():
    assert chaikin_smooth([(31.0, -24.0)]) == [(31.0, -24.0)]


def test_chaikin_smooth_does_not_duplicate_a_degenerate_point():
    """A start == end route must not smooth into a zero length linestring."""
    assert len(chaikin_smooth([(31.0, -24.0)], iterations=2)) == 1


def test_chaikin_smooth_keeps_the_endpoints():
    points = [(0.0, 0.0), (1.0, 1.0), (2.0, 0.0)]
    smoothed = chaikin_smooth(points, iterations=2)
    assert smoothed[0] == points[0]
    assert smoothed[-1] == points[-1]


def test_chaikin_smooth_adds_points_on_a_real_line():
    points = [(0.0, 0.0), (1.0, 1.0), (2.0, 0.0)]
    assert len(chaikin_smooth(points, iterations=1)) > len(points)


def test_chaikin_smooth_leaves_a_two_point_line_collinear():
    smoothed = chaikin_smooth([(0.0, 0.0), (2.0, 0.0)], iterations=2)
    assert all(y == 0.0 for _, y in smoothed)
