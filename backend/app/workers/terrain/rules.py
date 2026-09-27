from __future__ import annotations

from typing import Any

from app.workers.terrain.constants import DEFAULT_RULE, INTENTS

ResolvedRule = dict[str, Any]


def layer_rank(layers: list[dict]) -> dict[str, int]:
    by_parent: dict[str | None, list[dict]] = {}
    for layer in layers:
        by_parent.setdefault(layer["parent_id"], []).append(layer)
    for siblings in by_parent.values():
        siblings.sort(key=lambda layer: (layer["order"], layer["id"]))

    rank: dict[str, int] = {}
    stack = list(reversed(by_parent.get(None, [])))
    while stack:
        layer = stack.pop()
        rank[layer["id"]] = len(rank)
        stack.extend(reversed(by_parent.get(layer["id"], [])))
    return rank


def _chain(layers_by_id: dict[str, dict], layer_id: str) -> list[dict]:
    chain: list[dict] = []
    seen: set[str] = set()
    current = layers_by_id.get(layer_id)
    while current is not None and current["id"] not in seen:
        seen.add(current["id"])
        chain.append(current)
        parent_id = current["parent_id"]
        current = layers_by_id.get(parent_id) if parent_id else None
    chain.reverse()
    return chain


def _chain_rule(chain: list[dict], intent: str) -> dict | None:
    merged: dict | None = None
    for layer in chain:
        rule = (layer.get("default_rules") or {}).get(intent)
        if rule is not None:
            merged = {**(merged or {}), **rule}
    return merged


def resolve_feature_rules(
    snapshot: dict[str, Any],
) -> dict[str, dict[str, ResolvedRule]]:
    layers_by_id = {layer["id"]: layer for layer in snapshot["layers"]}
    rank = layer_rank(snapshot["layers"])

    memberships: dict[str, list[dict]] = {}
    for membership in snapshot["memberships"]:
        if membership["layer_id"] in rank:
            memberships.setdefault(membership["feature_id"], []).append(
                membership,
            )

    chains: dict[str, list[dict]] = {}
    resolved: dict[str, dict[str, ResolvedRule]] = {}
    for feature in snapshot["features"]:
        if not feature.get("in_effect", True):
            continue

        ordered = sorted(
            memberships.get(feature["id"], []),
            key=lambda m: (rank[m["layer_id"]], m["order"], m["id"]),
        )
        own_rules = feature.get("rules") or {}

        rules: dict[str, ResolvedRule] = {}
        for intent in INTENTS:
            layer_rule = None
            for membership in ordered:
                layer_id = membership["layer_id"]
                if layer_id not in chains:
                    chains[layer_id] = _chain(layers_by_id, layer_id)
                layer_rule = _chain_rule(chains[layer_id], intent)
                if layer_rule is not None:
                    break

            own_rule = own_rules.get(intent)
            if layer_rule is None and own_rule is None:
                continue

            merged = {**DEFAULT_RULE, **(layer_rule or {}), **(own_rule or {})}
            if merged["enabled"]:
                rules[intent] = merged

        if rules:
            resolved[feature["id"]] = rules
    return resolved
