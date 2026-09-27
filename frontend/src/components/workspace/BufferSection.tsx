import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { resolveMembershipStyle } from "@/lib/workspace/styleResolution";
import {
    MAX_BUFFER_DISTANCE_M,
    MIN_BUFFER_DISTANCE_M,
} from "@/lib/workspace/types";
import type {
    WorkspaceFeature,
    WorkspaceMembership,
} from "@/lib/workspace/types";
import { BufferStyleFields } from "./BufferStyleFields";

function BufferDistanceInput({
    value,
    onCommit,
}: {
    value: number;
    onCommit: (distanceM: number) => void;
}) {
    const [draft, setDraft] = useState<string | null>(null);
    return (
        <Input
            type="number"
            min={MIN_BUFFER_DISTANCE_M}
            max={MAX_BUFFER_DISTANCE_M}
            value={draft ?? String(value)}
            aria-label="Buffer distance in metres"
            onChange={(e) => {
                setDraft(e.target.value);
                const parsed = Number(e.target.value);
                if (
                    e.target.value !== "" &&
                    parsed >= MIN_BUFFER_DISTANCE_M &&
                    parsed <= MAX_BUFFER_DISTANCE_M
                )
                    onCommit(parsed);
            }}
            onBlur={() => setDraft(null)}
        />
    );
}

export interface BufferSectionProps {
    feature: WorkspaceFeature;
    membership: WorkspaceMembership;
}

export function BufferSection({ feature, membership }: BufferSectionProps) {
    const layers = useWorkspaceStore((s) => s.layers);
    const setFeatureBuffer = useWorkspaceStore((s) => s.setFeatureBuffer);
    const setMembershipStyleOverride = useWorkspaceStore(
        (s) => s.setMembershipStyleOverride,
    );
    const resetMembershipStyleProperty = useWorkspaceStore(
        (s) => s.resetMembershipStyleProperty,
    );

    return (
        <div className="flex flex-col gap-4 border-t border-color-border p-3">
            <p className="text-sm font-semibold text-color-text-primary">
                Buffer
            </p>

            <label className="flex items-center gap-2 text-sm text-color-text-primary">
                <Checkbox
                    checked={feature.bufferEnabled}
                    aria-label="Enable buffer"
                    onChange={(e) =>
                        setFeatureBuffer(feature.id, {
                            enabled: e.target.checked,
                        })
                    }
                />
                Enable buffer
            </label>

            {feature.bufferEnabled && (
                <>
                    <div>
                        <span className="mb-1 block text-sm text-color-text-primary">
                            Distance (metres)
                        </span>
                        <Slider
                            min={MIN_BUFFER_DISTANCE_M}
                            max={MAX_BUFFER_DISTANCE_M}
                            step={1}
                            value={feature.bufferDistanceM}
                            aria-label="Buffer distance slider"
                            onChange={(e) =>
                                setFeatureBuffer(feature.id, {
                                    distanceM: Number(e.target.value),
                                })
                            }
                        />
                        <div className="mt-2">
                            <BufferDistanceInput
                                value={feature.bufferDistanceM}
                                onCommit={(distanceM) =>
                                    setFeatureBuffer(feature.id, { distanceM })
                                }
                            />
                        </div>
                    </div>
                    <BufferStyleFields
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
                    />
                </>
            )}
        </div>
    );
}
