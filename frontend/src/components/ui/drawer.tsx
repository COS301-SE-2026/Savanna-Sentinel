import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "@/lib/utils";

function Drawer({
    ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
    return <DrawerPrimitive.Root data-slot="drawer" {...props} />;
}

function DrawerTrigger({
    ...props
}: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
    return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerClose({
    ...props
}: React.ComponentProps<typeof DrawerPrimitive.Close>) {
    return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

function DrawerPortal({
    ...props
}: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
    return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerOverlay({
    className,
    ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
    return (
        <DrawerPrimitive.Overlay
            data-slot="drawer-overlay"
            className={cn(
                "fixed inset-0 z-[var(--z-modal)] bg-black/10",
                className,
            )}
            {...props}
        />
    );
}

function DrawerContent({
    className,
    children,
    ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content>) {
    return (
        <DrawerPortal>
            <DrawerOverlay />
            <DrawerPrimitive.Content
                data-slot="drawer-content"
                className={cn(
                    "fixed inset-x-0 bottom-0 z-[var(--z-modal)] flex flex-col rounded-t-lg border-t border-color-border bg-color-surface-raised",
                    className,
                )}
                {...props}
            >
                <div className="mx-auto mt-2 h-1 w-8 shrink-0 rounded-full bg-color-border" />
                {children}
            </DrawerPrimitive.Content>
        </DrawerPortal>
    );
}

function DrawerTitle({
    className,
    ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
    return (
        <DrawerPrimitive.Title
            data-slot="drawer-title"
            className={cn(
                "font-heading text-xl leading-[1.15] font-bold text-brand-primary",
                className,
            )}
            {...props}
        />
    );
}

function DrawerDescription({
    className,
    ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
    return (
        <DrawerPrimitive.Description
            data-slot="drawer-description"
            className={cn(
                "text-base leading-relaxed text-color-text-primary",
                className,
            )}
            {...props}
        />
    );
}

export {
    Drawer,
    DrawerTrigger,
    DrawerClose,
    DrawerPortal,
    DrawerOverlay,
    DrawerContent,
    DrawerTitle,
    DrawerDescription,
};
