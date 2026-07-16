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

interface UserSearchFilterBarProps {
    search: string;
    onSearchChange: (value: string) => void;
    searchPlaceholder: string;
    roleOptions: MultiSelectOption[];
    selectedRoles: string[];
    onRolesChange: (roles: string[]) => void;
}

export function UserSearchFilterBar({
    search,
    onSearchChange,
    searchPlaceholder,
    roleOptions,
    selectedRoles,
    onRolesChange,
}: UserSearchFilterBarProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    const [isRoleListOpen, setIsRoleListOpen] = React.useState(false);
    const [draftRoles, setDraftRoles] = React.useState<string[]>(selectedRoles);
    const wrapperRef = React.useRef<HTMLDivElement>(null);
    const roleMultiselectRef = React.useRef<HTMLDivElement>(null);
    const isMobile = useIsMobile();
    const roleTriggerId = React.useId();
    const rolePanelId = React.useId();

    const openPanel = () => {
        setDraftRoles(selectedRoles);
        setIsRoleListOpen(false);
        setIsOpen(true);
    };

    const isRoleListOpenRef = React.useRef(isRoleListOpen);
    React.useEffect(() => {
        isRoleListOpenRef.current = isRoleListOpen;
    }, [isRoleListOpen]);

    React.useEffect(() => {
        if (!isOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node;
            const isInsideRoleList =
                roleMultiselectRef.current?.contains(target) ?? false;

            if (!isInsideRoleList && isRoleListOpenRef.current) {
                setIsRoleListOpen(false);
            }
            if (wrapperRef.current && !wrapperRef.current.contains(target)) {
                setIsOpen(false);
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            if (isRoleListOpenRef.current) {
                setIsRoleListOpen(false);
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

    const handleApply = () => {
        onRolesChange(draftRoles);
        setIsOpen(false);
    };

    const handleClear = () => {
        setDraftRoles([]);
    };

    const toggleDraftRole = (value: string) => {
        setDraftRoles((prev) =>
            prev.includes(value)
                ? prev.filter((v) => v !== value)
                : [...prev, value],
        );
    };

    const isAllRolesSelected =
        roleOptions.length > 0 && draftRoles.length === roleOptions.length;
    const isSomeRolesSelected = draftRoles.length > 0 && !isAllRolesSelected;

    const toggleSelectAllRoles = () => {
        setDraftRoles(
            isAllRolesSelected ? [] : roleOptions.map((o) => o.value),
        );
    };

    const removeRole = (value: string) => {
        setDraftRoles((prev) => prev.filter((r) => r !== value));
        onRolesChange(selectedRoles.filter((r) => r !== value));
    };

    const labelForRole = (value: string) =>
        roleOptions.find((o) => o.value === value)?.label ?? value;

    const roleSummary =
        draftRoles.length === 0
            ? "None Selected"
            : draftRoles.length === 1
              ? labelForRole(draftRoles[0])
              : `${draftRoles.length} selected`;

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
                        className="min-h-11 min-w-11 gap-2"
                        aria-label={
                            selectedRoles.length > 0
                                ? `Open filters, ${selectedRoles.length} active`
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
                        {selectedRoles.length > 0 && (
                            <span
                                aria-hidden="true"
                                className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-primary px-1 text-xs font-bold text-color-text-inverse"
                            >
                                {selectedRoles.length}
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
                                <div className="flex flex-col gap-2">
                                    <span
                                        id={`${roleTriggerId}-label`}
                                        className="text-sm font-semibold tracking-wide text-color-text-secondary uppercase"
                                    >
                                        Role
                                    </span>
                                    <div
                                        ref={roleMultiselectRef}
                                        className="relative"
                                    >
                                        <button
                                            type="button"
                                            id={roleTriggerId}
                                            aria-haspopup="listbox"
                                            aria-expanded={isRoleListOpen}
                                            aria-controls={rolePanelId}
                                            aria-labelledby={`${roleTriggerId}-label ${roleTriggerId}`}
                                            onClick={() =>
                                                setIsRoleListOpen((v) => !v)
                                            }
                                            className={cn(
                                                "flex min-h-11 w-full items-center justify-between gap-2 rounded-md border-[1.5px] border-color-input-border bg-color-surface-raised py-3 pr-8 pl-3 text-left text-sm text-color-text-primary outline-none transition-colors hover:border-brand-steel focus-visible:border-brand-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary focus-visible:[--tw-outline-style:solid]",
                                                isRoleListOpen &&
                                                    "border-brand-primary",
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    "truncate",
                                                    draftRoles.length === 0 &&
                                                        "text-color-input-border",
                                                )}
                                            >
                                                {roleSummary}
                                            </span>
                                            <ChevronDown
                                                aria-hidden="true"
                                                className={cn(
                                                    "size-4 shrink-0 text-color-text-secondary transition-transform",
                                                    isRoleListOpen &&
                                                        "rotate-180",
                                                )}
                                            />
                                        </button>

                                        {isRoleListOpen && (
                                            <ul
                                                id={rolePanelId}
                                                role="listbox"
                                                aria-multiselectable="true"
                                                className="absolute top-full left-0 z-10 mt-1 max-h-60 w-full list-none overflow-y-auto rounded-md border border-color-border bg-color-surface-raised p-1 shadow-md"
                                            >
                                                <li>
                                                    <label className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-sm p-2 hover:bg-brand-primary/[0.06]">
                                                        <Checkbox
                                                            checked={
                                                                isAllRolesSelected
                                                            }
                                                            indeterminate={
                                                                isSomeRolesSelected
                                                            }
                                                            onChange={
                                                                toggleSelectAllRoles
                                                            }
                                                        />
                                                        <span className="text-sm text-color-text-primary">
                                                            Select all
                                                        </span>
                                                    </label>
                                                </li>
                                                {roleOptions.map((option) => (
                                                    <li key={option.value}>
                                                        <label className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-sm p-2 hover:bg-brand-primary/[0.06]">
                                                            <Checkbox
                                                                checked={draftRoles.includes(
                                                                    option.value,
                                                                )}
                                                                onChange={() =>
                                                                    toggleDraftRole(
                                                                        option.value,
                                                                    )
                                                                }
                                                            />
                                                            <span className="text-sm text-color-text-primary">
                                                                {option.label}
                                                            </span>
                                                        </label>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 border-t border-color-border px-4 py-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="min-h-11 min-w-11"
                                    onClick={handleClear}
                                >
                                    Clear
                                </Button>
                                <Button
                                    type="button"
                                    className="min-h-11 min-w-11"
                                    onClick={handleApply}
                                >
                                    Apply
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {selectedRoles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {selectedRoles.map((role) => (
                        <div
                            key={role}
                            className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-color-border bg-color-surface-raised py-2 pr-2 pl-4 text-sm font-medium text-color-text-primary"
                        >
                            Role: {labelForRole(role)}
                            <button
                                type="button"
                                aria-label={`Remove role filter: ${labelForRole(role)}`}
                                onClick={() => removeRole(role)}
                                className="relative inline-flex size-5 items-center justify-center rounded-full bg-color-border text-color-text-secondary transition-colors hover:bg-status-critical hover:text-color-text-inverse focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary focus-visible:[--tw-outline-style:solid] before:absolute before:-inset-3"
                            >
                                <X className="size-3" aria-hidden="true" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
