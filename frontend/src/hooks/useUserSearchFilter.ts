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

export function useRoleOptions<T extends UserLike>(users: T[]) {
    return useMemo(() => {
        const uniqueRoles = Array.from(new Set(users.map((u) => u.role)));
        return uniqueRoles.map((role) => ({
            value: role,
            label: formatRole(role),
        }));
    }, [users]);
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
