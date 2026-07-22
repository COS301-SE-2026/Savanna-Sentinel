import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    body: string;
    action?: React.ReactNode;
    className?: string;
}

export function EmptyState({
    icon: Icon,
    title,
    body,
    action,
    className,
}: EmptyStateProps) {
    return (
        <div
            className={cn(
                "mx-auto flex max-w-[400px] flex-col items-center rounded-lg border border-color-border bg-color-surface-raised px-8 py-12 text-center shadow-sm",
                className,
            )}
        >
            <div className="mb-4 flex size-14 items-center justify-center rounded-lg bg-color-surface-bg">
                <Icon
                    className="size-6 text-brand-muted"
                    strokeWidth={1.5}
                    aria-hidden="true"
                />
            </div>
            <div className="mb-2 font-heading text-xl font-bold text-brand-primary">
                {title}
            </div>
            <p className="mb-6 max-w-[30ch] text-sm leading-relaxed text-color-text-primary">
                {body}
            </p>
            {action}
        </div>
    );
}
