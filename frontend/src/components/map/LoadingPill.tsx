export function LoadingPill({ label }: { label: string }) {
    return (
        <div className="absolute top-2 left-2 z-[var(--z-sticky)] inline-flex items-center gap-2 rounded-md bg-color-surface-raised px-2 py-1 shadow-sm">
            <span className="size-2 shrink-0 rounded-full bg-brand-steel" />
            <span className="text-xs text-color-text-primary">{label}</span>
        </div>
    );
}
