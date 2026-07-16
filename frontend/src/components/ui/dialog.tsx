import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
    return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
    return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogClose({
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
    return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogPortal({
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
    return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogOverlay({
    className,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
    return (
        <DialogPrimitive.Overlay
            data-slot="dialog-overlay"
            className={cn(
                "fixed inset-0 z-[var(--z-modal)] bg-black/80 duration-[var(--dur-normal)] ease-[var(--ease-exit)] data-open:duration-[var(--dur-deliberate)] data-open:ease-[var(--ease-enter)] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
                className,
            )}
            {...props}
        />
    );
}

function DialogContent({
    className,
    children,
    preventBackdropClose = false,
    onPointerDownOutside,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
    preventBackdropClose?: boolean;
}) {
    return (
        <DialogPortal>
            <DialogOverlay />
            <DialogPrimitive.Content
                data-slot="dialog-content"
                onPointerDownOutside={(event) => {
                    if (preventBackdropClose) {
                        event.preventDefault();
                    }
                    onPointerDownOutside?.(event);
                }}
                className={cn(
                    "fixed top-1/2 left-1/2 z-[var(--z-modal)] w-[90%] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-color-surface-raised shadow-md duration-[var(--dur-normal)] ease-[var(--ease-exit)] data-open:duration-[var(--dur-deliberate)] data-open:ease-[var(--ease-enter)] data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
                    className,
                )}
                {...props}
            >
                {children}
            </DialogPrimitive.Content>
        </DialogPortal>
    );
}

function DialogHeader({
    className,
    children,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="dialog-header"
            className={cn(
                "flex items-start justify-between border-b border-color-border px-6 py-5 pb-4",
                className,
            )}
            {...props}
        >
            {children}
            <DialogPrimitive.Close data-slot="dialog-close" asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="-mt-3 -mr-3 ml-3 shrink-0"
                >
                    <XIcon className="size-5" aria-hidden="true" />
                    <span className="sr-only">Cancel, close dialog</span>
                </Button>
            </DialogPrimitive.Close>
        </div>
    );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="dialog-footer"
            className={cn(
                "flex justify-end gap-3 border-t border-color-border px-6 py-4 pt-4",
                className,
            )}
            {...props}
        />
    );
}

function DialogTitle({
    className,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
    return (
        <DialogPrimitive.Title
            data-slot="dialog-title"
            className={cn(
                "font-heading text-xl leading-[1.15] font-bold text-brand-primary",
                className,
            )}
            {...props}
        />
    );
}

function DialogDescription({
    className,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
    return (
        <DialogPrimitive.Description
            data-slot="dialog-description"
            className={cn(
                "px-6 py-5 text-base leading-relaxed text-color-text-primary",
                className,
            )}
            {...props}
        />
    );
}

export {
    Dialog,
    DialogTrigger,
    DialogClose,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
};
