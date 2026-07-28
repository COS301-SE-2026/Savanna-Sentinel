import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { theadClass, cellClass, rowClass } from "@/components/ui/table-styles";
import { validateData, type ColDef } from "@/lib/ingestionSchema";

interface ServerValidationError {
    column: string;
    error_type: string;
    message: string;
}
type ServerErrorsMap = Record<string, ServerValidationError[]>;

interface DataPreviewProps {
    schema: ColDef[];
    rows: string[][];
    startIndex: number;
    serverErrors: ServerErrorsMap | null;
    onCellChange: (
        rowIndex: number,
        cellIndex: number,
        newValue: string,
    ) => void;
}

export function DataPreview({
    schema,
    rows,
    startIndex,
    serverErrors,
    onCellChange,
}: DataPreviewProps) {
    return (
        <div className="overflow-x-auto rounded-lg border border-color-border bg-color-surface-raised shadow-sm">
            <Table>
                <TableHeader className="bg-brand-primary">
                    <TableRow className="hover:bg-transparent">
                        {schema.map((col) => (
                            <TableHead key={col.name} className={theadClass}>
                                {col.name} ({col.type})
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row, localIndex) => {
                        const absoluteIndex = startIndex + localIndex;
                        const rowKey = `row_${absoluteIndex + 1}`;
                        const rowErrors = serverErrors?.[rowKey];

                        return (
                            <TableRow key={rowKey} className={rowClass}>
                                {schema.map((col, cellIndex) => {
                                    const value = row[cellIndex] ?? "";
                                    const isTypeValid = validateData(
                                        value,
                                        col.type,
                                    );
                                    const isEmpty = value === "";
                                    const serverError = rowErrors?.find(
                                        (e) => e.column === col.name,
                                    );
                                    const isInvalid =
                                        !isTypeValid ||
                                        isEmpty ||
                                        !!serverError;

                                    let message: string | undefined;
                                    if (isEmpty)
                                        message = `"${col.name}" is missing`;
                                    else if (!isTypeValid)
                                        message = `Expected ${col.type}, got "${value}"`;
                                    else if (serverError)
                                        message = serverError.message;

                                    return (
                                        <TableCell
                                            key={col.name}
                                            className={cellClass}
                                        >
                                            <div className="flex flex-col gap-1">
                                                <Input
                                                    value={value}
                                                    aria-invalid={isInvalid}
                                                    title={message}
                                                    onChange={(e) =>
                                                        onCellChange(
                                                            absoluteIndex,
                                                            cellIndex,
                                                            e.target.value,
                                                        )
                                                    }
                                                    className={
                                                        isInvalid
                                                            ? "border-status-critical text-status-critical-text"
                                                            : undefined
                                                    }
                                                />
                                                {isInvalid && message && (
                                                    <Badge variant="critical">
                                                        {message}
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
