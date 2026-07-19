import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";

function Select({
    className,
    iconClassName,
    ...props
}: React.ComponentProps<"select"> & { iconClassName?: string }) {
    return (
        // doesnt match BSG exactly due to React reasons, so dont worry about the mismatch
        <div className={cn("relative rounded-md", className)}>
            <select
                data-slot="select"
                className={cn(
                    "min-h-11 w-full appearance-none rounded-md border-[1.5px] border-color-input-border bg-color-surface-raised px-3 pr-8 text-base text-color-text-primary outline-none transition-[border-color,outline-color] cursor-pointer hover:border-brand-steel focus:border-brand-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary focus-visible:[--tw-outline-style:solid] aria-invalid:border-status-critical disabled:cursor-not-allowed disabled:border-color-border disabled:bg-color-surface-bg disabled:text-color-input-border md:text-sm",
                    className,
                )}
                {...props}
            />
            <ChevronDownIcon
                className={cn(
                    "pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-color-text-secondary",
                    iconClassName,
                )}
            />
        </div>
    );
}

export { Select };
