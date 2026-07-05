import { FileText, Plus, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

const REPORTS = [
    {
        id: "RPT-0142",
        date: "14 May 2026",
        ranger: "J. Mthembu",
        type: "Snare Found",
        location: "Grid C-4",
        status: "Open",
    },
    {
        id: "RPT-0141",
        date: "13 May 2026",
        ranger: "S. van Wyk",
        type: "Suspicious Tracks",
        location: "Grid B-7",
        status: "Under Review",
    },
    {
        id: "RPT-0140",
        date: "12 May 2026",
        ranger: "T. Dlamini",
        type: "Gunshot Heard",
        location: "Grid E-2",
        status: "Under Review",
    },
    {
        id: "RPT-0139",
        date: "11 May 2026",
        ranger: "J. Mthembu",
        type: "Vehicle Tracks",
        location: "Grid D-5",
        status: "Closed",
    },
    {
        id: "RPT-0138",
        date: "09 May 2026",
        ranger: "P. Nkosi",
        type: "Carcass Found",
        location: "Grid A-8",
        status: "Closed",
    },
    {
        id: "RPT-0137",
        date: "08 May 2026",
        ranger: "S. van Wyk",
        type: "Snare Found",
        location: "Grid C-3",
        status: "Closed",
    },
    {
        id: "RPT-0136",
        date: "07 May 2026",
        ranger: "T. Dlamini",
        type: "Suspicious Person",
        location: "Grid F-1",
        status: "Closed",
    },
];

const STATUS_STYLE: Record<string, string> = {
    Open: "bg-spot-blue/10 text-spot-blue border border-spot-blue/30",
    "Under Review":
        "bg-spot-yellow/20 text-spot-dark-grey border border-spot-yellow/50",
    Closed: "bg-spot-green/10 text-spot-green border border-spot-green/30",
};

export default function ReportsPage() {
    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="mb-5 rounded-md bg-brand-dark-blue text-white px-4 py-2.5 text-sm flex items-center gap-2">
                <FileText className="size-4 shrink-0" />
                <span>
                    This page is still to come, but here's a little teaser.
                </span>
            </div>

            <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-semibold text-foreground">
                    Field Reports
                </h1>
                <Button disabled className="opacity-60 gap-1.5">
                    <Plus className="size-4" />
                    New Report
                </Button>
            </div>

            <div className="flex gap-2 mb-4">
                <div className="flex items-center gap-2 border border-border rounded-md px-3 py-1.5 bg-card text-sm text-muted-foreground flex-1 max-w-xs opacity-70 cursor-not-allowed select-none">
                    <Search className="size-4 shrink-0" />
                    <span>Search reports…</span>
                </div>
                <Button
                    variant="outline"
                    disabled
                    className="opacity-60 gap-1.5"
                >
                    <Filter className="size-4" />
                    Filter
                </Button>
            </div>

            <div className="rounded-lg border border-border bg-card overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Report ID</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Ranger</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {REPORTS.map((r) => (
                            <TableRow key={r.id} className="cursor-not-allowed">
                                <TableCell className="font-mono text-xs font-medium">
                                    {r.id}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                    {r.date}
                                </TableCell>
                                <TableCell>{r.ranger}</TableCell>
                                <TableCell>{r.type}</TableCell>
                                <TableCell className="font-mono text-xs">
                                    {r.location}
                                </TableCell>
                                <TableCell>
                                    <span
                                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[r.status]}`}
                                    >
                                        {r.status}
                                    </span>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <p className="mt-3 text-xs text-muted-foreground text-right">
                Showing 7 of 142 reports
            </p>
        </div>
    );
}
