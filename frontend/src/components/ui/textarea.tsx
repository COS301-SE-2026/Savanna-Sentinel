import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
    return (
        <textarea
            data-slot="textarea"
            className={cn(
                "min-h-24 w-full min-w-0 resize-y rounded-md border-[1.5px] border-color-input-border bg-color-surface-raised px-2.5 py-2 text-base text-color-text-primary shadow-xs transition-[color,box-shadow,border-color] outline-none placeholder:text-color-input-border focus:border-brand-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary focus-visible:[--tw-outline-style:solid] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-color-surface-bg aria-invalid:border-status-critical md:text-sm",
                className,
            )}
            {...props}
        />
    );
}

export { Textarea };
