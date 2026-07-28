import { TableRow, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { rowClass, cellClass } from "@/components/ui/table-styles";

interface EmptyTableRowProps {
    colSpan: number;
    message: string;
}

export function EmptyTableRow({ colSpan, message }: EmptyTableRowProps) {
    return (
        <TableRow className={rowClass}>
            <TableCell
                colSpan={colSpan}
                className={cn(
                    cellClass,
                    "text-center text-color-text-secondary",
                )}
            >
                {message}
            </TableCell>
        </TableRow>
    );
}
