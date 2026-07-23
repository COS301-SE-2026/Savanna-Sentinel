import * as React from "react";

import { cn } from "@/lib/utils";

function Checkbox({
    className,
    indeterminate = false,
    ...props
}: React.ComponentProps<"input"> & { indeterminate?: boolean }) {
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (inputRef.current) {
            inputRef.current.indeterminate = indeterminate;
        }
    }, [indeterminate]);

    return (
        <input
            type="checkbox"
            data-slot="checkbox"
            {...props}
            ref={inputRef}
            className={cn(
                "relative size-4 shrink-0 appearance-none rounded-xs border-2 border-color-border bg-color-surface-raised outline-none transition-colors hover:border-brand-steel checked:border-brand-primary checked:bg-brand-primary checked:hover:border-brand-primary indeterminate:border-brand-primary indeterminate:bg-brand-primary indeterminate:hover:border-brand-primary after:absolute after:inset-0 after:m-auto after:hidden after:size-1.5 after:rounded-[1px] after:bg-color-text-inverse after:content-[''] checked:after:block indeterminate:after:block indeterminate:after:h-0.5 indeterminate:after:w-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary focus-visible:[--tw-outline-style:solid] disabled:cursor-not-allowed disabled:border-color-border disabled:bg-color-surface-bg disabled:checked:border-color-border disabled:checked:bg-color-border disabled:checked:after:bg-color-text-secondary",
                className,
            )}
        />
    );
}

export { Checkbox };
