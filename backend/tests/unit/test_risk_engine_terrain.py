import pytest

from app.workers.ml.risk_engine import apply_terrain_adjustments


def test_no_deltas_leave_scores_unchanged():
    final, applied, floored = apply_terrain_adjustments(
        {"c1": 0.4, "c2": 0.1},
        {},
        {},
    )

    assert final == {"c1": 0.4, "c2": 0.1}
    assert applied == {"c1": 0.0, "c2": 0.0}
    assert floored == set()


def test_increase_and_decrease_shift_the_model_score():
    final, applied, _ = apply_terrain_adjustments(
        {"up": 0.4, "down": 0.4},
        {},
        {"up": 0.2, "down": -0.3},
    )

    assert final["up"] == pytest.approx(0.6)
    assert final["down"] == pytest.approx(0.1)
    assert applied["up"] == pytest.approx(0.2)
    assert applied["down"] == pytest.approx(-0.3)


def test_adjusted_score_is_clamped_to_the_unit_range():
    final, applied, _ = apply_terrain_adjustments(
        {"high": 0.9, "low": 0.1},
        {},
        {"high": 0.3, "low": -0.3},
    )

    assert final == {"high": 1.0, "low": 0.0}
    assert applied["high"] == pytest.approx(0.1)
    assert applied["low"] == pytest.approx(-0.1)


def test_floor_beats_a_decrease_rule():
    final, applied, floored = apply_terrain_adjustments(
        {"c1": 0.5},
        {"c1": 0.4},
        {"c1": -0.3},
    )

    assert final["c1"] == pytest.approx(0.4)
    assert applied["c1"] == pytest.approx(-0.1)
    assert floored == set()


def test_decrease_on_a_floored_cell_changes_nothing():
    final, applied, floored = apply_terrain_adjustments(
        {"c1": 0.2},
        {"c1": 0.6},
        {"c1": -0.3},
    )

    assert final["c1"] == pytest.approx(0.6)
    assert applied["c1"] == 0.0
    assert floored == {"c1"}


def test_increase_can_lift_a_cell_above_its_floor():
    final, applied, floored = apply_terrain_adjustments(
        {"c1": 0.5},
        {"c1": 0.6},
        {"c1": 0.3},
    )

    assert final["c1"] == pytest.approx(0.8)
    assert applied["c1"] == pytest.approx(0.2)
    assert floored == {"c1"}


def test_increase_below_the_floor_changes_nothing():
    final, applied, floored = apply_terrain_adjustments(
        {"c1": 0.2},
        {"c1": 0.6},
        {"c1": 0.3},
    )

    assert final["c1"] == pytest.approx(0.6)
    assert applied["c1"] == 0.0
    assert floored == {"c1"}


def test_floor_above_model_without_terrain_is_still_floored():
    final, applied, floored = apply_terrain_adjustments(
        {"c1": 0.1},
        {"c1": 0.88},
        {},
    )

    assert final["c1"] == pytest.approx(0.88)
    assert applied["c1"] == 0.0
    assert floored == {"c1"}


def test_deltas_for_unscored_cells_are_ignored():
    final, applied, _ = apply_terrain_adjustments(
        {"c1": 0.4},
        {},
        {"c1": 0.1, "unscored": 0.3},
    )

    assert set(final) == {"c1"}
    assert set(applied) == {"c1"}
