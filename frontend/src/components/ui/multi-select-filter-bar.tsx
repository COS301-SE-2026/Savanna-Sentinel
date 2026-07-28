import * as React from "react";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
    value: string;
    label: string;
}

export interface MultiSelectFilterGroup {
    key: string;
    label: string;
    chipLabel?: string;
    options: MultiSelectOption[];
    selected: string[];
    onChange: (values: string[]) => void;
}

interface MultiSelectFilterBarProps {
    search: string;
    onSearchChange: (value: string) => void;
    searchPlaceholder: string;
    groups: MultiSelectFilterGroup[];
}

export function MultiSelectFilterBar({
    search,
    onSearchChange,
    searchPlaceholder,
    groups,
}: MultiSelectFilterBarProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    const [openGroupKey, setOpenGroupKey] = React.useState<string | null>(null);
    const [draftSelections, setDraftSelections] = React.useState<
        Record<string, string[]>
    >(() => Object.fromEntries(groups.map((g) => [g.key, g.selected])));
    const wrapperRef = React.useRef<HTMLDivElement>(null);
    const groupRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
    const isMobile = useIsMobile();
    const baseId = React.useId();

    const openGroupKeyRef = React.useRef(openGroupKey);
    React.useEffect(() => {
        openGroupKeyRef.current = openGroupKey;
    }, [openGroupKey]);

    const activeCount = groups.reduce((sum, g) => sum + g.selected.length, 0);

    const openPanel = () => {
        setDraftSelections(
            Object.fromEntries(groups.map((g) => [g.key, g.selected])),
        );
        setOpenGroupKey(null);
        setIsOpen(true);
    };

    React.useEffect(() => {
        if (!isOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node;
            const currentGroupKey = openGroupKeyRef.current;
            const isInsideOpenGroup = currentGroupKey
                ? (groupRefs.current[currentGroupKey]?.contains(target) ??
                  false)
                : false;

            if (currentGroupKey && !isInsideOpenGroup) {
                setOpenGroupKey(null);
            }
            if (wrapperRef.current && !wrapperRef.current.contains(target)) {
                setIsOpen(false);
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            if (openGroupKeyRef.current) {
                setOpenGroupKey(null);
                return;
            }
            setIsOpen(false);
        };

        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen]);

    const toggleDraftValue = (groupKey: string, value: string) => {
        setDraftSelections((prev) => {
            const current = prev[groupKey] ?? [];
            return {
                ...prev,
                [groupKey]: current.includes(value)
                    ? current.filter((v) => v !== value)
                    : [...current, value],
            };
        });
    };

    const toggleSelectAll = (group: MultiSelectFilterGroup) => {
        const current = draftSelections[group.key] ?? [];
        const allSelected =
            group.options.length > 0 && current.length === group.options.length;
        setDraftSelections((prev) => ({
            ...prev,
            [group.key]: allSelected ? [] : group.options.map((o) => o.value),
        }));
    };

    const handleApply = () => {
        groups.forEach((g) => g.onChange(draftSelections[g.key] ?? []));
        setIsOpen(false);
    };

    const handleClear = () => {
        setDraftSelections(Object.fromEntries(groups.map((g) => [g.key, []])));
    };

    const removeChip = (group: MultiSelectFilterGroup, value: string) => {
        setDraftSelections((prev) => ({
            ...prev,
            [group.key]: (prev[group.key] ?? []).filter((v) => v !== value),
        }));
        group.onChange(group.selected.filter((v) => v !== value));
    };

    const labelFor = (group: MultiSelectFilterGroup, value: string) =>
        group.options.find((o) => o.value === value)?.label ?? value;

    const summaryFor = (group: MultiSelectFilterGroup) => {
        const draft = draftSelections[group.key] ?? [];
        if (draft.length === 0) return "None Selected";
        if (draft.length === 1) return labelFor(group, draft[0]);
        return `${draft.length} selected`;
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search
                        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-brand-muted"
                        aria-hidden="true"
                    />
                    <Input
                        type="search"
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder={searchPlaceholder}
                        aria-label={searchPlaceholder}
                        className="pl-10 pr-10 [&::-webkit-search-cancel-button]:appearance-none"
                    />
                    {search.length > 0 && (
                        <button
                            type="button"
                            aria-label="Clear search"
                            onClick={() => onSearchChange("")}
                            className="absolute top-1/2 right-3 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded-full bg-color-border text-color-text-secondary transition-colors before:absolute before:-inset-3 before:content-[''] hover:bg-status-critical hover:text-color-text-inverse focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary focus-visible:[--tw-outline-style:solid]"
                        >
                            <X className="size-3" aria-hidden="true" />
                        </button>
                    )}
                </div>

                <div ref={wrapperRef} className="relative shrink-0">
                    <Button
                        type="button"
                        variant="outline"
                        aria-label={
                            activeCount > 0
                                ? `Open filters, ${activeCount} active`
                                : "Open filters"
                        }
                        onClick={() =>
                            isOpen ? setIsOpen(false) : openPanel()
                        }
                    >
                        <SlidersHorizontal
                            className="size-4"
                            aria-hidden="true"
                        />
                        Filters
                        {activeCount > 0 && (
                            <span
                                aria-hidden="true"
                                className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-primary px-1 text-xs font-bold text-color-text-inverse"
                            >
                                {activeCount}
                            </span>
                        )}
                    </Button>

                    {isOpen && (
                        <div
                            className={cn(
                                "z-[300] rounded-lg border border-color-border bg-color-surface-raised shadow-md",
                                isMobile
                                    ? "fixed inset-x-0 bottom-0 w-full rounded-b-none"
                                    : "absolute top-full right-0 mt-2 w-80 max-w-[calc(100vw-2rem)]",
                            )}
                        >
                            <div className="border-b border-color-border px-4 py-3">
                                <span className="font-heading text-base font-bold text-brand-primary">
                                    Filters
                                </span>
                            </div>
                            <div className="flex flex-col gap-5 p-4">
                                {groups.map((group) => {
                                    const draft =
                                        draftSelections[group.key] ?? [];
                                    const isGroupOpen =
                                        openGroupKey === group.key;
                                    const isAllSelected =
                                        group.options.length > 0 &&
                                        draft.length === group.options.length;
                                    const isSomeSelected =
                                        draft.length > 0 && !isAllSelected;
                                    const triggerId = `${baseId}-${group.key}-trigger`;
                                    const panelId = `${baseId}-${group.key}-panel`;

                                    return (
                                        <div
                                            key={group.key}
                                            className="flex flex-col gap-2"
                                        >
                                            <span
                                                id={`${triggerId}-label`}
                                                className="text-sm font-semibold tracking-wide text-color-text-secondary uppercase"
                                            >
                                                {group.label}
                                            </span>
                                            <div
                                                ref={(el) => {
                                                    groupRefs.current[
                                                        group.key
                                                    ] = el;
                                                }}
                                                className="relative"
                                            >
                                                <button
                                                    type="button"
                                                    id={triggerId}
                                                    aria-haspopup="listbox"
                                                    aria-expanded={isGroupOpen}
                                                    aria-controls={panelId}
                                                    aria-labelledby={`${triggerId}-label ${triggerId}`}
                                                    onClick={() =>
                                                        setOpenGroupKey(
                                                            isGroupOpen
                                                                ? null
                                                                : group.key,
                                                        )
                                                    }
                                                    className={cn(
                                                        "flex min-h-11 w-full items-center justify-between gap-2 rounded-md border-[1.5px] border-color-input-border bg-color-surface-raised py-3 pr-8 pl-3 text-left text-sm text-color-text-primary outline-none transition-colors hover:border-brand-steel focus-visible:border-brand-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary focus-visible:[--tw-outline-style:solid]",
                                                        isGroupOpen &&
                                                            "border-brand-primary",
                                                    )}
                                                >
                                                    <span
                                                        className={cn(
                                                            "truncate",
                                                            draft.length ===
                                                                0 &&
                                                                "text-color-input-border",
                                                        )}
                                                    >
                                                        {summaryFor(group)}
                                                    </span>
                                                    <ChevronDown
                                                        aria-hidden="true"
                                                        className={cn(
                                                            "size-4 shrink-0 text-color-text-secondary transition-transform",
                                                            isGroupOpen &&
                                                                "rotate-180",
                                                        )}
                                                    />
                                                </button>

                                                {isGroupOpen && (
                                                    <ul
                                                        id={panelId}
                                                        role="listbox"
                                                        aria-multiselectable="true"
                                                        className="absolute top-full left-0 z-10 mt-1 max-h-60 w-full list-none overflow-y-auto rounded-md border border-color-border bg-color-surface-raised p-1 shadow-md"
                                                    >
                                                        <li>
                                                            <label className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-sm p-2 hover:bg-brand-primary/[0.06]">
                                                                <Checkbox
                                                                    checked={
                                                                        isAllSelected
                                                                    }
                                                                    indeterminate={
                                                                        isSomeSelected
                                                                    }
                                                                    onChange={() =>
                                                                        toggleSelectAll(
                                                                            group,
                                                                        )
                                                                    }
                                                                />
                                                                <span className="text-sm text-color-text-primary">
                                                                    Select all
                                                                </span>
                                                            </label>
                                                        </li>
                                                        {group.options.map(
                                                            (option) => (
                                                                <li
                                                                    key={
                                                                        option.value
                                                                    }
                                                                >
                                                                    <label className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-sm p-2 hover:bg-brand-primary/[0.06]">
                                                                        <Checkbox
                                                                            checked={draft.includes(
                                                                                option.value,
                                                                            )}
                                                                            onChange={() =>
                                                                                toggleDraftValue(
                                                                                    group.key,
                                                                                    option.value,
                                                                                )
                                                                            }
                                                                        />
                                                                        <span className="text-sm text-color-text-primary">
                                                                            {
                                                                                option.label
                                                                            }
                                                                        </span>
                                                                    </label>
                                                                </li>
                                                            ),
                                                        )}
                                                    </ul>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex justify-end gap-3 border-t border-color-border px-4 py-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleClear}
                                >
                                    Clear
                                </Button>
                                <Button type="button" onClick={handleApply}>
                                    Apply
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {activeCount > 0 && (
                <div className="flex flex-wrap gap-2">
                    {groups.flatMap((group) =>
                        group.selected.map((value) => {
                            const chipLabel = group.chipLabel ?? group.label;
                            return (
                                <div
                                    key={`${group.key}-${value}`}
                                    className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-color-border bg-color-surface-raised py-2 pr-2 pl-4 text-sm font-medium text-color-text-primary"
                                >
                                    {chipLabel}: {labelFor(group, value)}
                                    <button
                                        type="button"
                                        aria-label={`Remove ${chipLabel.toLowerCase()} filter: ${labelFor(group, value)}`}
                                        onClick={() => removeChip(group, value)}
                                        className="relative inline-flex size-5 items-center justify-center rounded-full bg-color-border text-color-text-secondary transition-colors hover:bg-status-critical hover:text-color-text-inverse focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary focus-visible:[--tw-outline-style:solid] before:absolute before:-inset-3"
                                    >
                                        <X
                                            className="size-3"
                                            aria-hidden="true"
                                        />
                                    </button>
                                </div>
                            );
                        }),
                    )}
                </div>
            )}
        </div>
    );
}
