import React, { useEffect, useState, useMemo } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/store/authStore";
import { NewReportTab } from "@/components/reports/NewReportTab";
import { ReportList } from "@/components/reports/ReportList";
import { notifySafe } from "@/components/ui/toast";
import type { DraftReport, DraftReportInput } from "@/types/reports";
import { reportsApi } from "@/services/reportsApi";
import type {
    ReportListItem,
    ReportCreate,
    ReportUpdate,
} from "@/services/reportsApi";

function mapToDraft(item: ReportListItem): DraftReport {
    return {
        localId: item.report_id,
        submittedBy: item.submitted_by,
        reportType: item.report_type as "incident" | "sighting",
        description: item.description,
        incidentType: item.incident_type || "",
        severity: (item.severity as "low" | "medium" | "high") || null,
        species: item.species || "",
        count: item.count ?? null,
        occurredAt: item.occurred_at,
        lat: item.location?.lat ?? null,
        lon: item.location?.lon ?? null,
        photos: (item.images || []).map((url) => ({
            file: new File([], "", { type: "image/placeholder" }),
            previewUrl: url,
        })),
        createdAt: item.created_at,
        syncStatus: "pending",
    };
}

// todo
// implement the media upload

// todo
// this array should live in a Dexie table so drafts carry on reload
// and so that this page works offline
export default function ReportsPage() {
    const user = useAuthStore((s) => s.user);
    const [reports, setReports] = React.useState<DraftReport[]>([]);
    const canSubmit = user?.role === "ranger" || user?.role === "admin";
    const [activeTab, setActiveTab] = React.useState(canSubmit ? "new" : "all");
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        async function fetchReports() {
            setIsLoading(true);
            try {
                const res = await reportsApi.listReports();
                setReports(res.results.map(mapToDraft));
            } catch (err) {
                notifySafe("Error", "Failed to fetch reports");
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        }
        fetchReports();
    }, []);

    // should this not be user?.id or smth
    const myDrafts = useMemo(
        () => reports.filter((r) => r.submittedBy === user?.username),
        [reports, user?.username],
    );

    const handleCreate = async (input: DraftReportInput) => {
        if (!user) return;

        // Validate coords
        if (input.lat === null || input.lon === null) {
            notifySafe("Error", "Locational coordinates are required");
            return;
        }

        // Stubbed Media upload for now
        const payload: ReportCreate = {
            report_type: input.reportType,
            location: { lat: input.lat, lon: input.lon },
            occurred_at: input.occurredAt,
            description: input.description,
            incident_type: input.incidentType || undefined,
            severity: input.severity || undefined,
            species: input.species || undefined,
            count: input.count ?? undefined,
            images: [],
            sync_status: "pending",
        };

        try {
            const res = await reportsApi.submitReport(payload);

            const newReport: DraftReport = {
                ...input,
                localId: res.report_id,
                submittedBy: res.submitted_by,
                createdAt: res.created_at,
                syncStatus: "pending",
            };
            setReports((prev) => [...prev, newReport]);
            notifySafe(
                "Report submitted",
                "Your report has been queued to sync.",
            );
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (err) {
            notifySafe(
                "Submission failed",
                "Could not send report to the server",
            );
            console.error(err);
        }
    };

    const handleSave = async (localId: string, input: DraftReportInput) => {
        // Stubbed media upload for now
        const payload: ReportUpdate = {
            description: input.description,
            location:
                input.lat !== null && input.lon !== null
                    ? { lat: input.lat, lon: input.lon }
                    : undefined,
            occurred_at: input.occurredAt,
            incident_type: input.incidentType || undefined,
            severity: input.severity || undefined,
            species: input.species || undefined,
            count: input.count ?? undefined,
            images: [],
        };

        try {
            await reportsApi.updateReport(localId, payload);

            setReports((prev) =>
                prev.map((r) =>
                    r.localId === localId ? { ...r, ...input } : r,
                ),
            );
            notifySafe("Draft saved", "Your report has been updated.");
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (err) {
            notifySafe("Upate failed", "Unable to update report");
            console.error(err);
        }
    };

    const handleDelete = async (localId: string) => {
        try {
            await reportsApi.deleteReport(localId);
            setReports((prev) => prev.filter((r) => r.localId !== localId));
            notifySafe("Report deleted");
        } catch (err) {
            notifySafe("Delete failed");
            console.error(err);
        }
    };

    return (
        <div className="mx-auto max-w-[1120px] px-4 pt-8 pb-10 md:px-6">
            <h1 className="mb-6 font-heading text-3xl leading-[1.1] font-bold text-brand-primary">
                Field Reports
            </h1>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    {canSubmit && (
                        <TabsTrigger value="new">New Report</TabsTrigger>
                    )}
                    <TabsTrigger value="all">All Reports</TabsTrigger>
                </TabsList>

                {canSubmit && (
                    <TabsContent value="new" className="mt-6">
                        <NewReportTab
                            myDrafts={myDrafts}
                            onCreate={handleCreate}
                            onSave={handleSave}
                            onDelete={handleDelete}
                        />
                    </TabsContent>
                )}

                <TabsContent value="all" className="mt-6">
                    {isLoading ? (
                        <p>Loading reports...</p>
                    ) : (
                        <ReportList
                            reports={reports}
                            canSubmit={canSubmit}
                            onGoToNewReport={() => setActiveTab("new")}
                        />
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
