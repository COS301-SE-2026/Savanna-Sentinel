import React, { useEffect, useState, useMemo } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/store/authStore";
import { NewReportTab } from "@/components/reports/NewReportTab";
import { ReportList } from "@/components/reports/ReportList";
import {
    notifySafe,
    notifyCaution,
    notifyCritical,
} from "@/components/ui/toast";
import { toDatetimeLocalValue, formatToUTC } from "@/lib/utils";
import { PLACEHOLDER_PHOTO_TYPE, resolvePhotoUrls } from "@/lib/media";
import type {
    DraftReport,
    DraftReportInput,
    ReportType,
    Severity,
} from "@/types/reports";
import { reportsApi } from "@/services/reportsApi";
import type {
    ReportListItem,
    ReportCreate,
    ReportUpdate,
    ListReportsQueryParams,
} from "@/services/reportsApi";
import { useDebounce } from "@/hooks/useDebounce";
import {
    deleteDraft,
    enqueue,
    listDrafts,
    saveDraft,
} from "@/offline/draftsStore";
import { useOfflineSync } from "@/hooks/useOfflineSync";

// Helper functions
function mapToDraft(item: ReportListItem): DraftReport {
    return {
        localId: item.report_id,
        submittedBy: item.submitted_by,
        submittedByUsername: item.submitted_by_username,
        reportType: item.report_type as "incident" | "sighting",
        description: item.description,
        incidentType: item.incident_type || "",
        severity: (item.severity as "low" | "medium" | "high") || null,
        species: item.species || "",
        count: item.count ?? null,
        occurredAt: toDatetimeLocalValue(new Date(item.occurred_at)),
        lat: item.location?.lat ?? null,
        lon: item.location?.lon ?? null,
        photos: (item.images || []).map((url) => ({
            file: new File([], "", { type: PLACEHOLDER_PHOTO_TYPE }),
            previewUrl: url,
        })),
        createdAt: item.created_at,
        syncStatus: item.sync_status as DraftReport["syncStatus"],
    };
}
// Helper functions end

export default function ReportsPage() {
    const user = useAuthStore((s) => s.user);
    const [reports, setReports] = React.useState<DraftReport[]>([]);
    const canSubmit = user?.role === "ranger" || user?.role === "admin";
    const [activeTab, setActiveTab] = React.useState(canSubmit ? "new" : "all");
    const [isLoading, setIsLoading] = useState(false);
    const [search, setSearch] = React.useState("");
    const [isInitialLoad, setInitialLoad] = React.useState(true);
    const [typeFilter, setTypeFilter] = React.useState<ReportType[]>([]);
    const [severityFilter, setSeverityFilter] = React.useState<Severity[]>([]);
    const [speciesFilter, setSpeciesFilter] = React.useState<string[]>([]);
    const [usernameFilter, setUsernameFilter] = React.useState<string[]>([]);

    const debouncedSearch = useDebounce(search, 300);
    const [refreshKey, setRefreshKey] = useState(0);
    const bumpRefresh = React.useCallback(
        () => setRefreshKey((key) => key + 1),
        [],
    );
    useOfflineSync(bumpRefresh);

    useEffect(() => {
        async function fetchReports() {
            setIsLoading(true);
            const temp: ListReportsQueryParams = {
                search: debouncedSearch || undefined,
                report_type: typeFilter || null,
                severity: severityFilter || null,
                species: speciesFilter || null,
                users: usernameFilter || null,
            };
            const localDrafts = user
                ? await listDrafts(user.id).catch(() => [])
                : [];
            const unsynced = localDrafts.filter(
                (draft) => draft.syncStatus !== "synced",
            );

            try {
                const res = await reportsApi.listReports(temp);
                setReports([...res.results.map(mapToDraft), ...unsynced]);
            } catch (err) {
                setReports(unsynced);
                notifyCritical("Error", "Failed to fetch reports");
                console.error(err);
            } finally {
                setIsLoading(false);
                setInitialLoad(false);
            }
        }
        fetchReports();
    }, [
        debouncedSearch,
        typeFilter,
        severityFilter,
        speciesFilter,
        usernameFilter,
        user,
        refreshKey,
    ]);

    const myDrafts = useMemo(
        () =>
            reports.filter(
                (r) => r.submittedBy === user?.id && r.syncStatus !== "synced",
            ),
        [reports, user?.id],
    );

    const handleCreate = async (input: DraftReportInput) => {
        if (!user) return;

        // Validate coords
        if (input.lat === null || input.lon === null) {
            notifyCritical("Error", "Locational coordinates are required");
            return;
        }

        const localId = crypto.randomUUID();
        let isPersisted = true;
        try {
            await saveDraft(user.id, localId, input, "offline");
            await enqueue(user.id, localId, "create");
        } catch (err) {
            isPersisted = false;
            console.error(err);
        }

        setReports((prev) => [
            ...prev,
            {
                ...input,
                localId,
                submittedBy: user.id,
                submittedByUsername: user.username,
                createdAt: new Date().toISOString(),
                syncStatus: "offline",
            },
        ]);
        window.scrollTo({ top: 0, behavior: "smooth" });

        try {
            const images = await resolvePhotoUrls(input.photos);
            const payload: ReportCreate = {
                report_type: input.reportType,
                location: { lat: input.lat, lon: input.lon },
                occurred_at: formatToUTC(input.occurredAt),
                description: input.description,
                incident_type: input.incidentType || undefined,
                severity: input.severity || undefined,
                species: input.species || undefined,
                count: input.count ?? undefined,
                images,
                sync_status: "pending",
            };

            const res = await reportsApi.submitReport(payload);

            await deleteDraft(localId).catch(() => {});
            setReports((prev) =>
                prev.map((r) =>
                    r.localId === localId
                        ? {
                              ...r,
                              localId: res.report_id,
                              submittedBy: res.submitted_by,
                              submittedByUsername: res.submitted_by_username,
                              createdAt: res.created_at,
                              syncStatus: "pending",
                          }
                        : r,
                ),
            );
            notifySafe(
                "Report submitted",
                "Your report has been queued to sync.",
            );
        } catch (err) {
            if (isPersisted) {
                notifyCaution(
                    "Saved to this device",
                    "No connection. It will be sent when you are back online.",
                );
            } else {
                notifyCritical(
                    "Submission failed",
                    "Could not send report to the server",
                );
            }
            console.error(err);
        }
    };

    const handleSave = async (localId: string, input: DraftReportInput) => {
        const existing = reports.find((r) => r.localId === localId);

        if (user && existing?.syncStatus === "offline") {
            try {
                await saveDraft(user.id, localId, input, "offline");
                await enqueue(user.id, localId, "create");
                setReports((prev) =>
                    prev.map((r) =>
                        r.localId === localId ? { ...r, ...input } : r,
                    ),
                );
                notifySafe(
                    "Draft saved",
                    "Kept on this device until you sync.",
                );
                window.scrollTo({ top: 0, behavior: "smooth" });
            } catch (err) {
                notifyCritical("Save failed", "Could not update this device");
                console.error(err);
            }
            return;
        }

        try {
            const images = await resolvePhotoUrls(input.photos);
            const payload: ReportUpdate = {
                description: input.description,
                location:
                    input.lat !== null && input.lon !== null
                        ? { lat: input.lat, lon: input.lon }
                        : undefined,
                occurred_at: formatToUTC(input.occurredAt),
                incident_type: input.incidentType || undefined,
                severity: input.severity || undefined,
                species: input.species || undefined,
                count: input.count ?? undefined,
                images,
            };

            await reportsApi.updateReport(localId, payload);

            setReports((prev) =>
                prev.map((r) =>
                    r.localId === localId ? { ...r, ...input } : r,
                ),
            );
            notifySafe("Draft saved", "Your report has been updated.");
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (err) {
            notifyCritical("Upate failed", "Unable to update report");
            console.error(err);
        }
    };

    const handleDelete = async (localId: string) => {
        const existing = reports.find((r) => r.localId === localId);
        if (existing?.syncStatus === "offline") {
            await deleteDraft(localId).catch(() => {});
            setReports((prev) => prev.filter((r) => r.localId !== localId));
            notifySafe("Draft discarded");
            return;
        }

        try {
            await reportsApi.deleteReport(localId);
            setReports((prev) => prev.filter((r) => r.localId !== localId));
            notifySafe("Report deleted");
        } catch (err) {
            notifyCritical("Delete failed");
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
                    {isInitialLoad ? (
                        //replace with a better loading state, like the skeleton loading
                        <p>Loading reports...</p>
                    ) : (
                        <div
                            className={
                                isLoading ? "opacity-60 transition-opacity" : ""
                            }
                        >
                            <ReportList
                                reports={reports}
                                canSubmit={canSubmit}
                                onGoToNewReport={() => setActiveTab("new")}
                                search={search}
                                setSearch={(value) => {
                                    setIsLoading(true);
                                    setSearch(value);
                                }}
                                typeFilter={typeFilter}
                                setTypeFilter={(value) => {
                                    setIsLoading(true);
                                    setTypeFilter(value);
                                }}
                                severityFilter={severityFilter}
                                setSeverityFilter={(value) => {
                                    setIsLoading(true);
                                    setSeverityFilter(value);
                                }}
                                speciesFilter={speciesFilter}
                                setSpeciesFilter={(value) => {
                                    setIsLoading(true);
                                    setSpeciesFilter(value);
                                }}
                                usernameFilter={usernameFilter}
                                setUsernameFilter={(value) => {
                                    setIsLoading(true);
                                    setUsernameFilter(value);
                                }}
                                isLoading={isLoading}
                            />
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
