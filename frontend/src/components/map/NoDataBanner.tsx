import { X } from "lucide-react";

export interface NoDataBannerProps {
    visible: boolean;
    onDismiss: () => void;
}

export function NoDataBanner({ visible, onDismiss }: NoDataBannerProps) {
    if (!visible) return null;

    return (
        <div className="absolute top-2 left-1/2 z-[var(--z-dropdown)] flex -translate-x-1/2 items-center gap-2 rounded-md border border-color-border bg-color-surface-raised px-3 py-2 text-sm text-color-text-primary shadow-md">
            <span>No risk scores available yet</span>
            <button
                type="button"
                aria-label="Dismiss"
                onClick={onDismiss}
                className="flex min-h-6 min-w-6 items-center justify-center rounded-sm text-color-text-secondary hover:bg-color-surface-bg"
            >
                <X className="size-4" aria-hidden="true" />
            </button>
        </div>
    );
}
