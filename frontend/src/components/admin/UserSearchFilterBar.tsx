import {
    MultiSelectFilterBar,
    type MultiSelectOption,
} from "@/components/ui/multi-select-filter-bar";

export type { MultiSelectOption };

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
    return (
        <MultiSelectFilterBar
            search={search}
            onSearchChange={onSearchChange}
            searchPlaceholder={searchPlaceholder}
            groups={[
                {
                    key: "role",
                    label: "Role",
                    options: roleOptions,
                    selected: selectedRoles,
                    onChange: onRolesChange,
                },
            ]}
        />
    );
}
