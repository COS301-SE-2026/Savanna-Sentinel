import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useWorkspaceStore } from "@/store/workspaceStore";
import {
    resolveFeatureRule,
    resolveLayerRule,
    type ResolvedRuleView,
    type RuleProperty,
} from "@/lib/workspace/rules";
import {
    getFeatureDisplayName,
    getLayerDisplayName,
} from "@/lib/workspace/featureDisplay";
import {
    MAX_RULE_PRIORITY,
    MIN_RULE_PRIORITY,
    RULE_INTENTS,
    type RuleIntent,
    type RuleSettings,
} from "@/lib/workspace/types";
import { PriorityOverviewDialog } from "./PriorityOverviewDialog";
import { ResetButton } from "./ResetButton";

export type RuleTarget =
    { kind: "feature"; featureId: string } | { kind: "layer"; layerId: string };

const INTENT_META: Record<RuleIntent, { label: string; hint: string }> = {
    increase_risk: {
        label: "Increase risk",
        hint: "Cells here score higher on the heatmap.",
    },
    decrease_risk: {
        label: "Decrease risk",
        hint: "Cells here score lower on the heatmap.",
    },
    prefer: {
        label: "Prefer following",
        hint: "Patrol routes are steered towards this.",
    },
    avoid: {
        label: "Avoid following",
        hint: "Patrol routes are steered away from this.",
    },
};

const PROPERTY_LABEL: Record<Exclude<RuleProperty, "enabled">, string> = {
    strength: "strength",
    bufferDecay: "buffer decay",
    priority: "priority",
};

function PriorityInput({
    label,
    value,
    onCommit,
}: {
    label: string;
    value: number;
    onCommit: (priority: number) => void;
}) {
    const [draft, setDraft] = useState<string | null>(null);
    return (
        <Input
            type="number"
            min={MIN_RULE_PRIORITY}
            max={MAX_RULE_PRIORITY}
            step={1}
            value={draft ?? String(value)}
            aria-label={label}
            onChange={(e) => {
                setDraft(e.target.value);
                const parsed = Number(e.target.value);
                if (
                    e.target.value !== "" &&
                    Number.isInteger(parsed) &&
                    parsed >= MIN_RULE_PRIORITY &&
                    parsed <= MAX_RULE_PRIORITY
                )
                    onCommit(parsed);
            }}
            onBlur={() => setDraft(null)}
        />
    );
}

interface IntentSectionProps {
    intent: RuleIntent;
    view: ResolvedRuleView;
    inheritedFrom: string;
    hasBuffer: boolean;
    canReset: boolean;
    onChange: (patch: RuleSettings) => void;
    onReset: (property: RuleProperty) => void;
}

function IntentSection({
    intent,
    view,
    inheritedFrom,
    hasBuffer,
    canReset,
    onChange,
    onReset,
}: IntentSectionProps) {
    const { label, hint } = INTENT_META[intent];

    const header = (
        property: Exclude<RuleProperty, "enabled">,
        valueText?: string,
    ) => (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="flex items-baseline gap-2 text-sm text-color-text-primary">
                {PROPERTY_LABEL[property][0].toUpperCase() +
                    PROPERTY_LABEL[property].slice(1)}
                {valueText && (
                    <span className="text-xs text-color-text-secondary tabular-nums">
                        {valueText}
                    </span>
                )}
            </span>
            <span className="flex items-center gap-2">
                {view.source[property] === "inherited" && (
                    <span className="text-xs text-color-text-secondary">
                        Inherited from {inheritedFrom}
                    </span>
                )}
                <ResetButton
                    show={canReset && view.source[property] === "own"}
                    label={`Reset ${label} ${PROPERTY_LABEL[property]}`}
                    onClick={() => onReset(property)}
                />
            </span>
        </div>
    );

    return (
        <section className="rounded-md border border-color-border p-4">
            <label className="flex items-center gap-3 text-sm font-semibold text-color-text-primary">
                <Checkbox
                    checked={view.enabled}
                    aria-label={label}
                    onChange={(e) => onChange({ enabled: e.target.checked })}
                />
                {label}
            </label>
            <p className="m-0 mt-1 pl-7 text-xs text-color-text-secondary">
                {hint}
            </p>

            {view.enabled && (
                <div className="mt-4 flex flex-col gap-4 border-t border-color-border pt-4">
                    <div className="flex flex-col gap-2">
                        {header(
                            "strength",
                            `${Math.round(view.values.strength * 100)}%`,
                        )}
                        <Slider
                            min={10}
                            max={100}
                            step={5}
                            value={Math.round(view.values.strength * 100)}
                            aria-label={`${label} strength`}
                            onChange={(e) =>
                                onChange({
                                    strength: Number(e.target.value) / 100,
                                })
                            }
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        {header(
                            "bufferDecay",
                            `${Math.round(view.values.bufferDecay * 100)}%`,
                        )}
                        <Slider
                            min={0}
                            max={100}
                            step={5}
                            value={Math.round(view.values.bufferDecay * 100)}
                            disabled={!hasBuffer}
                            aria-label={`${label} buffer decay`}
                            onChange={(e) =>
                                onChange({
                                    bufferDecay: Number(e.target.value) / 100,
                                })
                            }
                        />
                        {!hasBuffer && (
                            <p className="m-0 text-xs text-color-text-secondary">
                                Turn on the buffer to use decay.
                            </p>
                        )}
                    </div>

                    <div className="flex flex-col gap-2">
                        {header("priority")}
                        <PriorityInput
                            label={`${label} priority`}
                            value={view.values.priority}
                            onCommit={(priority) => onChange({ priority })}
                        />
                    </div>
                </div>
            )}
        </section>
    );
}

export interface RuleEditorDialogProps {
    target: RuleTarget;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function RuleEditorDialog({
    target,
    open,
    onOpenChange,
}: RuleEditorDialogProps) {
    const [isOverviewOpen, setOverviewOpen] = useState(false);
    const layers = useWorkspaceStore((s) => s.layers);
    const features = useWorkspaceStore((s) => s.features);
    const memberships = useWorkspaceStore((s) => s.memberships);
    const setFeatureRule = useWorkspaceStore((s) => s.setFeatureRule);
    const clearFeatureRuleProperty = useWorkspaceStore(
        (s) => s.clearFeatureRuleProperty,
    );
    const setLayerDefaultRule = useWorkspaceStore((s) => s.setLayerDefaultRule);
    const clearLayerDefaultRuleProperty = useWorkspaceStore(
        (s) => s.clearLayerDefaultRuleProperty,
    );

    const feature =
        target.kind === "feature"
            ? features.find((f) => f.id === target.featureId)
            : undefined;
    const layer =
        target.kind === "layer"
            ? layers.find((l) => l.id === target.layerId)
            : undefined;
    if (!feature && !layer) return null;

    const title = feature
        ? `Behaviour: ${getFeatureDisplayName(feature)}`
        : `Layer behaviour: ${getLayerDisplayName(layer!)}`;
    const hasBuffer = feature ? feature.bufferEnabled : true;
    const inheritedFrom = feature ? "layer" : "parent layer";
    const canReset = feature !== undefined || layer!.parentId !== null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-lg">
                <DialogHeader className="shrink-0 items-center">
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>

                <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-6 py-5">
                    <DialogDescription className="p-0 text-sm text-color-text-secondary">
                        Rules shape the heatmap and patrol routes. Where rules
                        overlap, even within one feature, the highest priority
                        number wins. Risk and route rules are compared
                        separately. Equal priorities all apply.
                    </DialogDescription>

                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-haspopup="dialog"
                        className="self-start"
                        onClick={() => setOverviewOpen(true)}
                    >
                        Compare priorities across features
                    </Button>

                    {RULE_INTENTS.map((intent) => (
                        <IntentSection
                            key={intent}
                            intent={intent}
                            view={
                                feature
                                    ? resolveFeatureRule(
                                          layers,
                                          memberships,
                                          feature,
                                          intent,
                                      )
                                    : resolveLayerRule(
                                          layers,
                                          layer!.id,
                                          intent,
                                      )
                            }
                            inheritedFrom={inheritedFrom}
                            hasBuffer={hasBuffer}
                            canReset={canReset}
                            onChange={(patch) =>
                                feature
                                    ? setFeatureRule(feature.id, intent, patch)
                                    : setLayerDefaultRule(
                                          layer!.id,
                                          intent,
                                          patch,
                                      )
                            }
                            onReset={(property) =>
                                feature
                                    ? clearFeatureRuleProperty(
                                          feature.id,
                                          intent,
                                          property,
                                      )
                                    : clearLayerDefaultRuleProperty(
                                          layer!.id,
                                          intent,
                                          property,
                                      )
                            }
                        />
                    ))}
                </div>
            </DialogContent>
            <PriorityOverviewDialog
                open={isOverviewOpen}
                onOpenChange={setOverviewOpen}
            />
        </Dialog>
    );
}
