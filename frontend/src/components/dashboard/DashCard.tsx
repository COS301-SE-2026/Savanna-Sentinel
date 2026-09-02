import { icons, CircleDashed, type LucideIcon } from "lucide-react";

interface DashCardProps {
    label: string;
    value: string | number;
    unit?: string | null;
    badge?: LucideIcon | string;
}

export function DashCard({ label, value, badge: Icon }: DashCardProps) {
    const IconComponent =
        typeof Icon === "string"
            ? (icons[Icon as keyof typeof icons] ?? CircleDashed)
            : (Icon ?? CircleDashed);

    return (
        <div className="rounded-md border border-color-border bg-color-surface-bg p-4">
            <div className="mb-2.5 flex items-start justify-between gap-2">
                <span className="inline-block border-b-2 border-brand-primary pb-2 text-xs font-semibold tracking-stat text-brand-primary uppercase">
                    {label}
                </span>
                {Icon && (
                    <IconComponent
                        className="h-4 w-4 shrink-0 text-color-text-secondary"
                        strokeWidth={2}
                        aria-hidden="true"
                    />
                )}
            </div>
            <div className="font-heading text-xl font-bold leading-tight text-brand-primary">
                {value}
            </div>
        </div>
    );
}

export default DashCard;
