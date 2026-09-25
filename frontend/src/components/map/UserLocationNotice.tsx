import { LocateOff } from "lucide-react";

import type { UserLocationStatus } from "@/hooks/useUserLocation";

const MESSAGES: Partial<Record<UserLocationStatus, string>> = {
    denied: "Location blocked. Allow it to see yourself on the map.",
    unavailable: "Location unavailable on this device.",
};

interface UserLocationNoticeProps {
    status: UserLocationStatus;
    bottomClassName?: string;
    style?: React.CSSProperties;
}

export function UserLocationNotice({
    status,
    bottomClassName = "bottom-2",
    style,
}: UserLocationNoticeProps) {
    const message = MESSAGES[status];
    if (!message) return null;

    return (
        <div
            role="status"
            style={style}
            className={`absolute left-2 ${bottomClassName} z-[var(--z-sticky)] inline-flex max-w-[calc(100%-1rem)] items-center gap-2 rounded-md bg-color-surface-raised px-2 py-1 shadow-sm`}
        >
            <LocateOff
                aria-hidden="true"
                className="size-4 shrink-0 text-color-text-secondary"
            />
            <span className="text-xs text-color-text-primary">{message}</span>
        </div>
    );
}
