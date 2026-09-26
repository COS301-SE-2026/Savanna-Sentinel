export function ResetButton({
    show,
    onClick,
    label,
}: {
    show: boolean;
    onClick: () => void;
    label?: string;
}) {
    if (!show) return null;
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className="text-xs text-brand-primary underline"
        >
            Reset
        </button>
    );
}
