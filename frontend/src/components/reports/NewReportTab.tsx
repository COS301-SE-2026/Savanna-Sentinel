import * as React from "react";

import { Pagination } from "@/components/ui/pagination";
import { FieldReportForm } from "@/components/reports/FieldReportForm";
import type { DraftReport, DraftReportInput } from "@/types/reports";

interface NewReportTabProps {
    myDrafts: DraftReport[];
    onCreate: (input: DraftReportInput) => void;
    onSave: (localId: string, input: DraftReportInput) => void;
    onDelete: (localId: string) => void;
}

export function NewReportTab({
    myDrafts,
    onCreate,
    onSave,
    onDelete,
}: NewReportTabProps) {
    const addChipPage = myDrafts.length + 1;
    const [currentPage, setCurrentPage] = React.useState(addChipPage);
    // for the field report submitting pagnation.
    const [newDraftKey, setNewDraftKey] = React.useState(0);

    const isAddPage = currentPage === myDrafts.length + 1;
    const activeDraft = isAddPage ? undefined : myDrafts[currentPage - 1];

    const handleSubmit = (input: DraftReportInput) => {
        if (isAddPage) {
            onCreate(input);
            setCurrentPage(myDrafts.length + 2);
            setNewDraftKey((key) => key + 1);
        } else if (activeDraft) {
            onSave(activeDraft.localId, input);
        }
    };

    const handleDelete = () => {
        if (!activeDraft) return;
        onDelete(activeDraft.localId);
        setCurrentPage((page) => Math.max(1, page - 1));
    };

    return (
        <div className="flex flex-col gap-6">
            <Pagination
                currentPage={currentPage}
                totalPages={myDrafts.length}
                trailingAddChip
                onPageChange={setCurrentPage}
            />
            <FieldReportForm
                key={isAddPage ? `new-${newDraftKey}` : activeDraft?.localId}
                mode={isAddPage ? "create" : "edit"}
                initialValue={activeDraft}
                onSubmit={handleSubmit}
                onDelete={isAddPage ? undefined : handleDelete}
            />
        </div>
    );
}
