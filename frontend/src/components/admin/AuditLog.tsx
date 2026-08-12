import React, { useEffect } from "react";
import type { AuditLogListItem, AuditLogRequest } from "@/services/auditApi";
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
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { notifyCritical } from "@/components/ui/toast";

// TODO
// Sorting, and filtering

export default function AuditLog() {
    const [logs, setLogs] = React.useState<AuditLogListItem[]>([]);
    const [currPage, setCurrPage] = React.useState(1);
    const [totalPages, setTotalPages] = React.useState(1);
    const [isExporting, setIsExporting] = React.useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
    const pageSize = 20;

    useEffect(() => {
        async function fetchLogs() {
            try {
                const payload: AuditLogRequest = {
                    page: 1,
                    page_size: pageSize,
                };
                const res = await auditApi.getLogs(payload);
                setCurrPage(res.page);
                setTotalPages(
                    Math.max(1, Math.ceil(res.total / res.page_size)),
                );
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
            };

            const res = await auditApi.getLogs(payload);
            setCurrPage(res.page);
            setLogs(res.results);
        } catch (err) {
            console.error(err);
        }
    };

    const handleExport = async () => {
        setIsConfirmOpen(false);
        setIsExporting(true);
        try {
            const blob = await auditApi.exportCsv();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "audit_log_export.csv";
            link.click();
            URL.revokeObjectURL(url);
        } catch {
            notifyCritical(
                "Export failed",
                "Could not download the audit log.",
            );
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="font-heading text-2xl leading-[1.15] font-bold text-brand-primary">
                    View Audit Logs
                </div>
                <Button
                    variant="outline"
                    disabled={isExporting}
                    onClick={() => setIsConfirmOpen(true)}
                >
                    {isExporting ? "Exporting..." : "Export CSV"}
                </Button>
            </div>

            <Dialog
                open={isConfirmOpen}
                onOpenChange={(open) => !isExporting && setIsConfirmOpen(open)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm export</DialogTitle>
                    </DialogHeader>
                    <DialogDescription>
                        Export the audit log to a CSV file?
                    </DialogDescription>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsConfirmOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="default"
                            onClick={handleExport}
                        >
                            Confirm
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="overflow-hidden rounded-lg border border-color-border bg-color-surface-raised shadow-sm">
                <Table>
                    <TableHeader className="bg-brand-primary">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className={theadClass}>Actor</TableHead>
                            <TableHead className={theadClass}>Action</TableHead>
                            <TableHead className={theadClass}>
                                Target Type
                            </TableHead>
                            <TableHead className={theadClass}>Target</TableHead>
                            <TableHead className={theadClass}>
                                Details
                            </TableHead>
                            <TableHead className={theadClass}>
                                Created At
                            </TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {logs.map((log) => (
                            <TableRow className={`${rowClass}`}>
                                <TableCell className={`${cellClass}`}>
                                    {log.actor_username ?? log.actor_id}
                                </TableCell>
                                <TableCell className={`${cellClass}`}>
                                    {log.action}
                                </TableCell>
                                <TableCell className={`${cellClass}`}>
                                    {log.target_type}
                                </TableCell>
                                <TableCell className={`${cellClass}`}>
                                    {log.target_username ?? log.target_id}
                                </TableCell>
                                <TableCell className={`${cellClass}`}>
                                    {log.details === null
                                        ? "No details"
                                        : "new_role" in log.details
                                          ? `Role changed to ${log.details.new_role}`
                                          : JSON.stringify(log.details)}
                                </TableCell>
                                <TableCell
                                    className={`${cellClass} text-nowrap`}
                                >
                                    {log.created_at
                                        ? new Date(
                                              log.created_at,
                                          ).toLocaleString(undefined, {
                                              dateStyle: "medium",
                                              timeStyle: "short",
                                          })
                                        : "—"}
                                </TableCell>
                            </TableRow>
                        ))}
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
