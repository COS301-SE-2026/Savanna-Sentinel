interface ServerValidationError {
    column: string;
    error_type: string;
    message: string;
}
type ServerErrorsMap = Record<string, ServerValidationError[]>;

interface ValidationErrorsProps {
    errors: ServerErrorsMap | null;
}

export function ValidationErrors({ errors }: ValidationErrorsProps) {
    if (!errors || Object.keys(errors).length === 0) return null;

    const affectedRows = Object.keys(errors).length;

    return (
        <div className="mb-4 rounded-md border border-status-critical bg-status-critical/[0.06] px-4 py-3 text-sm text-status-critical-text">
            <p className="font-semibold">
                {affectedRows} row{affectedRows === 1 ? "" : "s"} failed server
                validation
            </p>
            <ul className="mt-1 list-inside list-disc">
                {Object.entries(errors).map(([rowKey, rowErrors]) => (
                    <li key={rowKey}>
                        {rowKey}: {rowErrors.map((e) => e.message).join("; ")}
                    </li>
                ))}
            </ul>
        </div>
    );
}
