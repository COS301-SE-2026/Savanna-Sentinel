import React, { useState, useEffect } from "react";
import type { AuditLogListItem, AuditLogResponse, AuditLogRequest } from "@/services/auditApi";
import { auditApi } from "@/services/auditApi";
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
    const [logs, setLogs] = React.useState<AuditLogListItem[]>([]);
    useEffect(() => {
        async function fetchLogs() {
            try {
                const payload: AuditLogRequest = {
                    page: 1,
                    page_size: 50,
                };
                const res = await auditApi.getLogs(payload);
                setLogs(res.results);
            } catch (err) {
                console.error(err);
            }   
        }

        fetchLogs();
    }, []);

    return (
        <div className="space-y-4">
            <div className="font-heading text-2xl leading-[1.15] font-bold text-brand-primary">
                View Audit Logs
            </div>

            <div className="overflow-hidden rounded-lg border border-color-border bg-color-surface-raised shadow-sm">
                <Table>
                    <TableHeader className="bg-brand-primary">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className={theadClass}>Actor ID</TableHead>
                            <TableHead className={theadClass}>Action</TableHead>
                            <TableHead className={theadClass}>Target</TableHead>
                            <TableHead className={theadClass}>Target ID</TableHead>
                            <TableHead className={theadClass}>Details</TableHead>
                            <TableHead className={theadClass}>Created At</TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {
                            logs.map((log) => (
                                <TableRow className={`${rowClass}`}>
                                    <TableCell className={`${cellClass}`}>{log.actor_id}</TableCell>
                                    <TableCell className={`${cellClass}`}>{log.action}</TableCell>
                                    <TableCell className={`${cellClass}`}>{log.target_type}</TableCell>
                                    <TableCell className={`${cellClass}`}>{log.target_id}</TableCell>
                                    {
                                    //<TableCell className={`${cellClass}`}>{log.details}</TableCell>
                                    <TableCell className={`${cellClass}`}>details here</TableCell>
                                    }
                                    <TableCell className={`${cellClass}`}>{log.created_at}</TableCell>
                                </TableRow>
                            ))
                        }
                    </TableBody>
                </Table>
            </div>

        </div>
    );
}