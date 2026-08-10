import * as React from "react";

import { TipoffForm } from "@/components/tipoffs/TipoffForm";
import { notifySafe } from "@/components/ui/toast";
import { useAuthStore } from "@/store/authStore";
import { formatToUTC } from "@/lib/utils";
import { resolvePhotoUrls } from "@/lib/media";
import { tipoffsApi } from "@/services/tipoffsApi";
import type { TipoffCreate } from "@/services/tipoffsApi";
import type { DraftReportInput } from "@/types/reports";

export default function TipoffPage() {
    const user = useAuthStore((s) => s.user);
    const canSubmit =
        user?.role === "community_liaison" || user?.role === "admin";
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [formKey, setFormKey] = React.useState(0);

    const handleSubmit = async (input: DraftReportInput) => {
        if (input.lat === null || input.lon === null) {
            notifySafe("Error", "Select a location on the map");
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

            await tipoffsApi.submitTipoff(payload);
            notifySafe(
                "Tip-off submitted",
                "Thank you, rangers have been notified.",
            );
            setFormKey((key) => key + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (err) {
            notifySafe(
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

            {canSubmit ? (
                <div className="mt-6">
                    <TipoffForm
                        key={formKey}
                        onSubmit={handleSubmit}
                        isSubmitting={isSubmitting}
                    />
                </div>
            ) : (
                <div className="rounded-lg border border-color-border bg-color-surface-raised p-6 text-sm text-color-text-secondary shadow-sm">
                    Your account does not have access to submit tip-offs.
                </div>
            )}
        </div>
    );
}
