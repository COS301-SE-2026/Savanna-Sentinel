import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { getPaginationItems } from "@/lib/paginationItems";

export interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    trailingAddChip?: boolean;
    className?: string;
}

const chipBaseClass =
    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm border-[1.5px] px-2 text-sm font-medium transition-[background,border-color,color] duration-150 ease-[var(--ease-standard)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary focus-visible:[--tw-outline-style:solid]";

const inactiveChipClass =
    "border-color-border bg-color-surface-raised text-color-text-primary hover:border-brand-muted hover:bg-color-surface-bg";

const activeChipClass =
    "border-brand-primary bg-brand-primary font-semibold text-color-text-inverse";

export function Pagination({
    currentPage,
    totalPages,
    onPageChange,
    trailingAddChip = false,
    className,
}: PaginationProps) {
    const items = getPaginationItems(currentPage, totalPages);
    const addChipPage = totalPages + 1;
    const isOnAddChip = trailingAddChip && currentPage === addChipPage;
    const isFirstPage = currentPage <= 1;
    const isLastPage = trailingAddChip
        ? currentPage >= addChipPage
        : currentPage >= totalPages;

    return (
        <nav
            aria-label="Page navigation"
            className={cn("flex flex-wrap items-center gap-1", className)}
        >
            <button
                type="button"
                aria-label="Previous page"
                disabled={isFirstPage}
                onClick={() => onPageChange(currentPage - 1)}
                className={cn(
                    chipBaseClass,
                    inactiveChipClass,
                    "disabled:cursor-not-allowed disabled:opacity-35 disabled:pointer-events-none",
                )}
            >
                <ChevronLeft className="size-4" aria-hidden="true" />
            </button>

            {items.map((item, index) =>
                item === "ellipsis" ? (
                    <span
                        key={`ellipsis-${index}`}
                        aria-hidden="true"
                        className="inline-flex min-h-11 min-w-11 items-center justify-center text-sm text-color-text-primary select-none"
                    >
                        ...
                    </span>
                ) : (
                    <button
                        key={item}
                        type="button"
                        aria-current={currentPage === item ? "page" : undefined}
                        onClick={() => onPageChange(item)}
                        className={cn(
                            chipBaseClass,
                            currentPage === item
                                ? activeChipClass
                                : inactiveChipClass,
                        )}
                    >
                        {item}
                    </button>
                ),
            )}

            {trailingAddChip && (
                <button
                    type="button"
                    aria-label="Start a new draft"
                    aria-current={isOnAddChip ? "page" : undefined}
                    onClick={() => onPageChange(addChipPage)}
                    className={cn(
                        chipBaseClass,
                        isOnAddChip ? activeChipClass : inactiveChipClass,
                    )}
                >
                    <Plus className="size-4" aria-hidden="true" />
                </button>
            )}

            <button
                type="button"
                aria-label="Next page"
                disabled={isLastPage}
                onClick={() => onPageChange(currentPage + 1)}
                className={cn(
                    chipBaseClass,
                    inactiveChipClass,
                    "disabled:cursor-not-allowed disabled:opacity-35 disabled:pointer-events-none",
                )}
            >
                <ChevronRight className="size-4" aria-hidden="true" />
            </button>
        </nav>
    );
}
