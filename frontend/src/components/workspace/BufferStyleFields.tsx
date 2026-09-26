import { Slider } from "@/components/ui/slider";
import { resolveBufferAppearance } from "@/lib/workspace/styleResolution";
import type { FeatureStyle } from "@/lib/workspace/types";
import { ColourPickerPopover } from "./ColourPickerPopover";
import { ResetButton } from "./ResetButton";

export interface BufferStyleFieldsProps {
    resolved: FeatureStyle;
    isOverridden: (prop: "bufferColour" | "bufferOpacity") => boolean;
    onChange: (patch: Partial<FeatureStyle>) => void;
    onReset: (prop: "bufferColour" | "bufferOpacity") => void;
}

export function BufferStyleFields({
    resolved,
    isOverridden,
    onChange,
    onReset,
}: BufferStyleFieldsProps) {
    const appearance = resolveBufferAppearance(resolved);
    return (
        <>
            <div>
                <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm text-color-text-primary">
                        Buffer colour
                    </span>
                    <ResetButton
                        show={isOverridden("bufferColour")}
                        label="Reset buffer colour"
                        onClick={() => onReset("bufferColour")}
                    />
                </div>
                <ColourPickerPopover
                    label="Buffer colour"
                    colour={appearance.colour}
                    onChange={(bufferColour) => onChange({ bufferColour })}
                />
            </div>
            <div>
                <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm text-color-text-primary">
                        Buffer opacity
                    </span>
                    <ResetButton
                        show={isOverridden("bufferOpacity")}
                        label="Reset buffer opacity"
                        onClick={() => onReset("bufferOpacity")}
                    />
                </div>
                <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(appearance.opacity * 100)}
                    aria-label="Buffer opacity"
                    onChange={(e) =>
                        onChange({
                            bufferOpacity: Number(e.target.value) / 100,
                        })
                    }
                />
            </div>
        </>
    );
}
