import { getPrecedenceOrderedLayerIds } from "./tree";
import {
    DEFAULT_RULE,
    MAX_RULE_PRIORITY,
    MAX_RULE_STRENGTH,
    MIN_RULE_PRIORITY,
    MIN_RULE_STRENGTH,
    RULE_INTENTS,
} from "./types";
import type {
    FeatureRules,
    RuleIntent,
    RuleSettings,
    WorkspaceFeature,
    WorkspaceLayer,
    WorkspaceMembership,
} from "./types";

export type RuleProperty = keyof RuleSettings;
export type RuleSource = "own" | "inherited" | "default";

export interface ResolvedRuleView {
    defined: boolean;
    enabled: boolean;
    values: Required<RuleSettings>;
    source: Record<RuleProperty, RuleSource>;
}

const PROPERTIES: RuleProperty[] = [
    "enabled",
    "strength",
    "bufferDecay",
    "priority",
];

export function isValidRulePatch(patch: RuleSettings): boolean {
    const { strength, bufferDecay, priority } = patch;
    if (
        strength !== undefined &&
        !(strength >= MIN_RULE_STRENGTH && strength <= MAX_RULE_STRENGTH)
    )
        return false;
    if (bufferDecay !== undefined && !(bufferDecay >= 0 && bufferDecay <= 1))
        return false;
    if (
        priority !== undefined &&
        !(
            Number.isInteger(priority) &&
            priority >= MIN_RULE_PRIORITY &&
            priority <= MAX_RULE_PRIORITY
        )
    )
        return false;
    return true;
}

function layerChain(
    layers: WorkspaceLayer[],
    layerId: string,
): WorkspaceLayer[] {
    const byId = new Map(layers.map((l) => [l.id, l]));
    const chain: WorkspaceLayer[] = [];
    const seen = new Set<string>();
    let current = byId.get(layerId);
    while (current && !seen.has(current.id)) {
        seen.add(current.id);
        chain.unshift(current);
        current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return chain;
}

function chainRule(
    chain: WorkspaceLayer[],
    intent: RuleIntent,
): RuleSettings | null {
    let merged: RuleSettings | null = null;
    for (const layer of chain) {
        const rule = layer.defaultRules[intent];
        if (rule !== undefined) merged = { ...(merged ?? {}), ...rule };
    }
    return merged;
}

function buildView(
    inherited: RuleSettings | null,
    own: RuleSettings | null,
): ResolvedRuleView {
    const values = {
        ...DEFAULT_RULE,
        ...(inherited ?? {}),
        ...(own ?? {}),
    } as Required<RuleSettings>;
    const source = {} as Record<RuleProperty, RuleSource>;
    for (const property of PROPERTIES) {
        source[property] =
            own?.[property] !== undefined
                ? "own"
                : inherited?.[property] !== undefined
                  ? "inherited"
                  : "default";
    }
    const isDefined = inherited !== null || own !== null;
    return {
        defined: isDefined,
        enabled: isDefined && values.enabled,
        values,
        source,
    };
}

export function resolveFeatureRule(
    layers: WorkspaceLayer[],
    memberships: WorkspaceMembership[],
    feature: WorkspaceFeature,
    intent: RuleIntent,
): ResolvedRuleView {
    const rank = new Map(
        getPrecedenceOrderedLayerIds(layers).map((id, index) => [id, index]),
    );
    const ordered = memberships
        .filter((m) => m.featureId === feature.id && rank.has(m.layerId))
        .sort(
            (a, b) =>
                rank.get(a.layerId)! - rank.get(b.layerId)! ||
                a.order - b.order,
        );

    let inherited: RuleSettings | null = null;
    for (const membership of ordered) {
        inherited = chainRule(layerChain(layers, membership.layerId), intent);
        if (inherited !== null) break;
    }
    return buildView(inherited, feature.rules[intent] ?? null);
}

export function resolveLayerRule(
    layers: WorkspaceLayer[],
    layerId: string,
    intent: RuleIntent,
): ResolvedRuleView {
    const chain = layerChain(layers, layerId);
    const own = chain.at(-1)?.defaultRules[intent] ?? null;
    return buildView(chainRule(chain.slice(0, -1), intent), own);
}

function effectiveRule(view: ResolvedRuleView): Required<RuleSettings> | null {
    return view.enabled ? view.values : null;
}

export function preserveRulesAcrossMove(
    layers: WorkspaceLayer[],
    before: WorkspaceMembership[],
    after: WorkspaceMembership[],
    feature: WorkspaceFeature,
): FeatureRules {
    let rules = feature.rules;
    for (const intent of RULE_INTENTS) {
        const previous = resolveFeatureRule(layers, before, feature, intent);
        const next = resolveFeatureRule(layers, after, feature, intent);
        if (
            JSON.stringify(effectiveRule(previous)) ===
            JSON.stringify(effectiveRule(next))
        )
            continue;
        rules = {
            ...rules,
            [intent]: previous.defined
                ? { ...previous.values }
                : { enabled: false },
        };
    }
    return rules;
}
