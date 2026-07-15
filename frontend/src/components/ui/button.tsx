/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary focus-visible:[--tw-outline-style:solid] disabled:pointer-events-none disabled:opacity-[0.38] aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    {
        variants: {
            variant: {
                default:
                    "bg-brand-primary text-color-text-inverse hover:bg-brand-primary/87 active:bg-[linear-gradient(color-mix(in_srgb,currentColor_12%,transparent),color-mix(in_srgb,currentColor_12%,transparent))] active:shadow-[inset_0_6px_4px_rgba(0,0,0,0.1)]",
                outline:
                    "border-brand-primary bg-color-surface-raised text-brand-primary hover:bg-color-surface-bg active:bg-[linear-gradient(color-mix(in_srgb,currentColor_12%,transparent),color-mix(in_srgb,currentColor_12%,transparent))] active:shadow-[inset_0_6px_4px_rgba(0,0,0,0.1)]",
                secondary:
                    "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground active:not-aria-[haspopup]:translate-y-px",
                ghost: "text-color-text-primary opacity-65 hover:opacity-100 hover:bg-color-surface-bg focus-visible:opacity-100",
                destructive:
                    "bg-status-critical text-color-text-inverse hover:bg-status-critical/80 active:bg-[linear-gradient(color-mix(in_srgb,currentColor_12%,transparent),color-mix(in_srgb,currentColor_12%,transparent))] active:shadow-[inset_0_6px_4px_rgba(0,0,0,0.1)]",
                link: "text-primary underline-offset-4 hover:underline active:not-aria-[haspopup]:translate-y-px",
            },
            size: {
                default:
                    "h-9 gap-1.5 px-2.5 in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
                xs: "h-6 gap-1 rounded-[min(var(--radius-md),8px)] px-2 text-xs in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
                sm: "h-8 gap-1 rounded-[min(var(--radius-md),10px)] px-2.5 in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5",
                lg: "h-10 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
                icon: "size-11 p-0",
                "icon-xs":
                    "size-6 rounded-[min(var(--radius-md),8px)] in-data-[slot=button-group]:rounded-md [&_svg:not([class*='size-'])]:size-3",
                "icon-sm":
                    "size-8 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-md",
                "icon-lg": "size-10",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    },
);

function Button({
    className,
    variant = "default",
    size = "default",
    asChild = false,
    ...props
}: React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
        asChild?: boolean;
    }) {
    const Comp = asChild ? Slot.Root : "button";

    return (
        <Comp
            data-slot="button"
            data-variant={variant}
            data-size={size}
            className={cn(buttonVariants({ variant, size, className }))}
            {...props}
        />
    );
}

export { Button, buttonVariants };
