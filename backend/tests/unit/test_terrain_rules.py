from app.workers.terrain.constants import DEFAULT_RULE
from app.workers.terrain.rules import layer_rank, resolve_feature_rules


def _layer(layer_id, parent=None, order=0, rules=None):
    return {
        "id": layer_id,
        "parent_id": parent,
        "order": order,
        "default_rules": rules or {},
    }


def _feature(feature_id, rules=None, in_effect=True):
    return {"id": feature_id, "in_effect": in_effect, "rules": rules or {}}


def _member(member_id, feature_id, layer_id, order=0):
    return {
        "id": member_id,
        "feature_id": feature_id,
        "layer_id": layer_id,
        "order": order,
    }


def _snapshot(layers, features, memberships):
    return {"layers": layers, "features": features, "memberships": memberships}


def test_layer_rank_is_depth_first_in_sibling_order():
    layers = [
        _layer("b", order=1),
        _layer("a", order=0),
        _layer("a2", parent="a", order=1),
        _layer("a1", parent="a", order=0),
    ]

    rank = layer_rank(layers)

    assert sorted(rank, key=rank.get) == ["a", "a1", "a2", "b"]


def test_a_feature_with_its_own_rule_gets_the_defaults_filled_in():
    snapshot = _snapshot(
        [_layer("water")],
        [_feature("f", {"avoid": {"strength": 0.9}})],
        [_member("m", "f", "water")],
    )

    resolved = resolve_feature_rules(snapshot)

    assert resolved == {
        "f": {"avoid": {**DEFAULT_RULE, "strength": 0.9}},
    }


def test_a_layer_default_applies_to_a_feature_with_no_rule_of_its_own():
    snapshot = _snapshot(
        [_layer("water", rules={"prefer": {"strength": 0.7}})],
        [_feature("f")],
        [_member("m", "f", "water")],
    )

    assert resolve_feature_rules(snapshot)["f"]["prefer"]["strength"] == 0.7


def test_feature_properties_override_layer_properties_one_by_one():
    snapshot = _snapshot(
        [_layer("water", rules={"avoid": {"strength": 0.9, "priority": 2}})],
        [_feature("f", {"avoid": {"priority": 5}})],
        [_member("m", "f", "water")],
    )

    rule = resolve_feature_rules(snapshot)["f"]["avoid"]

    assert rule["strength"] == 0.9
    assert rule["priority"] == 5


def test_a_nested_layer_refines_its_parent_property_by_property():
    snapshot = _snapshot(
        [
            _layer("root", rules={"avoid": {"strength": 0.4, "priority": 1}}),
            _layer("child", parent="root", rules={"avoid": {"priority": 3}}),
        ],
        [_feature("f")],
        [_member("m", "f", "child")],
    )

    rule = resolve_feature_rules(snapshot)["f"]["avoid"]

    assert rule["strength"] == 0.4
    assert rule["priority"] == 3


def test_a_rule_defined_on_a_grandparent_reaches_a_grandchild_feature():
    snapshot = _snapshot(
        [
            _layer("a", rules={"prefer": {"strength": 0.8}}),
            _layer("b", parent="a"),
            _layer("c", parent="b"),
        ],
        [_feature("f")],
        [_member("m", "f", "c")],
    )

    assert resolve_feature_rules(snapshot)["f"]["prefer"]["strength"] == 0.8


def test_disabling_the_intent_on_the_feature_suppresses_an_inherited_rule():
    snapshot = _snapshot(
        [_layer("water", rules={"avoid": {"strength": 1.0}})],
        [_feature("f", {"avoid": {"enabled": False}})],
        [_member("m", "f", "water")],
    )

    assert resolve_feature_rules(snapshot) == {}


def test_a_feature_can_switch_a_disabled_layer_rule_back_on():
    snapshot = _snapshot(
        [_layer("water", rules={"avoid": {"enabled": False}})],
        [_feature("f", {"avoid": {"enabled": True}})],
        [_member("m", "f", "water")],
    )

    assert "avoid" in resolve_feature_rules(snapshot)["f"]


def test_a_feature_that_is_not_in_effect_contributes_nothing():
    snapshot = _snapshot(
        [_layer("water", rules={"avoid": {"strength": 1.0}})],
        [_feature("f", in_effect=False)],
        [_member("m", "f", "water")],
    )

    assert resolve_feature_rules(snapshot) == {}


def test_an_empty_rule_counts_as_defined_and_uses_the_defaults():
    snapshot = _snapshot(
        [_layer("water")],
        [_feature("f", {"prefer": {}})],
        [_member("m", "f", "water")],
    )

    assert resolve_feature_rules(snapshot) == {"f": {"prefer": DEFAULT_RULE}}


def test_a_feature_with_no_rules_anywhere_is_absent():
    snapshot = _snapshot(
        [_layer("water")],
        [_feature("f")],
        [_member("m", "f", "water")],
    )

    assert resolve_feature_rules(snapshot) == {}


def test_a_feature_can_hold_all_four_intents():
    snapshot = _snapshot(
        [_layer("water")],
        [
            _feature(
                "f",
                {
                    "increase_risk": {"strength": 0.3},
                    "decrease_risk": {"strength": 0.8},
                    "prefer": {},
                    "avoid": {},
                },
            ),
        ],
        [_member("m", "f", "water")],
    )

    assert set(resolve_feature_rules(snapshot)["f"]) == {
        "increase_risk",
        "decrease_risk",
        "prefer",
        "avoid",
    }


def test_a_duplicated_feature_applies_each_intent_once_from_the_first_layer():
    snapshot = _snapshot(
        [
            _layer("first", order=0, rules={"avoid": {"strength": 0.9}}),
            _layer("second", order=1, rules={"avoid": {"strength": 0.2}}),
        ],
        [_feature("f")],
        [_member("m2", "f", "second"), _member("m1", "f", "first")],
    )

    resolved = resolve_feature_rules(snapshot)

    assert list(resolved["f"]) == ["avoid"]
    assert resolved["f"]["avoid"]["strength"] == 0.9


def test_a_later_layer_supplies_an_intent_the_first_layer_does_not_define():
    snapshot = _snapshot(
        [
            _layer("first", order=0, rules={"avoid": {"strength": 0.9}}),
            _layer("second", order=1, rules={"prefer": {"strength": 0.6}}),
        ],
        [_feature("f")],
        [_member("m1", "f", "first"), _member("m2", "f", "second")],
    )

    resolved = resolve_feature_rules(snapshot)["f"]

    assert resolved["avoid"]["strength"] == 0.9
    assert resolved["prefer"]["strength"] == 0.6


def test_a_feature_under_no_layer_still_uses_its_own_rules():
    snapshot = _snapshot(
        [],
        [_feature("f", {"avoid": {"strength": 0.6}})],
        [],
    )

    assert resolve_feature_rules(snapshot)["f"]["avoid"]["strength"] == 0.6
