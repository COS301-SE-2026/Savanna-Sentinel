import { useCallback, useEffect, useRef, useState } from "react";
import { useSort } from "@/hooks/useSort";
import { useRoleOptions } from "@/hooks/useUserSearchFilter";
import { useDebounce } from "./useDebounce";
import type { PaginatedUsersResponse, UserResponse } from "@/services/usersApi";

interface UseManagedUsersOptions {
    transform?: (results: UserResponse[]) => UserResponse[];
    errorMessage?: string;
    onError?: (error: unknown) => void;
    debounceMs?: number;
}

export function useManagedUsers<K extends string>(
    fetchUsers: (
        page: number,
        search: string,
        roleFilter: string[],
    ) => Promise<PaginatedUsersResponse>,
    sortAccessors: Record<K, (user: UserResponse) => string | number>,
    options?: UseManagedUsersOptions,
) {
    const [users, setUsers] = useState<UserResponse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [pageError, setPageError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    const fetchUsersRef = useRef(fetchUsers);
    const optionsRef = useRef(options);

    useEffect(() => {
        fetchUsersRef.current = fetchUsers;
        optionsRef.current = options;
    });

    const setSearch = useCallback((newSearch: React.SetStateAction<string>) => {
        setSearchQuery(newSearch);
        setPage(1);
    }, []);

    const setRoleFilter = useCallback(
        (newRoles: React.SetStateAction<string[]>) => {
            setSelectedRoles(newRoles);
            setPage(1);
        },
        [],
    );

    const debouncedSearchQuery = useDebounce(
        searchQuery,
        options?.debounceMs ?? 300,
    );

    const refetch = useCallback(() => {
        return Promise.resolve()
            .then(() => {
                setIsLoading(true);
                setPageError(null);
                return fetchUsersRef.current(
                    page,
                    debouncedSearchQuery,
                    selectedRoles,
                );
            })
            .then((data) => {
                const results = optionsRef.current?.transform
                    ? optionsRef.current.transform(data.results)
                    : data.results;
                setUsers(results);
                setTotal(data.total);

                const calculatedTotalPages =
                    Math.ceil(data.total / data.page_size) || 1;
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
    }, [page, debouncedSearchQuery, selectedRoles]);

    useEffect(() => {
        refetch();
    }, [page, refetch]);

    const roleOptions = useRoleOptions(users);

    const {
        sorted: sortedUsers,
        sortKey,
        direction,
        requestSort,
    } = useSort<UserResponse, K>(users, sortAccessors);

    return {
        users,
        setUsers,
        isLoading,
        pageError,
        search: searchQuery,
        setSearch,
        roleFilter: selectedRoles,
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
