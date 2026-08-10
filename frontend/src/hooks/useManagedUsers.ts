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
    fetchUsers: (page: number) => Promise<PaginatedUsersResponse>,
    sortAccessors: Record<K, (user: UserResponse) => string | number>,
    options?: UseManagedUsersOptions,
) {
    const [users, setUsers] = useState<UserResponse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [pageError, setPageError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState<string[]>([]);

    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

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
                return fetchUsersRef.current(page);
            })
            .then((data) => {
                const results = optionsRef.current?.transform
                    ? optionsRef.current.transform(data.results)
                    : data.results;
                setUsers(results);
                setTotal(data.total);

                const calculatedTotalPages = Math.ceil(data.total / data.page_size);
                setTotalPages(calculatedTotalPages);

                if (page > calculatedTotalPages) {
                    setPage(calculatedTotalPages);
                }
            })
            .catch((error) => {
                optionsRef.current?.onError?.(error);
                setPageError(
                    optionsRef.current?.errorMessage ?? "Failed to load users.",
                );
            })
            .finally(() => setIsLoading(false));
    }, [page]);

    useEffect(() => {
        refetch();
    }, [page, refetch]);

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
        page,
        setPage,
        total,
        totalPages,
    };
}
