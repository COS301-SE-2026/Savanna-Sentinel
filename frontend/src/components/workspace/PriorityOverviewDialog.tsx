import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cellClass, rowClass, theadClass } from "@/components/ui/table-styles";
import { getFeatureDisplayName } from "@/lib/workspace/featureDisplay";
import { resolveFeatureRule } from "@/lib/workspace/rules";
import { RULE_INTENTS, type RuleIntent } from "@/lib/workspace/types";
import { useWorkspaceStore } from "@/store/workspaceStore";

const INTENT_COLUMN: Record<RuleIntent, { letter: string; label: string }> = {
    increase_risk: { letter: "I", label: "Increase risk" },
    decrease_risk: { letter: "D", label: "Decrease risk" },
    prefer: { letter: "P", label: "Prefer following" },
    avoid: { letter: "A", label: "Avoid following" },
};

export interface PriorityOverviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function PriorityOverviewDialog({
    open,
    onOpenChange,
}: PriorityOverviewDialogProps) {
    const layers = useWorkspaceStore((s) => s.layers);
    const features = useWorkspaceStore((s) => s.features);
    const memberships = useWorkspaceStore((s) => s.memberships);

    const rows = features
        .filter((feature) => feature.inEffect)
        .map((feature) => ({
            id: feature.id,
            name: getFeatureDisplayName(feature),
            priorities: RULE_INTENTS.map((intent) => {
                const view = resolveFeatureRule(
                    layers,
                    memberships,
                    feature,
                    intent,
                );
                return view.enabled ? view.values.priority : null;
            }),
        }))
        .filter((row) => row.priorities.some((priority) => priority !== null))
        .sort((a, b) => a.name.localeCompare(b.name));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                aria-describedby={undefined}
                className="flex max-h-[90dvh] flex-col sm:max-w-lg"
            >
                <DialogHeader className="shrink-0 items-center">
                    <DialogTitle>Rule priorities</DialogTitle>
                </DialogHeader>

                <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-6 py-5">
                    <ul className="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-1 p-0 text-xs text-color-text-secondary">
                        {RULE_INTENTS.map((intent) => (
                            <li key={intent}>
                                <span className="font-semibold text-color-text-primary">
                                    {INTENT_COLUMN[intent].letter}
                                </span>{" "}
                                {INTENT_COLUMN[intent].label}
                            </li>
                        ))}
                    </ul>

                    {rows.length === 0 ? (
                        <p className="m-0 text-sm text-color-text-secondary">
                            No features have rules set yet.
                        </p>
                    ) : (
                        <div className="shrink-0 overflow-hidden rounded-lg border border-color-border">
                            <Table>
                                <TableHeader className="bg-brand-primary">
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className={theadClass}>
                                            Feature
                                        </TableHead>
                                        {RULE_INTENTS.map((intent) => (
                                            <TableHead
                                                key={intent}
                                                className={`${theadClass} text-center`}
                                            >
                                                <span aria-hidden="true">
                                                    {
                                                        INTENT_COLUMN[intent]
                                                            .letter
                                                    }
                                                </span>
                                                <span className="sr-only">
                                                    {
                                                        INTENT_COLUMN[intent]
                                                            .label
                                                    }
                                                </span>
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.map((row) => (
                                        <TableRow
                                            key={row.id}
                                            className={rowClass}
                                        >
                                            <TableCell
                                                className={`${cellClass} font-medium`}
                                            >
                                                {row.name}
                                            </TableCell>
                                            {row.priorities.map(
                                                (priority, index) => (
                                                    <TableCell
                                                        key={
                                                            RULE_INTENTS[index]
                                                        }
                                                        className={`${cellClass} text-center tabular-nums`}
                                                    >
                                                        {priority ?? (
                                                            <>
                                                                <span aria-hidden="true">
                                                                    -
                                                                </span>
                                                                <span className="sr-only">
                                                                    Off
                                                                </span>
                                                            </>
                                                        )}
                                                    </TableCell>
                                                ),
                                            )}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    <p className="m-0 text-xs text-color-text-secondary">
                        A dash means the rule is off. Features with no rules, or
                        that are not in effect, are left out.
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
