import { useEffect, useState } from "react";

import type { UserLocation } from "@/types/location";

export type UserLocationStatus =
    "idle" | "locating" | "tracking" | "denied" | "unavailable";

export interface UseUserLocationResult {
    location: UserLocation | null;
    status: UserLocationStatus;
}

const PERMISSION_DENIED = 1;

const WATCH_OPTIONS: PositionOptions = {
    enableHighAccuracy: true,
    maximumAge: 5000,
    timeout: 15000,
};

export function useUserLocation(enabled = true): UseUserLocationResult {
    const [location, setLocation] = useState<UserLocation | null>(null);
    const [status, setStatus] = useState<UserLocationStatus>(() =>
        navigator.geolocation ? "locating" : "unavailable",
    );

    useEffect(() => {
        if (!enabled) return undefined;

        const geolocation = navigator.geolocation;
        if (!geolocation) return undefined;

        const watchId = geolocation.watchPosition(
            (position) => {
                const { latitude, longitude, heading } = position.coords;
                setLocation({
                    lat: latitude,
                    lon: longitude,
                    heading:
                        heading === null ||
                        heading === undefined ||
                        Number.isNaN(heading)
                            ? null
                            : heading,
                });
                setStatus("tracking");
            },
            (error) => {
                if (error.code === PERMISSION_DENIED) {
                    setLocation(null);
                    setStatus("denied");
                    return;
                }
                setStatus((current) =>
                    current === "tracking" ? current : "unavailable",
                );
            },
            WATCH_OPTIONS,
        );

        return () => geolocation.clearWatch(watchId);
    }, [enabled]);
    if (!enabled) return { location: null, status: "idle" };

    return { location, status };
}
