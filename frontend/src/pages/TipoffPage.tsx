import * as React from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TipoffForm } from "@/components/tipoffs/TipoffForm";
import { ReportList } from "@/components/reports/ReportList";
import { notifySafe, notifyCritical } from "@/components/ui/toast";
import { useAuthStore } from "@/store/authStore";
import { formatToUTC, toDatetimeLocalValue } from "@/lib/utils";
import { PLACEHOLDER_PHOTO_TYPE, resolvePhotoUrls } from "@/lib/media";
import { tipoffsApi } from "@/services/tipoffsApi";
import type { TipoffCreate, TipoffListItem } from "@/services/tipoffsApi";
import type { DraftReport, DraftReportInput } from "@/types/reports";

function mapToDraft(item: TipoffListItem): DraftReport {
    return {
        localId: item.tipoff_id,
        submittedBy: item.submitted_by,
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
        syncStatus: "synced",
    };
}

export default function TipoffPage() {
    const user = useAuthStore((s) => s.user);
    const canSubmit =
        user?.role === "community_liaison" || user?.role === "admin";
    const canViewAll = user?.role === "analyst" || user?.role === "admin";

    const [tipoffs, setTipoffs] = React.useState<DraftReport[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState(canSubmit ? "new" : "all");
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [formKey, setFormKey] = React.useState(0);

    React.useEffect(() => {
        if (!canViewAll) return;
        async function fetchTipoffs() {
            setIsLoading(true);
            try {
                const res = await tipoffsApi.listTipoffs();
                setTipoffs(res.results.map(mapToDraft));
            } catch (err) {
                notifyCritical("Error", "Failed to fetch tip-offs");
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        }
        fetchTipoffs();
    }, [canViewAll]);

    const handleSubmit = async (input: DraftReportInput) => {
        if (input.lat === null || input.lon === null) {
            notifyCritical("Error", "Select a location on the map");
            return;
        }

        setIsSubmitting(true);
        try {
            const images = await resolvePhotoUrls(input.photos);
            const payload: TipoffCreate = {
                report_type: input.reportType,
                location: { lat: input.lat, lon: input.lon },
                occurred_at: formatToUTC(input.occurredAt),
                description: input.description,
                incident_type: input.incidentType || undefined,
                severity: input.severity || undefined,
                species: input.species || undefined,
                count: input.count ?? undefined,
                images,
            };

            const res = await tipoffsApi.submitTipoff(payload);

            const newTipoff: DraftReport = {
                ...input,
                localId: res.tipoff_id,
                submittedBy: res.submitted_by,
                createdAt: res.created_at,
                syncStatus: "synced",
            };
            setTipoffs((prev) => [...prev, newTipoff]);
            notifySafe(
                "Tip-off submitted",
                "Thank you, rangers have been notified.",
            );
            setFormKey((key) => key + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (err) {
            notifyCritical(
                "Submission failed",
                "Could not send tip-off to the server",
            );
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="mx-auto max-w-[1120px] px-4 pt-8 pb-10 md:px-6">
            <h1 className="mb-6 font-heading text-3xl leading-[1.1] font-bold text-brand-primary">
                Tip-offs
            </h1>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    {canSubmit && (
                        <TabsTrigger value="new">New Tip-off</TabsTrigger>
                    )}
                    {canViewAll && (
                        <TabsTrigger value="all">All Tip-offs</TabsTrigger>
                    )}
                </TabsList>

                {canSubmit && (
                    <TabsContent value="new" className="mt-6">
                        <TipoffForm
                            key={formKey}
                            onSubmit={handleSubmit}
                            isSubmitting={isSubmitting}
                        />
                    </TabsContent>
                )}

                {canViewAll && (
                    <TabsContent value="all" className="mt-6">
                        {isLoading ? (
                            <p>Loading tip-offs...</p>
                        ) : (
                            <ReportList
                                reports={tipoffs}
                                canSubmit={canSubmit}
                                onGoToNewReport={() => setActiveTab("new")}
                            />
                        )}
                    </TabsContent>
                )}
            </Tabs>

            {!canSubmit && !canViewAll && (
                <div className="rounded-lg border border-color-border bg-color-surface-raised p-6 text-sm text-color-text-secondary shadow-sm">
                    Your account does not have access to tip-offs.
                </div>
            )}
        </div>
    );
}
