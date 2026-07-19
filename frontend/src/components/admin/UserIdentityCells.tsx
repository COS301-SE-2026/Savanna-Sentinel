import { TableCell } from "@/components/ui/table";
import { cn, formatRole } from "@/lib/utils";
import { cellClass } from "@/components/admin/userTableStyles";

export function UsernameCell({ value }: { value: string }) {
    return (
        <TableCell className={cn(cellClass, "font-medium")}>{value}</TableCell>
    );
}

export function NameCell({ value }: { value: string }) {
    return <TableCell className={cellClass}>{value}</TableCell>;
}

export function RoleBadgeCell({ role }: { role: string }) {
    return (
        <TableCell className={cellClass}>
            <span className="rounded-full border-[1.5px] border-brand-muted bg-color-surface-bg px-2 py-0.5 text-xs font-semibold text-color-text-primary capitalize">
                {formatRole(role)}
            </span>
        </TableCell>
    );
}
