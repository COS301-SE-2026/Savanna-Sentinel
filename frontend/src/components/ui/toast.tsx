import { X } from "lucide-react";
import { toast as sonnerToast } from "sonner";

import { cn } from "@/lib/utils";

type ToastVariant = "safe" | "caution" | "critical";

const variantTextClass: Record<ToastVariant, string> = {
    safe: "text-status-safe-text",
    caution: "text-status-caution-text",
    critical: "text-status-critical-text",
};

function ToastCard({
    id,
    variant,
    title,
    description,
}: {
    id: string | number;
    variant: ToastVariant;
    title: string;
    description?: string;
}) {
    return (
        <div
            role={variant === "critical" ? "alert" : "status"}
            className="flex w-[420px] max-w-[calc(100vw-2.5rem)] items-start gap-3 rounded-md border border-color-border bg-color-surface-raised py-4 pr-4 pl-5 shadow-sm"
        >
            <div className="flex-1">
                <div
                    className={cn(
                        "mb-1 font-heading text-lg leading-[1.1] font-bold",
                        variantTextClass[variant],
                    )}
                >
                    {title}
                </div>
                {description && (
                    <div className="text-sm leading-relaxed text-color-text-primary">
                        {description}
                    </div>
                )}
            </div>

            <button
                type="button"
                aria-label="Dismiss"
                onClick={() => sonnerToast.dismiss(id)}
                className={cn(
                    "relative shrink-0 self-center rounded-sm outline-none before:absolute before:-inset-3 before:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary focus-visible:[--tw-outline-style:solid]",
                    variantTextClass[variant],
                )}
            >
                <X size={24} aria-hidden="true" />
            </button>
        </div>
    );
}

function notify(variant: ToastVariant, title: string, description?: string) {
    return sonnerToast.custom((id) => (
        <ToastCard
            id={id}
            variant={variant}
            title={title}
            description={description}
        />
    ));
}

export const notifySafe = (title: string, description?: string) =>
    notify("safe", title, description);

export const notifyCaution = (title: string, description?: string) =>
    notify("caution", title, description);

export const notifyCritical = (title: string, description?: string) =>
    notify("critical", title, description);
