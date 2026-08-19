import * as React from "react";

import { cn } from "@/lib/utils";

const thumbStyles =
    "[&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-brand-primary [&::-webkit-slider-thumb]:bg-color-text-inverse [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-grab " +
    "[&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-brand-primary [&::-moz-range-thumb]:bg-color-text-inverse [&::-moz-range-thumb]:shadow-sm [&::-moz-range-thumb]:cursor-grab";

function Slider({
    className,
    style,
    min = 0,
    max = 100,
    value,
    disabled,
    ...props
}: React.ComponentProps<"input">) {
    const percent =
        value !== undefined &&
        typeof min === "number" &&
        typeof max === "number"
            ? ((Number(value) - min) / (max - min)) * 100
            : 0;

    return (
        <input
            type="range"
            data-slot="slider"
            min={min}
            max={max}
            value={value}
            disabled={disabled}
            className={cn(
                "h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary focus-visible:[--tw-outline-style:solid]",
                "disabled:cursor-not-allowed disabled:opacity-[0.38]",
                thumbStyles,
                className,
            )}
            style={{
                background: `linear-gradient(to right, var(--color-brand-primary) ${percent}%, var(--color-color-border) ${percent}%)`,
                ...style,
            }}
            {...props}
        />
    );
}

export { Slider };
