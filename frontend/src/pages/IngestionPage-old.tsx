//Old page that might get deleted later, since the entire page is getting reformatted, but keeping it around for reference purposes.
import { Upload, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

const METRICS = [
    { label: "Accuracy", value: "91.2%", delta: "+1.4% vs prev", up: true },
    { label: "Precision", value: "88.7%", delta: "+0.9% vs prev", up: true },
    { label: "Recall", value: "86.4%", delta: "−0.3% vs prev", up: false },
    { label: "F1 Score", value: "0.875", delta: "+0.011 vs prev", up: true },
];

const UPLOADS = [
    {
        name: "incidents_jan_may2026.csv",
        size: "1.2 MB",
        date: "12 May 2026",
        rows: "3 840",
        status: "Processed",
    },
    {
        name: "sightings_q1_2026.csv",
        size: "840 KB",
        date: "1 Apr 2026",
        rows: "2 101",
        status: "Processed",
    },
    {
        name: "patrol_logs_2025.csv",
        size: "3.1 MB",
        date: "15 Jan 2026",
        rows: "9 200",
        status: "Processed",
    },
    {
        name: "incidents_dec2025.csv",
        size: "620 KB",
        date: "3 Jan 2026",
        rows: "1 440",
        status: "Failed",
    },
];

function StatusIcon({ status }: { status: string }) {
    if (status === "Processed")
        return <CheckCircle2 className="size-4 text-spot-green" />;
    if (status === "Failed")
        return <XCircle className="size-4 text-spot-red" />;
    return <Clock className="size-4 text-spot-orange" />;
}

export default function IngestionPage() {
    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <div className="rounded-md bg-brand-dark-blue text-white px-4 py-2.5 text-sm flex items-center gap-2">
                <Upload className="size-4 shrink-0" />
                <span>
                    This page is still to come, but here's a little teaser.
                </span>
            </div>

            <h1 className="text-2xl font-semibold text-foreground">
                Data Ingestion
            </h1>

            <div className="rounded-lg border-2 border-dashed border-border bg-card flex flex-col items-center justify-center py-12 gap-3 opacity-70 cursor-not-allowed select-none">
                <div className="size-12 rounded-full bg-muted flex items-center justify-center">
                    <Upload className="size-6 text-muted-foreground" />
                </div>
                <div className="text-center">
                    <p className="text-sm font-medium">
                        Drop CSV file here or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        Accepts: incidents, sightings, patrol logs · Max 50 MB
                    </p>
                </div>
                <Button disabled size="sm" className="opacity-60">
                    Select File
                </Button>
            </div>

            <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Current Model Performance
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {METRICS.map(({ label, value, delta, up }) => (
                        <div
                            key={label}
                            className="rounded-lg border border-border bg-card p-4"
                        >
                            <p className="text-xs text-muted-foreground">
                                {label}
                            </p>
                            <p
                                className={`text-2xl font-bold mt-1 ${up ? "text-spot-green" : "text-spot-red"}`}
                            >
                                {value}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-1">
                                {delta}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Recent Uploads
                </h2>
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>File</TableHead>
                                <TableHead>Size</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Rows</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {UPLOADS.map((u) => (
                                <TableRow key={u.name}>
                                    <TableCell className="font-mono text-xs">
                                        {u.name}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {u.size}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {u.date}
                                    </TableCell>
                                    <TableCell>{u.rows}</TableCell>
                                    <TableCell>
                                        <span className="flex items-center gap-1.5">
                                            <StatusIcon status={u.status} />
                                            <span className="text-sm">
                                                {u.status}
                                            </span>
                                        </span>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
