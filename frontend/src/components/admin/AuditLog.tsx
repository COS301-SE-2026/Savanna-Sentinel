import React, { useEffect } from "react";
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
import { Pagination } from "../ui/pagination";
import { SortableColumns } from "@/components/admin/SortableColumns";

export default function AuditLog() {
    const [logs, setLogs] = React.useState<AuditLogListItem[]>([]);
    const [currPage, setCurrPage] = React.useState(1);
    const [totalPages, setTotalPages] = React.useState(1);
    const pageSize = 3;

    useEffect(() => {
        async function fetchLogs() {
            try {
                const payload: AuditLogRequest = {
                    page: 1,
                    page_size: pageSize,
                };
                const res = await auditApi.getLogs(payload);
                setCurrPage(res.page);
                setTotalPages(Math.max(1, Math.ceil(res.total / res.page_size)));
                setLogs(res.results);
            } catch (err) {
                console.error(err);
            }   
        }

        fetchLogs();
    }, []);

    const handlePageChange = async (nextPage: number) => {
        try {
            const payload: AuditLogRequest = {
                page: nextPage,
                page_size: pageSize, 
            }

            const res = await auditApi.getLogs(payload);
            setCurrPage(res.page);
            setLogs(res.results);
        } catch (err) {
            console.error(err);
        }
    };

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

            <Pagination 
                currentPage={currPage}
                totalPages={totalPages}
                onPageChange={(page) => handlePageChange(page)}
            />
        </div>
    );
}