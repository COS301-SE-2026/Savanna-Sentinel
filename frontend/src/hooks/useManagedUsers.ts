import { useCallback, useEffect, useRef, useState } from "react";
import { useSort } from "@/hooks/useSort";
import {
    useRoleOptions,
    useUserSearchFilter,
} from "@/hooks/useUserSearchFilter";
import type { PaginatedUsersResponse, UserResponse } from "@/services/usersApi";

interface UseManagedUsersOptions {
    transform?: (results: UserResponse[]) => UserResponse[];
    errorMessage?: string;
    onError?: (error: unknown) => void;
}

export function useManagedUsers<K extends string>(
    fetchUsers: () => Promise<PaginatedUsersResponse>,
    sortAccessors: Record<K, (user: UserResponse) => string | number>,
    options?: UseManagedUsersOptions,
) {
    const [users, setUsers] = useState<UserResponse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [pageError, setPageError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState<string[]>([]);

    const fetchUsersRef = useRef(fetchUsers);
    const optionsRef = useRef(options);

    useEffect(() => {
        fetchUsersRef.current = fetchUsers;
        optionsRef.current = options;
    });

    const refetch = useCallback(() => {
        return Promise.resolve()
            .then(() => {
                setIsLoading(true);
                setPageError(null);
                return fetchUsersRef.current();
            })
            .then((data) => {
                const results = optionsRef.current?.transform
                    ? optionsRef.current.transform(data.results)
                    : data.results;
                setUsers(results);
            })
            .catch((error) => {
                optionsRef.current?.onError?.(error);
                setPageError(
                    optionsRef.current?.errorMessage ?? "Failed to load users.",
                );
            })
            .finally(() => setIsLoading(false));
    }, []);

    useEffect(() => {
        refetch();
    }, [refetch]);

    const roleOptions = useRoleOptions(users);
    const filteredUsers = useUserSearchFilter(users, search, roleFilter);

    const {
        sorted: sortedUsers,
        sortKey,
        direction,
        requestSort,
    } = useSort<UserResponse, K>(filteredUsers, sortAccessors);

    return {
        users,
        setUsers,
        isLoading,
        pageError,
        search,
        setSearch,
        roleFilter,
        setRoleFilter,
        roleOptions,
        sortedUsers,
        sortKey,
        direction,
        requestSort,
        refetch,
    };
}
