import { useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { theadClass, cellClass, rowClass } from "@/components/ui/table-styles";
import { SortableColumns } from "@/components/admin/SortableColumns";

export default function AuditLog() {
    return (
        <div className="space-y-4">
            <div className="font-heading text-2xl leading-[1.15] font-bold text-brand-primary">
                View Audit Logs
            </div>

            <div className="overflow-hidden rounded-lg border border-color-border bg-color-surface-raised shadow-sm">
                <Table>
                    <TableHeader className="bg-brand-primary">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className={theadClass}>A</TableHead>
                            <TableHead className={theadClass}>B</TableHead>
                            <TableHead className={theadClass}>C</TableHead>
                            <TableHead className={theadClass}>D</TableHead>
                            <TableHead className={theadClass}>E</TableHead>
                            <TableHead className={theadClass}>F</TableHead>
                            <TableHead className={theadClass}>G</TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        <TableRow className={rowClass}>
                            <TableCell className={cellClass}>1</TableCell>
                            <TableCell className={cellClass}>2</TableCell>
                            <TableCell className={cellClass}>3</TableCell>
                            <TableCell className={cellClass}>4</TableCell>
                            <TableCell className={cellClass}>5</TableCell>
                            <TableCell className={cellClass}>6</TableCell>
                            <TableCell className={cellClass}>7</TableCell>
                        </TableRow>

                        <TableRow className={rowClass}>
                            <TableCell className={cellClass}>1</TableCell>
                            <TableCell className={cellClass}>2</TableCell>
                            <TableCell className={cellClass}>3</TableCell>
                            <TableCell className={cellClass}>4</TableCell>
                            <TableCell className={cellClass}>5</TableCell>
                            <TableCell className={cellClass}>6</TableCell>
                            <TableCell className={cellClass}>7</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>

        </div>
    );
}