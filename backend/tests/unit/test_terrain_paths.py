import math

import pytest
from pyproj import Transformer

from app.workers.ml.terrain_paths import MAX_PATH_STEP_M, followable_lines
from app.workers.terrain.constants import DEFAULT_RULE, PREFER_MIN

EPSG = 32736
X0, Y0 = 300000.0, 7300000.0
_TO_LONLAT = Transformer.from_crs(f"EPSG:{EPSG}", "EPSG:4326", always_xy=True)


def _lonlat(x, y):
    return list(_TO_LONLAT.transform(x, y))


def _line(*points):
    return {
        "type": "LineString",
        "coordinates": [_lonlat(X0 + x, Y0 + y) for x, y in points],
    }


def _feature(feature_id, geometry):
    return {
        "id": feature_id,
        "geometry": geometry,
        "buffer_enabled": False,
        "buffer_distance_m": 100.0,
    }


def _rule(**overrides):
    return {**DEFAULT_RULE, **overrides}


def test_a_prefer_line_becomes_followable():
    features = [_feature("road", _line((0, 0), (1000, 0)))]
    resolved = {"road": {"prefer": _rule(strength=1.0)}}

    (line,) = followable_lines(features, resolved, EPSG)

    assert line.feature_id == "road"
    assert line.multiplier == pytest.approx(PREFER_MIN)
    (part,) = line.parts
    assert part[0][0] == pytest.approx((X0, Y0))
    assert part[-1][0] == pytest.approx((X0 + 1000, Y0))


def test_strength_scales_the_discount():
    features = [_feature("path", _line((0, 0), (100, 0)))]
    resolved = {"path": {"prefer": _rule(strength=0.5)}}

    (line,) = followable_lines(features, resolved, EPSG)

    assert line.multiplier == pytest.approx(1 - (1 - PREFER_MIN) * 0.5)


def test_long_segments_are_split_into_short_steps():
    features = [_feature("road", _line((0, 0), (1000, 0)))]
    resolved = {"road": {"prefer": _rule()}}

    (line,) = followable_lines(features, resolved, EPSG)
    points = [xy for xy, _ in line.parts[0]]

    assert len(points) >= 5
    assert all(
        math.dist(a, b) <= MAX_PATH_STEP_M + 1e-6
        for a, b in zip(points, points[1:])
    )


def test_each_point_carries_its_lon_lat():
    features = [_feature("road", _line((0, 0), (200, 0)))]
    resolved = {"road": {"prefer": _rule()}}

    (line,) = followable_lines(features, resolved, EPSG)

    for xy, lonlat in line.parts[0]:
        assert lonlat == pytest.approx(tuple(_lonlat(*xy)))


def test_a_higher_priority_avoid_rule_wins():
    features = [_feature("road", _line((0, 0), (100, 0)))]
    resolved = {
        "road": {
            "prefer": _rule(priority=1),
            "avoid": _rule(priority=2),
        },
    }

    assert followable_lines(features, resolved, EPSG) == []


def test_an_equal_priority_avoid_rule_does_not_stop_following():
    features = [_feature("road", _line((0, 0), (100, 0)))]
    resolved = {
        "road": {
            "prefer": _rule(priority=2),
            "avoid": _rule(priority=2),
        },
    }

    assert len(followable_lines(features, resolved, EPSG)) == 1


def test_lines_without_a_prefer_rule_are_ignored():
    features = [
        _feature("river", _line((0, 0), (100, 0))),
        _feature("track", _line((0, 50), (100, 50))),
    ]
    resolved = {"river": {"avoid": _rule(strength=1.0)}}

    assert followable_lines(features, resolved, EPSG) == []


def test_points_and_polygons_are_not_followable():
    features = [
        _feature(
            "camp",
            {"type": "Point", "coordinates": _lonlat(X0, Y0)},
        ),
        _feature(
            "zone",
            {
                "type": "Polygon",
                "coordinates": [
                    [
                        _lonlat(X0, Y0),
                        _lonlat(X0 + 100, Y0),
                        _lonlat(X0 + 100, Y0 + 100),
                        _lonlat(X0, Y0),
                    ],
                ],
            },
        ),
    ]
    resolved = {
        "camp": {"prefer": _rule()},
        "zone": {"prefer": _rule()},
    }

    assert followable_lines(features, resolved, EPSG) == []


def test_each_part_of_a_multi_line_is_kept():
    features = [
        _feature(
            "tracks",
            {
                "type": "MultiLineString",
                "coordinates": [
                    _line((0, 0), (100, 0))["coordinates"],
                    _line((0, 500), (100, 500))["coordinates"],
                ],
            },
        ),
    ]
    resolved = {"tracks": {"prefer": _rule()}}

    (line,) = followable_lines(features, resolved, EPSG)

    assert len(line.parts) == 2
