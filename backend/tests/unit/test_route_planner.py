"""Unit tests for the route planner.

using a small deterministic graph fixture and then test the helper
functions plus the high-level plan_routes().
"""

from __future__ import annotations

from dataclasses import dataclass

import pytest

from app.schemas.geo import GeoPoint
from app.schemas.route import GraphEdge, GraphNode, ParkGraph, PlannedRoute
from app.workers.ml import route_planner


@dataclass(frozen=True)
class SimpleGraphFixture:
    graph: ParkGraph
    start_node_id: str
    mid_node_id: str
    end_node_id: str


def make_graph() -> SimpleGraphFixture:
    nodes = [
        GraphNode(
            node_id="start",
            location=GeoPoint(coordinates=(18.4200, -33.9200)),
            risk_score=0.1,
        ),
        GraphNode(
            node_id="mid",
            location=GeoPoint(coordinates=(18.4250, -33.9180)),
            risk_score=0.7,
        ),
        GraphNode(
            node_id="end",
            location=GeoPoint(coordinates=(18.4300, -33.9160)),
            risk_score=0.4,
        ),
    ]

    edges = [
        GraphEdge(
            "start", "mid", distance_km=1.0, est_time_min=10.0, est_fuel_l=1.5,
        ),
        GraphEdge(
            "mid", "end", distance_km=1.0, est_time_min=10.0, est_fuel_l=1.5,
        ),
        GraphEdge(
            "start", "end", distance_km=2.0, est_time_min=25.0, est_fuel_l=3.5,
        ),
    ]

    return SimpleGraphFixture(
        graph=ParkGraph(park_id="park-001", nodes=nodes, edges=edges),
        start_node_id="start",
        mid_node_id="mid",
        end_node_id="end",
    )

# Check if init uses tau max
def test_init_pheromones():
    fixture = make_graph()
    config = route_planner.ACOConfig(tau_max=4.2)

    pheromones = route_planner.init_pheromones(fixture.graph, config)

    assert pheromones == {
        ("start", "mid"): 4.2,
        ("mid", "end"): 4.2,
        ("start", "end"): 4.2,
    }


def test_feasible_edges_filter():
    fixture = make_graph()

    edges = route_planner.feasible_edges(
        fixture.graph,
        current_node="start",
        end_node_id=fixture.end_node_id,
        visited={"start"},
        time_remaining=20.0,
        fuel_remaining=3.0,
    )

    assert [edge.to_node_id for edge in edges] == ["mid"]
