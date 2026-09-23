import type {
    FeatureStyle,
    WorkspaceLayer,
    WorkspaceMembership,
} from "./types";
import { APPLICATION_DEFAULT_STYLE } from "./types";

export function resolveLayerChainStyle(
    layers: WorkspaceLayer[],
    layerId: string,
): FeatureStyle {
    const byId = new Map(layers.map((l) => [l.id, l]));
    const chain: WorkspaceLayer[] = [];
    let current = byId.get(layerId);
    while (current) {
        chain.unshift(current);
        current = current.parentId ? byId.get(current.parentId) : undefined;
    }

    let style: FeatureStyle = { ...APPLICATION_DEFAULT_STYLE };
    for (const layer of chain) {
        style = { ...style, ...layer.defaultStyle };
    }
    return style;
}

export function resolveMembershipStyle(
    layers: WorkspaceLayer[],
    membership: WorkspaceMembership,
): FeatureStyle {
    const layerStyle = resolveLayerChainStyle(layers, membership.layerId);
    return { ...layerStyle, ...membership.styleOverride };
}
