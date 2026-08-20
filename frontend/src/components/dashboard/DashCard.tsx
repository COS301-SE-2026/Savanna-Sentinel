import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashCardProps {
    title: string;
    value: string | number;
    subtext?: string;
    icon?: LucideIcon;
    valueClassName?: string;
}

export function DashCard({
    title,
    value,
    subtext,
    icon: Icon,
    valueClassName,
}: DashCardProps) {
    return (
        <div className="rounded-md border border-color-border bg-color-surface-bg p-4">
            <div className="mb-2.5 flex items-start justify-between gap-2">
                <span className="inline-block border-b-2 border-brand-primary pb-2 text-xs font-semibold tracking-stat text-brand-primary uppercase">
                    {title}
                </span>
                {Icon && (
                    <Icon
                        className="h-4 w-4 shrink-0 text-color-text-secondary"
                        strokeWidth={2}
                        aria-hidden="true"
                    />
                )}
            </div>
            <div
                className={cn(
                    "font-heading text-xl font-bold leading-tight text-brand-primary",
                    valueClassName,
                )}
            >
                {value}
            </div>
            {subtext && (
                <p className="mt-0.5 text-xs text-color-text-secondary">
                    {subtext}
                </p>
            )}
        </div>
    );
}

export default DashCard;
