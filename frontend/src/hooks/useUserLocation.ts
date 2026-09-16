import { useEffect, useRef, useState } from "react";

import type { UserLocation } from "@/types/location";

export type UserLocationStatus =
    "idle" | "locating" | "tracking" | "dead-reckoning" | "denied" | "unavailable";

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

    const lastGpsLoc = useRef<UserLocation | null>(null)
    const currentVelocity = useRef<number>(0);
    const lastMotionTime = useRef<number | null>(null);

    useEffect(() => {
        if (!enabled) return undefined;

        const geolocation = navigator.geolocation;
        if (!geolocation) return undefined;

        const watchId = geolocation.watchPosition(
            (position) => {
                const { latitude, longitude, heading } = position.coords;
                const newLoc: UserLocation = {
                    lat: latitude,
                    lon: longitude,
                    heading: heading && !Number.isNaN(heading) ? heading : null,
                };

                //To use as a reference point
                lastGpsLoc.current = newLoc;
                //Reset the simulated velocity since connectivity is restored
                currentVelocity.current = 0;
                lastMotionTime.current = null;
                setLocation(newLoc)
                setStatus("tracking");
            },
            (error) => {
                if (error.code === PERMISSION_DENIED) {
                    setLocation(null);
                    setStatus("denied");
                    return;
                }
                if(lastGpsLoc.current) {
                    setStatus("dead-reckoning")
                }
                else {
                    setStatus("unavailable");
                }
            },
            WATCH_OPTIONS,
        );

        return () => geolocation.clearWatch(watchId);
    }, [enabled]);


    if (!enabled) return { location: null, status: "idle" };

    return { location, status };
}
