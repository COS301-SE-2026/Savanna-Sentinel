import type { ResolvedFeature } from "./resolveVisibleFeatures";

export interface LayerOpacityOverride {
    kind: "layer" | "membership";
    id: string;
    value: number;
}

export function applyOpacityOverrides(
    resolved: ResolvedFeature[],
    overrides: LayerOpacityOverride[],
): ResolvedFeature[] {
    if (overrides.length === 0) return resolved;

    const layerOverrides = new Map<string, number>();
    const membershipOverrides = new Map<string, number>();
    for (const override of overrides) {
        const target =
            override.kind === "layer" ? layerOverrides : membershipOverrides;
        target.set(override.id, override.value);
    }

    return resolved.map((r) => {
        const opacity =
            membershipOverrides.get(r.membershipId) ??
            layerOverrides.get(r.layerId);
        if (opacity === undefined) return r;
        return {
            ...r,
            style: {
                ...r.style,
                opacity,
                outlineOpacity: opacity,
                iconOpacity: opacity,
                labelOpacity: opacity,
                bufferOpacity: opacity,
            },
        };
    });
}
