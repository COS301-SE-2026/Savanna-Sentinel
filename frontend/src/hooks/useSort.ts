import { useMemo, useState } from "react";

export type SortDirection = "asc" | "desc";

export function useSort<T, K extends string>(
    items: T[],
    accessors: Record<K, (item: T) => string | number>,
    initial?: { key: K; direction: SortDirection },
) {
    const [sortKey, setSortKey] = useState<K | null>(initial?.key ?? null);
    const [direction, setDirection] = useState<SortDirection>(
        initial?.direction ?? "asc",
    );

    const sorted = useMemo(() => {
        if (!sortKey) return items;
        const accessor = accessors[sortKey];
        const factor = direction === "asc" ? 1 : -1;

        return [...items].sort((a, b) => {
            const aVal = accessor(a);
            const bVal = accessor(b);
            if (aVal < bVal) return -1 * factor;
            if (aVal > bVal) return 1 * factor;
            return 0;
        });
    }, [items, sortKey, direction, accessors]);

    const requestSort = (key: K) => {
        if (sortKey !== key) {
            setSortKey(key);
            setDirection("asc");
        } else {
            setDirection((d) => (d === "asc" ? "desc" : "asc"));
        }
    };

    return { sorted, sortKey, direction, requestSort };
}
