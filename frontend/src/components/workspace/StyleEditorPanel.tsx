import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useWorkspaceStore } from "@/store/workspaceStore";
import {
    resolveLayerChainStyle,
    resolveMembershipStyle,
} from "@/lib/workspace/styleResolution";
import {
    getFeatureDisplayName,
    getFeatureTypeLabel,
    getLayerDisplayName,
} from "@/lib/workspace/featureDisplay";
import type { FeatureStyle } from "@/lib/workspace/types";
import { IconPicker } from "./IconPicker";
import { ColourPickerPopover } from "./ColourPickerPopover";
import { BufferSection } from "./BufferSection";
import { BufferStyleFields } from "./BufferStyleFields";
import { InEffectSection } from "./InEffectSection";
import { ResetButton } from "./ResetButton";

export type WorkspaceSelection =
    | { kind: "membership"; membershipId: string }
    | { kind: "layer"; layerId: string }
    | null;

export interface StyleEditorPanelProps {
    selection: WorkspaceSelection;
    editingFeatureId: string | null;
    onToggleEditGeometry: (featureId: string) => void;
    onCancelEditGeometry: () => void;
}

export function StyleEditorPanel({
    selection,
    editingFeatureId,
    onToggleEditGeometry,
    onCancelEditGeometry,
}: StyleEditorPanelProps) {
    const layers = useWorkspaceStore((s) => s.layers);
    const features = useWorkspaceStore((s) => s.features);
    const memberships = useWorkspaceStore((s) => s.memberships);
    const setMembershipStyleOverride = useWorkspaceStore(
        (s) => s.setMembershipStyleOverride,
    );
    const resetMembershipStyleProperty = useWorkspaceStore(
        (s) => s.resetMembershipStyleProperty,
    );
    const setLayerDefaultStyle = useWorkspaceStore(
        (s) => s.setLayerDefaultStyle,
    );
    const clearLayerDefaultStyleProperty = useWorkspaceStore(
        (s) => s.clearLayerDefaultStyleProperty,
    );
    const renameFeature = useWorkspaceStore((s) => s.renameFeature);
    const renameLayer = useWorkspaceStore((s) => s.renameLayer);

    if (!selection) {
        return (
            <div className="p-4 text-sm text-color-text-secondary">
                Select a layer or a feature to edit its appearance.
            </div>
        );
    }

    if (selection.kind === "layer") {
        const layer = layers.find((l) => l.id === selection.layerId);
        if (!layer) return null;
        return (
            <div className="flex h-full flex-col overflow-y-auto">
                <div className="border-b border-color-border p-3">
                    <label
                        htmlFor="layer-name"
                        className="mb-1 block text-sm font-semibold text-color-text-primary"
                    >
                        Name
                    </label>
                    <Input
                        id="layer-name"
                        type="text"
                        value={layer.name ?? ""}
                        placeholder={getLayerDisplayName(layer)}
                        aria-label="Layer name"
                        onChange={(e) => renameLayer(layer.id, e.target.value)}
                    />
                </div>
                <StyleFields
                    title="Layer style"
                    resolved={resolveLayerChainStyle(layers, layer.id)}
                    isOverridden={(prop) =>
                        layer.defaultStyle[prop] !== undefined
                    }
                    onChange={(patch) => setLayerDefaultStyle(layer.id, patch)}
                    onReset={(prop) =>
                        clearLayerDefaultStyleProperty(layer.id, prop)
                    }
                    showOutlineOpacity={false}
                />
                <div className="flex flex-col gap-4 border-t border-color-border p-3">
                    <p className="text-sm font-semibold text-color-text-primary">
                        Buffer style
                    </p>
                    <BufferStyleFields
                        resolved={resolveLayerChainStyle(layers, layer.id)}
                        isOverridden={(prop) =>
                            layer.defaultStyle[prop] !== undefined
                        }
                        onChange={(patch) =>
                            setLayerDefaultStyle(layer.id, patch)
                        }
                        onReset={(prop) =>
                            clearLayerDefaultStyleProperty(layer.id, prop)
                        }
                    />
                </div>
            </div>
        );
    }

    const membership = memberships.find((m) => m.id === selection.membershipId);
    if (!membership) return null;
    const feature = features.find((f) => f.id === membership.featureId);
    if (!feature) return null;
    const featureMemberships = memberships.filter(
        (m) => m.featureId === feature.id,
    );
    const layerNameById = new Map(
        layers.map((l) => [l.id, getLayerDisplayName(l)]),
    );

    return (
        <div className="flex h-full flex-col overflow-y-auto">
            <div className="border-b border-color-border p-3">
                <label
                    htmlFor="feature-name"
                    className="mb-1 block text-sm font-semibold text-color-text-primary"
                >
                    Name
                </label>
                <Input
                    id="feature-name"
                    type="text"
                    value={feature.name ?? ""}
                    placeholder={getFeatureDisplayName(feature)}
                    aria-label="Feature name"
                    onChange={(e) => renameFeature(feature.id, e.target.value)}
                />
            </div>
            <StyleFields
                title={`${getFeatureTypeLabel(feature)} feature`}
                resolved={resolveMembershipStyle(layers, membership)}
                isOverridden={(prop) =>
                    membership.styleOverride[prop] !== undefined
                }
                onChange={(patch) =>
                    setMembershipStyleOverride(membership.id, patch)
                }
                onReset={(prop) =>
                    resetMembershipStyleProperty(membership.id, prop)
                }
                showOutlineOpacity={feature.type === "polygon"}
            />

            <BufferSection feature={feature} membership={membership} />

            <div className="flex gap-2 border-t border-color-border p-3">
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onToggleEditGeometry(feature.id)}
                >
                    {editingFeatureId === feature.id
                        ? "Finish editing (Enter)"
                        : "Edit geometry"}
                </Button>
                {editingFeatureId === feature.id && (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={onCancelEditGeometry}
                    >
                        Cancel (Esc)
                    </Button>
                )}
            </div>

            {featureMemberships.length > 1 && (
                <div className="border-t border-color-border p-3">
                    <p className="mb-2 text-sm font-semibold text-color-text-primary">
                        Layers
                    </p>
                    <ul className="m-0 flex list-none flex-col gap-1 p-0">
                        {featureMemberships.map((m) => (
                            <li
                                key={m.id}
                                className="text-sm text-color-text-primary"
                            >
                                {layerNameById.get(m.layerId) ??
                                    "Unknown layer"}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <InEffectSection featureId={feature.id} />
        </div>
    );
}

interface StyleFieldsProps {
    title: string;
    resolved: FeatureStyle;
    isOverridden: (prop: keyof FeatureStyle) => boolean;
    onChange: (patch: Partial<FeatureStyle>) => void;
    onReset: (prop: keyof FeatureStyle) => void;
    showOutlineOpacity: boolean;
}

const MIN_STROKE_WIDTH = 1;
const MAX_STROKE_WIDTH = 20;

function StrokeWidthInput({
    value,
    onCommit,
}: {
    value: number;
    onCommit: (strokeWidth: number) => void;
}) {
    const [draft, setDraft] = useState<string | null>(null);
    return (
        <Input
            type="number"
            min={MIN_STROKE_WIDTH}
            max={MAX_STROKE_WIDTH}
            value={draft ?? String(value)}
            aria-label="Stroke width"
            onChange={(e) => {
                setDraft(e.target.value);
                const parsed = Number(e.target.value);
                if (
                    e.target.value !== "" &&
                    parsed >= MIN_STROKE_WIDTH &&
                    parsed <= MAX_STROKE_WIDTH
                )
                    onCommit(parsed);
            }}
            onBlur={() => setDraft(null)}
        />
    );
}

function StyleFields({
    title,
    resolved,
    isOverridden,
    onChange,
    onReset,
    showOutlineOpacity,
}: StyleFieldsProps) {
    return (
        <div className="flex flex-col gap-4 p-3">
            <p className="text-sm font-semibold text-color-text-primary">
                {title}
            </p>

            <div>
                <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm text-color-text-primary">
                        Colour
                    </span>
                    <ResetButton
                        show={isOverridden("colour")}
                        onClick={() => onReset("colour")}
                    />
                </div>
                <ColourPickerPopover
                    label="Colour"
                    colour={resolved.colour}
                    onChange={(colour) => onChange({ colour })}
                />
            </div>

            <div>
                <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm text-color-text-primary">
                        Opacity
                    </span>
                    <ResetButton
                        show={isOverridden("opacity")}
                        onClick={() => onReset("opacity")}
                    />
                </div>
                <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(resolved.opacity * 100)}
                    aria-label="Opacity"
                    onChange={(e) =>
                        onChange({ opacity: Number(e.target.value) / 100 })
                    }
                />
            </div>

            <div>
                <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm text-color-text-primary">
                        Icon
                    </span>
                    <ResetButton
                        show={isOverridden("icon")}
                        onClick={() => onReset("icon")}
                    />
                </div>
                <IconPicker
                    value={resolved.icon}
                    onChange={(icon) => onChange({ icon })}
                />
            </div>

            <div>
                <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm text-color-text-primary">
                        Icon colour
                    </span>
                    <ResetButton
                        show={isOverridden("iconColour")}
                        onClick={() => onReset("iconColour")}
                    />
                </div>
                <ColourPickerPopover
                    label="Icon colour"
                    colour={resolved.iconColour ?? "#1f2937"}
                    onChange={(iconColour) => onChange({ iconColour })}
                />
            </div>

            <div>
                <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm text-color-text-primary">
                        Stroke width
                    </span>
                    <ResetButton
                        show={isOverridden("strokeWidth")}
                        onClick={() => onReset("strokeWidth")}
                    />
                </div>
                <StrokeWidthInput
                    value={resolved.strokeWidth ?? 2}
                    onCommit={(strokeWidth) => onChange({ strokeWidth })}
                />
            </div>

            {showOutlineOpacity && (
                <div>
                    <div className="mb-1 flex items-center justify-between">
                        <span className="text-sm text-color-text-primary">
                            Outline opacity
                        </span>
                        <ResetButton
                            show={isOverridden("outlineOpacity")}
                            onClick={() => onReset("outlineOpacity")}
                        />
                    </div>
                    <Slider
                        min={0}
                        max={100}
                        step={1}
                        value={Math.round((resolved.outlineOpacity ?? 1) * 100)}
                        aria-label="Outline opacity"
                        onChange={(e) =>
                            onChange({
                                outlineOpacity: Number(e.target.value) / 100,
                            })
                        }
                    />
                </div>
            )}

            <div>
                <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm text-color-text-primary">
                        Line style
                    </span>
                    <ResetButton
                        show={isOverridden("lineDash")}
                        onClick={() => onReset("lineDash")}
                    />
                </div>
                <Select
                    aria-label="Line style"
                    value={resolved.lineDash ?? "solid"}
                    onChange={(e) =>
                        onChange({
                            lineDash: e.target
                                .value as FeatureStyle["lineDash"],
                        })
                    }
                >
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                </Select>
            </div>

            <div>
                <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm text-color-text-primary">
                        Label
                    </span>
                    <ResetButton
                        show={isOverridden("label")}
                        onClick={() => onReset("label")}
                    />
                </div>
                <Input
                    type="text"
                    value={resolved.label ?? ""}
                    aria-label="Label"
                    onChange={(e) => onChange({ label: e.target.value })}
                />
            </div>
        </div>
    );
}
