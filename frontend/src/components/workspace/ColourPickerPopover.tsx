import { Popover } from "radix-ui";
import { HexColorPicker, HexColorInput } from "react-colorful";

import { WORKSPACE_QUICK_COLOURS } from "@/lib/workspace/colours";

export interface ColourPickerPopoverProps {
    label: string;
    colour: string;
    onChange: (colour: string) => void;
}

export function ColourPickerPopover({
    label,
    colour,
    onChange,
}: ColourPickerPopoverProps) {
    return (
        <Popover.Root>
            <Popover.Trigger asChild>
                <button
                    type="button"
                    aria-label={label}
                    className="flex h-8 w-full items-center gap-2 rounded border border-color-border px-2"
                >
                    <span
                        className="size-5 rounded-full border border-color-border"
                        style={{ backgroundColor: colour }}
                    />
                    <span className="text-sm text-color-text-primary">
                        {colour}
                    </span>
                </button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content
                    side="bottom"
                    align="start"
                    sideOffset={8}
                    className="z-[var(--z-dropdown)] flex w-[212px] flex-col gap-2 rounded-lg border border-color-border bg-color-surface-raised p-2 shadow-md"
                >
                    <HexColorPicker color={colour} onChange={onChange} />
                    <HexColorInput
                        color={colour}
                        onChange={onChange}
                        prefixed
                        aria-label={`${label} hex code`}
                        className="h-8 w-full rounded border border-color-input-border px-2 text-sm text-color-text-primary outline-none focus:border-brand-primary"
                    />
                    <div className="grid grid-cols-6 gap-1">
                        {WORKSPACE_QUICK_COLOURS.map((swatch) => (
                            <button
                                key={swatch.value}
                                type="button"
                                aria-label={swatch.label}
                                aria-pressed={
                                    swatch.value.toLowerCase() ===
                                    colour.toLowerCase()
                                }
                                onClick={() => onChange(swatch.value)}
                                className="size-6 rounded-full border border-color-border"
                                style={{ backgroundColor: swatch.value }}
                            />
                        ))}
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
