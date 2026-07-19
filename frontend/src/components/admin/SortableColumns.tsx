import { SortableTableHead } from "@/components/admin/SortableTableHead";
import type { SortDirection } from "@/hooks/useSort";

interface Column<K extends string> {
    key: K;
    label: string;
}

interface SortableColumnsProps<K extends string> {
    columns: Column<K>[];
    sortKey: K | null;
    direction: SortDirection;
    requestSort: (key: K) => void;
}

export function SortableColumns<K extends string>({
    columns,
    sortKey,
    direction,
    requestSort,
}: SortableColumnsProps<K>) {
    return (
        <>
            {columns.map((col) => (
                <SortableTableHead
                    key={col.key}
                    label={col.label}
                    active={sortKey === col.key}
                    direction={direction}
                    onSort={() => requestSort(col.key)}
                />
            ))}
        </>
    );
}
