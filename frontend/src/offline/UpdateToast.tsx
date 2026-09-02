import { toast as sonnerToast } from "sonner";

interface UpdateToastProps {
    id: string | number;
    onReload: () => void;
}

export function UpdateToast({ id, onReload }: UpdateToastProps) {
    return (
        <div
            role="status"
            className="flex w-[420px] max-w-[calc(100vw-2.5rem)] items-start gap-3 rounded-md border border-color-border bg-color-surface-raised py-4 pr-4 pl-5 shadow-sm"
        >
            <div className="flex-1">
                <div className="mb-1 font-heading text-lg leading-[1.1] font-bold text-brand-primary">
                    Update available
                </div>
                <div className="text-sm leading-relaxed text-color-text-primary">
                    Reload to get the latest version.
                </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 self-center">
                <button
                    type="button"
                    onClick={onReload}
                    className="rounded-md bg-brand-primary px-3 py-1.5 text-sm font-medium text-color-text-inverse outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary focus-visible:[--tw-outline-style:solid]"
                >
                    Reload
                </button>
                <button
                    type="button"
                    onClick={() => sonnerToast.dismiss(id)}
                    className="rounded-md px-3 py-1.5 text-sm font-medium text-color-text-secondary outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary focus-visible:[--tw-outline-style:solid]"
                >
                    Later
                </button>
            </div>
        </div>
    );
}
