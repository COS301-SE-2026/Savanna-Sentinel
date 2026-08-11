import { useMemo } from "react";

import { formatRole } from "@/lib/utils";

interface UserLike {
    id: string;
    username: string;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
}

const ROLES = ["admin", "analyst", "ranger", "community liaison"];

export function useRoleOptions() {
    return useMemo(() => {
        return ROLES.map((role) => ({
            value: role,
            label: formatRole(role),
        }));
    }, []);
}

export function useUserSearchFilter<T extends UserLike>(
    users: T[],
    search: string,
    roleFilter: string[],
) {
    return useMemo(() => {
        const query = search.trim().toLowerCase();
        return users.filter((user) => {
            const isRoleMatch =
                roleFilter.length === 0 || roleFilter.includes(user.role);
            const isSearchMatch =
                query === "" ||
                user.username.toLowerCase().includes(query) ||
                `${user.first_name} ${user.last_name}`
                    .toLowerCase()
                    .includes(query) ||
                user.email.toLowerCase().includes(query);
            return isRoleMatch && isSearchMatch;
        });
    }, [users, search, roleFilter]);
}
