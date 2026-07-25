import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { SortDirection } from "@/hooks/useSort";

interface SortableTableHeadProps {
    label: string;
    active: boolean;
    direction: SortDirection;
    onSort: () => void;
    className?: string;
}

export function SortableTableHead({
    label,
    active,
    direction,
    onSort,
    className,
}: SortableTableHeadProps) {
    const Icon = active
        ? direction === "asc"
            ? ChevronUp
            : ChevronDown
        : ChevronsUpDown;

    return (
        <TableHead
            aria-sort={
                active
                    ? direction === "asc"
                        ? "ascending"
                        : "descending"
                    : "none"
            }
            className={cn(
                "px-4 py-3 text-left font-heading text-xs font-bold tracking-[0.8px] whitespace-nowrap text-color-text-inverse uppercase",
                className,
            )}
        >
            <button
                type="button"
                onClick={onSort}
                className="relative flex items-center gap-1 rounded-sm px-1 py-0.5 -mx-1 transition-colors before:absolute before:-inset-3 before:content-[''] hover:bg-color-text-inverse/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-color-text-inverse focus-visible:[--tw-outline-style:solid]"
            >
                {label}
                <Icon
                    className={cn(
                        "size-3.5 shrink-0",
                        active ? "opacity-100" : "opacity-60",
                    )}
                    aria-hidden="true"
                />
            </button>
        </TableHead>
    );
}
