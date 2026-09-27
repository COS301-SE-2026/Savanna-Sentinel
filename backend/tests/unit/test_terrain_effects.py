import pytest
from pyproj import Transformer
from shapely.geometry import Point, box

from app.workers.terrain.constants import (
    AVOID_MAX,
    DEFAULT_RULE,
    MAX_RISK_DELTA,
    PREFER_MIN,
    ROUTE_MULT_MAX,
)
from app.workers.terrain.effects import (
    RuleReach,
    combine_cell,
    compute_cell_effects,
    rule_weight,
)

EPSG = 32736
X0, Y0, SIZE = 300000.0, 7300000.0, 1000.0
_TO_LONLAT = Transformer.from_crs(f"EPSG:{EPSG}", "EPSG:4326", always_xy=True)


def _cells(rows=5, cols=5):
    return [
        (
            f"cell-{row * cols + col}",
            box(
                X0 + col * SIZE,
                Y0 + row * SIZE,
                X0 + (col + 1) * SIZE,
                Y0 + (row + 1) * SIZE,
            ),
        )
        for row in range(rows)
        for col in range(cols)
    ]


def _ref(row, col):
    return f"cell-{row * 5 + col}"


def _lonlat(x, y):
    return list(_TO_LONLAT.transform(x, y))


def _centre(row, col):
    return X0 + (col + 0.5) * SIZE, Y0 + (row + 0.5) * SIZE


def _point(row, col):
    return {"type": "Point", "coordinates": _lonlat(*_centre(row, col))}


def _line(points_xy):
    return {
        "type": "LineString",
        "coordinates": [_lonlat(x, y) for x, y in points_xy],
    }


def _polygon(points_xy):
    ring = [_lonlat(x, y) for x, y in points_xy]
    ring.append(ring[0])
    return {"type": "Polygon", "coordinates": [ring]}


def _feature(feature_id, geometry, buffer_m=None):
    return {
        "id": feature_id,
        "geometry": geometry,
        "buffer_enabled": buffer_m is not None,
        "buffer_distance_m": buffer_m if buffer_m is not None else 100.0,
    }


def _rule(**overrides):
    return {**DEFAULT_RULE, **overrides}


def _compute(features, resolved):
    return compute_cell_effects(_cells(), EPSG, features, resolved)


def test_a_point_rule_covers_only_its_own_cell():
    effects = _compute(
        [_feature("tree", _point(2, 2))],
        {"tree": {"increase_risk": _rule(strength=1.0)}},
    )

    assert list(effects) == [_ref(2, 2)]
    assert effects[_ref(2, 2)]["risk_delta"] == pytest.approx(MAX_RISK_DELTA)
    assert effects[_ref(2, 2)]["route_multiplier"] == 1.0


def test_strength_scales_the_effect():
    effects = _compute(
        [_feature("tree", _point(2, 2))],
        {"tree": {"decrease_risk": _rule(strength=0.5)}},
    )

    assert effects[_ref(2, 2)]["risk_delta"] == pytest.approx(
        -0.5 * MAX_RISK_DELTA,
    )


def test_a_line_covers_every_cell_it_crosses():
    river = _line([(X0, Y0 + 2.5 * SIZE), (X0 + 5 * SIZE, Y0 + 2.5 * SIZE)])

    effects = _compute(
        [_feature("river", river)],
        {"river": {"increase_risk": _rule(strength=1.0)}},
    )

    assert set(effects) == {_ref(2, col) for col in range(5)}


def test_a_polygon_covers_every_cell_it_overlaps():
    zone = _polygon(
        [
            (X0 + 1.5 * SIZE, Y0 + 1.5 * SIZE),
            (X0 + 3.5 * SIZE, Y0 + 1.5 * SIZE),
            (X0 + 3.5 * SIZE, Y0 + 3.5 * SIZE),
            (X0 + 1.5 * SIZE, Y0 + 3.5 * SIZE),
        ],
    )

    effects = _compute(
        [_feature("zone", zone)],
        {"zone": {"avoid": _rule(strength=1.0)}},
    )

    assert len(effects) == 9
    assert all(
        e["route_multiplier"] == pytest.approx(AVOID_MAX)
        for e in effects.values()
    )


def test_a_flat_buffer_reaches_the_neighbouring_cells_at_full_weight():
    effects = _compute(
        [_feature("tower", _point(2, 2), buffer_m=1400.0)],
        {"tower": {"decrease_risk": _rule(strength=1.0, buffer_decay=0.0)}},
    )

    assert len(effects) == 9
    assert all(
        e["risk_delta"] == pytest.approx(-MAX_RISK_DELTA)
        for e in effects.values()
    )


def test_a_decaying_buffer_fades_with_distance():
    effects = _compute(
        [_feature("tower", _point(2, 2), buffer_m=1400.0)],
        {"tower": {"decrease_risk": _rule(strength=1.0, buffer_decay=1.0)}},
    )

    own = effects[_ref(2, 2)]["risk_delta"]
    orthogonal = effects[_ref(2, 3)]["risk_delta"]
    diagonal = effects[_ref(3, 3)]["risk_delta"]
    assert own == pytest.approx(-MAX_RISK_DELTA)
    assert orthogonal == pytest.approx(-MAX_RISK_DELTA * (1 - 500 / 1400))
    assert diagonal == pytest.approx(
        -MAX_RISK_DELTA * (1 - (500 * 2**0.5) / 1400),
    )


def test_the_buffer_is_ignored_when_it_is_not_enabled():
    feature = _feature("tower", _point(2, 2))
    feature["buffer_distance_m"] = 5000.0

    effects = _compute(
        [feature],
        {"tower": {"decrease_risk": _rule(strength=1.0)}},
    )

    assert list(effects) == [_ref(2, 2)]


def test_a_rule_at_the_very_edge_of_a_full_decay_buffer_does_not_reach():
    footprint = Point(0.0, 0.0)
    cell = box(1000.0, -500.0, 2000.0, 500.0)

    weight = rule_weight(
        cell,
        footprint,
        footprint.buffer(1000.0),
        1000.0,
        _rule(strength=1.0, buffer_decay=1.0),
    )

    assert weight == 0.0


def test_a_cell_outside_the_footprint_and_buffer_is_not_reached():
    footprint = Point(0.0, 0.0)
    cell = box(5000.0, 5000.0, 6000.0, 6000.0)

    assert (
        rule_weight(cell, footprint, footprint.buffer(100.0), 100.0, _rule())
        == 0.0
    )


def test_equal_priority_opposing_risk_rules_net_to_nothing_and_are_omitted():
    effects = _compute(
        [_feature("tower", _point(2, 2))],
        {
            "tower": {
                "increase_risk": _rule(strength=0.5),
                "decrease_risk": _rule(strength=0.5),
            },
        },
    )

    assert effects == {}


def test_the_higher_priority_risk_rule_wins_alone():
    effects = _compute(
        [_feature("tower", _point(2, 2))],
        {
            "tower": {
                "increase_risk": _rule(strength=0.5),
                "decrease_risk": _rule(strength=0.5, priority=2),
            },
        },
    )

    assert effects[_ref(2, 2)]["risk_delta"] == pytest.approx(
        -0.5 * MAX_RISK_DELTA,
    )


def test_risk_and_route_rules_on_the_same_cell_do_not_interact():
    effects = _compute(
        [_feature("den", _point(2, 2))],
        {
            "den": {
                "increase_risk": _rule(strength=1.0, priority=1),
                "avoid": _rule(strength=1.0, priority=9),
            },
        },
    )

    assert effects[_ref(2, 2)]["risk_delta"] == pytest.approx(MAX_RISK_DELTA)
    assert effects[_ref(2, 2)]["route_multiplier"] == pytest.approx(AVOID_MAX)


def test_a_prefer_rule_lowers_the_route_multiplier():
    effects = _compute(
        [_feature("road", _point(1, 1))],
        {"road": {"prefer": _rule(strength=1.0)}},
    )

    assert effects[_ref(1, 1)]["route_multiplier"] == pytest.approx(PREFER_MIN)


def test_stacked_avoid_rules_are_clamped():
    effects = _compute(
        [_feature("a", _point(2, 2)), _feature("b", _point(2, 2))],
        {
            "a": {"avoid": _rule(strength=1.0)},
            "b": {"avoid": _rule(strength=1.0)},
        },
    )

    assert effects[_ref(2, 2)]["route_multiplier"] == ROUTE_MULT_MAX


def test_features_without_resolved_rules_are_ignored():
    assert _compute([_feature("x", _point(2, 2))], {}) == {}


def test_combine_cell_returns_none_when_both_families_are_neutral():
    assert combine_cell([]) is None


def test_combine_cell_keeps_priority_inside_each_family_only():
    combined = combine_cell(
        [
            RuleReach("increase_risk", 1, 1.0),
            RuleReach("decrease_risk", 3, 0.5),
            RuleReach("avoid", 1, 1.0),
        ],
    )

    assert combined["risk_delta"] == pytest.approx(-0.5 * MAX_RISK_DELTA)
    assert combined["route_multiplier"] == pytest.approx(AVOID_MAX)


class TestBridgeAndFlood:
    river = _line([(X0, Y0 + 2.5 * SIZE), (X0 + 5 * SIZE, Y0 + 2.5 * SIZE)])
    bridge = _line([(X0 + 2.5 * SIZE, Y0), (X0 + 2.5 * SIZE, Y0 + 5 * SIZE)])
    flood = _polygon(
        [
            (X0 + 2.2 * SIZE, Y0 + 2.2 * SIZE),
            (X0 + 2.8 * SIZE, Y0 + 2.2 * SIZE),
            (X0 + 2.8 * SIZE, Y0 + 2.8 * SIZE),
            (X0 + 2.2 * SIZE, Y0 + 2.8 * SIZE),
        ],
    )
    base_rules = {
        "river": {"avoid": _rule(strength=1.0, priority=1)},
        "bridge": {"prefer": _rule(strength=1.0, priority=2)},
    }
    base_features = [_feature("river", river), _feature("bridge", bridge)]

    def test_the_river_blocks_everywhere_except_at_the_bridge(self):
        effects = _compute(self.base_features, self.base_rules)

        for col in (0, 1, 3, 4):
            assert effects[_ref(2, col)]["route_multiplier"] == pytest.approx(
                AVOID_MAX,
            )
        assert effects[_ref(2, 2)]["route_multiplier"] == pytest.approx(
            PREFER_MIN,
        )

    def test_a_higher_priority_flood_closes_the_bridge_again(self):
        rules = {
            **self.base_rules,
            "flood": {"avoid": _rule(strength=1.0, priority=3)},
        }

        effects = _compute(
            [*self.base_features, _feature("flood", self.flood)],
            rules,
        )

        assert effects[_ref(2, 2)]["route_multiplier"] == pytest.approx(
            AVOID_MAX,
        )
        assert effects[_ref(1, 2)]["route_multiplier"] == pytest.approx(
            PREFER_MIN,
        )
