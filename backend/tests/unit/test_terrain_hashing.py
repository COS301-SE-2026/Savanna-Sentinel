from app.workers.terrain.constants import DEFAULT_RULE
from app.workers.terrain.hashing import EMPTY_HASH, rules_projection_hash

POINT = {"type": "Point", "coordinates": [31.1, -24.4]}


def _feature(feature_id="f", geometry=None, buffer=None):
    return {
        "id": feature_id,
        "geometry": geometry or POINT,
        "buffer_enabled": buffer is not None,
        "buffer_distance_m": buffer if buffer is not None else 100.0,
    }


def _resolved(feature_id="f", **rule):
    return {feature_id: {"avoid": {**DEFAULT_RULE, **rule}}}


def test_no_effect_inputs_hash_to_the_empty_hash():
    assert rules_projection_hash([], {}) == EMPTY_HASH
    assert rules_projection_hash([_feature()], {}) == EMPTY_HASH


def test_the_hash_is_stable_and_order_independent():
    features = [_feature("a"), _feature("b")]
    resolved = {**_resolved("a"), **_resolved("b")}

    first = rules_projection_hash(features, resolved)
    second = rules_projection_hash(list(reversed(features)), resolved)

    assert first == second
    assert first != EMPTY_HASH


def test_moving_a_feature_changes_the_hash():
    moved = {"type": "Point", "coordinates": [31.2, -24.4]}

    assert rules_projection_hash(
        [_feature()],
        _resolved(),
    ) != rules_projection_hash([_feature(geometry=moved)], _resolved())


def test_changing_a_rule_value_changes_the_hash():
    assert rules_projection_hash(
        [_feature()],
        _resolved(strength=0.5),
    ) != rules_projection_hash([_feature()], _resolved(strength=0.6))


def test_the_buffer_distance_only_counts_while_the_buffer_is_enabled():
    disabled_small = {**_feature(), "buffer_distance_m": 100.0}
    disabled_large = {**_feature(), "buffer_distance_m": 900.0}
    assert rules_projection_hash(
        [disabled_small],
        _resolved(),
    ) == rules_projection_hash([disabled_large], _resolved())

    assert rules_projection_hash(
        [_feature(buffer=100.0)],
        _resolved(),
    ) != rules_projection_hash([_feature(buffer=900.0)], _resolved())


def test_a_feature_with_no_resolved_rules_does_not_change_the_hash():
    resolved = _resolved("a")

    with_extra = rules_projection_hash(
        [_feature("a"), _feature("b")],
        resolved,
    )
    without = rules_projection_hash([_feature("a")], resolved)

    assert with_extra == without
