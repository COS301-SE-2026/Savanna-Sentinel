import * as React from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/store/authStore";
import { NewReportTab } from "@/components/reports/NewReportTab";
import { ReportList } from "@/components/reports/ReportList";
import { notifySafe } from "@/components/ui/toast";
import type { DraftReport, DraftReportInput } from "@/types/reports";

// todo
// this array should live in a Dexie table so drafts carry on reload
// and so that this page works offline
export default function ReportsPage() {
    const user = useAuthStore((s) => s.user);
    const [reports, setReports] = React.useState<DraftReport[]>([]);
    const canSubmit = user?.role === "ranger" || user?.role === "admin";
    const [activeTab, setActiveTab] = React.useState(canSubmit ? "new" : "all");

    const myDrafts = React.useMemo(
        () => reports.filter((r) => r.submittedBy === user?.username),
        [reports, user?.username],
    );

    const handleCreate = (input: DraftReportInput) => {
        if (!user) return;
        const newReport: DraftReport = {
            ...input,
            localId: crypto.randomUUID(),
            submittedBy: user.username,
            createdAt: new Date().toISOString(),
            syncStatus: "pending",
        };
        setReports((prev) => [...prev, newReport]);
        notifySafe("Report submitted", "Your report has been queued to sync.");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleSave = (localId: string, input: DraftReportInput) => {
        setReports((prev) =>
            prev.map((r) => (r.localId === localId ? { ...r, ...input } : r)),
        );
        notifySafe("Draft saved", "Your report has been updated.");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleDelete = (localId: string) => {
        setReports((prev) => prev.filter((r) => r.localId !== localId));
        notifySafe("Report deleted");
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
                    <ReportList
                        reports={reports}
                        canSubmit={canSubmit}
                        onGoToNewReport={() => setActiveTab("new")}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
