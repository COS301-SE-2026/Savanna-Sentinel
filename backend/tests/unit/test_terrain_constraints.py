import math

import pytest
from pyproj import Transformer
from shapely.geometry import LineString, Point, box

from app.workers.ml.terrain_constraints import (
    IMPASSABLE_STRENGTH,
    ImpassableArea,
    TerrainConstraints,
    build_constraints,
    crossing_gates,
    impassable_areas,
    top_priority_by_cell,
)
from app.workers.terrain.constants import DEFAULT_RULE
from app.workers.terrain.rules import resolve_feature_rules

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


def _river():
    # runs north-south through the middle of column 2
    x = X0 + 2.5 * SIZE
    return {
        "type": "LineString",
        "coordinates": [_lonlat(x, Y0), _lonlat(x, Y0 + 5 * SIZE)],
    }


def _feature(feature_id, geometry, buffer_m=None):
    return {
        "id": feature_id,
        "geometry": geometry,
        "buffer_enabled": buffer_m is not None,
        "buffer_distance_m": buffer_m if buffer_m is not None else 100.0,
    }


def _rule(**overrides):
    return {**DEFAULT_RULE, **overrides}


def _impassable(**overrides):
    return _rule(strength=IMPASSABLE_STRENGTH, **overrides)


class TestImpassableAreas:
    def test_full_strength_avoid_is_impassable(self):
        features = [_feature("river", _river())]
        resolved = {"river": {"avoid": _impassable(priority=3)}}

        areas = impassable_areas(features, resolved, EPSG)

        assert len(areas) == 1
        assert areas[0].feature_id == "river"
        assert areas[0].priority == 3
        assert areas[0].area.geom_type == "LineString"

    def test_weaker_avoid_only_adds_cost(self):
        features = [_feature("river", _river())]
        resolved = {"river": {"avoid": _rule(strength=0.9)}}

        assert impassable_areas(features, resolved, EPSG) == []

    def test_other_intents_are_never_impassable(self):
        features = [_feature("road", _river())]
        resolved = {
            "road": {
                "prefer": _rule(strength=1.0),
                "increase_risk": _rule(strength=1.0),
            },
        }

        assert impassable_areas(features, resolved, EPSG) == []

    def test_features_without_rules_are_skipped(self):
        features = [_feature("river", _river())]

        assert impassable_areas(features, {}, EPSG) == []

    def test_full_strength_buffer_is_impassable(self):
        features = [_feature("river", _river(), buffer_m=300.0)]
        resolved = {"river": {"avoid": _impassable(buffer_decay=0.0)}}

        (area,) = impassable_areas(features, resolved, EPSG)

        assert area.area.geom_type == "Polygon"
        # round end caps add a full circle
        expected = 600.0 * 5 * SIZE + math.pi * 300.0**2
        assert area.area.area == pytest.approx(expected, rel=0.01)

    def test_decaying_buffer_keeps_only_the_footprint(self):
        features = [_feature("river", _river(), buffer_m=300.0)]
        resolved = {"river": {"avoid": _impassable(buffer_decay=0.5)}}

        (area,) = impassable_areas(features, resolved, EPSG)

        assert area.area.geom_type == "LineString"

    def test_rule_inherited_from_a_layer(self):
        snapshot = {
            "layers": [
                {
                    "id": "rivers",
                    "parent_id": None,
                    "order": 0,
                    "default_rules": {"avoid": {"strength": 1.0}},
                },
            ],
            "memberships": [
                {
                    "id": "m1",
                    "feature_id": "river",
                    "layer_id": "rivers",
                    "order": 0,
                },
            ],
            "features": [{**_feature("river", _river()), "rules": {}}],
        }

        areas = impassable_areas(
            snapshot["features"],
            resolve_feature_rules(snapshot),
            EPSG,
        )

        assert [a.feature_id for a in areas] == ["river"]

    def test_feature_not_in_effect_is_ignored(self):
        snapshot = {
            "layers": [],
            "memberships": [],
            "features": [
                {
                    **_feature("river", _river()),
                    "in_effect": False,
                    "rules": {"avoid": {"strength": 1.0}},
                },
            ],
        }

        areas = impassable_areas(
            snapshot["features"],
            resolve_feature_rules(snapshot),
            EPSG,
        )

        assert areas == []


class TestTopPriorityByCell:
    def test_cells_reached_by_a_route_rule_get_its_priority(self):
        features = [_feature("river", _river())]
        resolved = {"river": {"avoid": _impassable(priority=2)}}

        top = top_priority_by_cell(_cells(), EPSG, features, resolved)

        assert top == {_ref(row, 2): 2 for row in range(5)}

    def test_highest_priority_wins(self):
        features = [
            _feature("river", _river()),
            _feature("bridge", _point(2, 2)),
        ]
        resolved = {
            "river": {"avoid": _impassable(priority=1)},
            "bridge": {"prefer": _rule(priority=4)},
        }

        top = top_priority_by_cell(_cells(), EPSG, features, resolved)

        assert top[_ref(2, 2)] == 4
        assert top[_ref(0, 2)] == 1

    def test_risk_intents_do_not_count(self):
        features = [_feature("zone", _point(1, 1))]
        resolved = {"zone": {"increase_risk": _rule(priority=9)}}

        assert top_priority_by_cell(_cells(), EPSG, features, resolved) == {}

    def test_buffer_extends_the_reach(self):
        features = [_feature("bridge", _point(2, 2), buffer_m=600.0)]
        resolved = {"bridge": {"prefer": _rule(priority=2)}}

        top = top_priority_by_cell(_cells(), EPSG, features, resolved)

        assert top[_ref(2, 1)] == 2
        assert top[_ref(2, 3)] == 2
        assert _ref(2, 0) not in top

    def test_no_cells_or_rules(self):
        features = [_feature("river", _river())]
        resolved = {"river": {"avoid": _impassable()}}

        assert top_priority_by_cell([], EPSG, features, resolved) == {}
        assert top_priority_by_cell(_cells(), EPSG, features, {}) == {}


class TestBuildConstraints:
    def test_higher_priority_bridge_overrides_the_river(self):
        features = [
            _feature("river", _river()),
            _feature("bridge", _point(2, 2)),
        ]
        resolved = {
            "river": {"avoid": _impassable(priority=1)},
            "bridge": {"prefer": _rule(priority=2)},
        }

        constraints = build_constraints(_cells(), EPSG, features, resolved)
        (river,) = constraints.areas

        assert constraints.overridden(river, _ref(2, 2))
        assert not constraints.overridden(river, _ref(0, 2))
        assert not constraints.overridden(river, _ref(2, 0))

    def test_equal_priority_does_not_override(self):
        features = [
            _feature("river", _river()),
            _feature("bridge", _point(2, 2)),
        ]
        resolved = {
            "river": {"avoid": _impassable(priority=2)},
            "bridge": {"prefer": _rule(priority=2)},
        }

        constraints = build_constraints(_cells(), EPSG, features, resolved)
        (river,) = constraints.areas

        assert not constraints.overridden(river, _ref(2, 2))

    def test_nothing_impassable_skips_the_cell_scan(self):
        features = [_feature("road", _river())]
        resolved = {"road": {"prefer": _rule(priority=5)}}

        constraints = build_constraints(_cells(), EPSG, features, resolved)

        assert constraints == TerrainConstraints(epsg=EPSG)

    def test_overridden_defaults_to_not_reached(self):
        area = ImpassableArea("river", 1, box(0, 0, 1, 1))

        assert not TerrainConstraints(areas=[area]).overridden(area, "cell-0")

    def test_keeps_the_grid_epsg(self):
        features = [_feature("river", _river())]
        resolved = {"river": {"avoid": _impassable()}}

        constraints = build_constraints(_cells(), EPSG, features, resolved)

        assert constraints.epsg == EPSG


def _lake(priority=1):
    return ImpassableArea("lake", priority, box(0, 0, 10, 10))


def _wall(priority=1):
    return ImpassableArea("wall", priority, LineString([(5, -10), (5, 10)]))


class TestTerrainConstraintsGeometry:
    def test_to_grid_projects_lon_lat_into_the_grid_crs(self):
        x, y = _centre(2, 2)
        constraints = TerrainConstraints(epsg=EPSG)

        projected = constraints.to_grid(tuple(_lonlat(x, y)))

        assert projected == pytest.approx((x, y))

    def test_point_inside_an_area_is_blocked(self):
        constraints = TerrainConstraints(areas=[_lake()])

        assert constraints.blocks_point((5, 5), "cell-0")
        assert not constraints.blocks_point((50, 50), "cell-0")

    def test_point_in_a_higher_priority_cell_is_not_blocked(self):
        constraints = TerrainConstraints(
            areas=[_lake()],
            top_priority={"cell-0": 2},
        )

        assert not constraints.blocks_point((5, 5), "cell-0")
        assert constraints.blocks_point((5, 5), "cell-1")

    def test_point_without_a_cell_is_judged_on_the_area_alone(self):
        constraints = TerrainConstraints(areas=[_lake()])

        assert constraints.blocks_point((5, 5), None)

    def test_segment_crossing_a_barrier_is_blocked(self):
        constraints = TerrainConstraints(areas=[_wall()])

        assert constraints.blocks_segment((0, 0), (10, 0), "cell-0")
        assert not constraints.blocks_segment((0, 0), (4, 0), "cell-0")

    def test_segment_to_a_higher_priority_cell_is_not_blocked(self):
        constraints = TerrainConstraints(
            areas=[_wall()],
            top_priority={"bridge": 2},
        )

        assert not constraints.blocks_segment((0, 0), (10, 0), "bridge")

    def test_segment_starting_on_the_barrier_is_not_blocked(self):
        constraints = TerrainConstraints(areas=[_wall()])

        assert not constraints.blocks_segment((5, 0), (10, 0), "cell-0")


def _road_across_the_river():
    """East-west line crossing the river at the middle of row 2."""
    y = Y0 + 2.5 * SIZE
    return {
        "type": "LineString",
        "coordinates": [_lonlat(X0, y), _lonlat(X0 + 5 * SIZE, y)],
    }


class TestCrossingGates:
    def _gates(self, features, resolved, reach=500.0):
        areas = impassable_areas(features, resolved, EPSG)
        return crossing_gates(areas, features, resolved, EPSG, reach)

    def test_higher_priority_bridge_becomes_a_gate(self):
        features = [
            _feature("river", _river()),
            _feature("bridge", _point(2, 2)),
        ]
        resolved = {
            "river": {"avoid": _impassable(priority=1)},
            "bridge": {"prefer": _rule(priority=2)},
        }

        (gate,) = self._gates(features, resolved)["river"]

        assert gate.distance(Point(_centre(2, 2))) < 1.0

    def test_equal_or_lower_priority_features_are_not_gates(self):
        features = [
            _feature("river", _river()),
            _feature("bridge", _point(2, 2)),
        ]
        resolved = {
            "river": {"avoid": _impassable(priority=2)},
            "bridge": {"prefer": _rule(priority=2)},
        }

        assert self._gates(features, resolved) == {}

    def test_features_out_of_reach_are_not_gates(self):
        features = [
            _feature("river", _river()),
            _feature("far", _point(2, 0)),
        ]
        resolved = {
            "river": {"avoid": _impassable(priority=1)},
            "far": {"prefer": _rule(priority=2)},
        }

        assert self._gates(features, resolved) == {}

    def test_only_the_part_of_a_road_near_the_river_is_a_gate(self):
        features = [
            _feature("river", _river()),
            _feature("road", _road_across_the_river()),
        ]
        resolved = {
            "river": {"avoid": _impassable(priority=1)},
            "road": {"prefer": _rule(priority=2)},
        }

        (gate,) = self._gates(features, resolved)["river"]

        assert gate.length == pytest.approx(1000.0, rel=0.01)

    def test_risk_rules_never_make_a_gate(self):
        features = [
            _feature("river", _river()),
            _feature("zone", _point(2, 2)),
        ]
        resolved = {
            "river": {"avoid": _impassable(priority=1)},
            "zone": {"increase_risk": _rule(priority=9)},
        }

        assert self._gates(features, resolved) == {}

    def test_build_constraints_reaches_half_a_cell(self):
        features = [
            _feature("river", _river()),
            _feature("bridge", _point(2, 2)),
        ]
        resolved = {
            "river": {"avoid": _impassable(priority=1)},
            "bridge": {"prefer": _rule(priority=2)},
        }

        constraints = build_constraints(_cells(), EPSG, features, resolved)

        assert constraints.gate_reach_m == pytest.approx(SIZE / 2)
        assert list(constraints.gates) == ["river"]


class TestGatedCrossings:
    def _constraints(self):
        wall = ImpassableArea("wall", 1, LineString([(5, -10), (5, 10)]))
        return TerrainConstraints(
            areas=[wall],
            gates={"wall": [Point(5, 3)]},
            gate_reach_m=4,
        )

    def test_opens_moves_that_pass_near_a_gate(self):
        constraints = self._constraints()
        (wall,) = constraints.areas

        assert constraints.opens(wall, LineString([(0, 0), (10, 0)]))
        assert not constraints.opens(wall, LineString([(0, -5), (10, -5)]))

    def test_keeps_a_move_blocked_when_its_legs_meet_a_bend(self):
        bend = ImpassableArea(
            "river",
            1,
            LineString([(2, 10), (2, -2), (8, -2), (8, 10)]),
        )
        constraints = TerrainConstraints(
            areas=[bend],
            gates={"river": [Point(2, 1)]},
            gate_reach_m=4,
        )

        assert not constraints.opens(bend, LineString([(0, 0), (10, 0)]))

    def test_snaps_the_crossing_onto_the_barrier(self):
        wall = ImpassableArea("wall", 1, LineString([(5, -10), (5, 10)]))
        constraints = TerrainConstraints(
            areas=[wall],
            gates={"wall": [Point(5.4, 3)]},
            gate_reach_m=4,
        )

        assert constraints.opens(wall, LineString([(0, 0), (10, 0)]))
        assert constraints.crossing_vias((0, 0), (10, 0)) == [(5.0, 3.0)]

    def test_areas_open_anywhere_near_a_gate(self):
        lake = ImpassableArea("lake", 1, box(4, -10, 6, 10))
        constraints = TerrainConstraints(
            areas=[lake],
            gates={"lake": [LineString([(4, 3), (6, 3)])]},
            gate_reach_m=4,
        )

        assert constraints.opens(lake, LineString([(0, 0), (10, 0)]))
        assert not constraints.opens(lake, LineString([(0, -8), (10, -8)]))

    def test_opens_nothing_without_gates(self):
        wall = ImpassableArea("wall", 1, LineString([(5, -10), (5, 10)]))
        constraints = TerrainConstraints(areas=[wall], gate_reach_m=100)

        assert not constraints.opens(wall, LineString([(0, 0), (10, 0)]))

    def test_crossing_vias_go_through_the_gate(self):
        constraints = self._constraints()

        assert constraints.crossing_vias((0, 0), (10, 0)) == [(5.0, 3.0)]
        assert constraints.crossing_vias((0, 0), (4, 0)) == []

    def test_crossing_vias_are_ordered_along_the_move(self):
        constraints = TerrainConstraints(
            areas=[
                ImpassableArea("far", 1, LineString([(8, -9), (8, 9)])),
                ImpassableArea("near", 1, LineString([(2, -9), (2, 9)])),
            ],
            gates={"far": [Point(8, 1)], "near": [Point(2, -1)]},
            gate_reach_m=4,
        )

        vias = constraints.crossing_vias((0, 0), (10, 0))

        assert vias == [(2.0, -1.0), (8.0, 1.0)]

    def test_from_grid_undoes_to_grid(self):
        constraints = TerrainConstraints(epsg=EPSG)
        point = tuple(_lonlat(*_centre(1, 3)))

        back = constraints.from_grid(constraints.to_grid(point))

        assert back == pytest.approx(point)
