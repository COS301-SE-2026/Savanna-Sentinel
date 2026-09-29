import { useEffect, useRef, useState } from "react";

import type { UserLocation } from "@/types/location";
import {
    STEP_LENGTH_M,
    blendHeading,
    compassFromEvent,
    createStepDetector,
    headingDifference,
    vectorMagnitude,
} from "@/lib/deadReckoning";

export type UserLocationStatus =
    | "idle"
    | "locating"
    | "tracking"
    | "dead-reckoning"
    | "needs-reference"
    | "denied"
    | "unavailable";

export interface UseUserLocationResult {
    location: UserLocation | null;
    status: UserLocationStatus;
    hasNoReferencePoint: boolean;
    setReferencePoint: (loc: UserLocation) => void;
}

const PERMISSION_DENIED = 1;

const WATCH_OPTIONS: PositionOptions = {
    enableHighAccuracy: true,
    maximumAge: 5000,
    timeout: 15000,
};

//Drift rates for accuracy
const TIME_DRIFT_RATE = 0.05;
const DIST_DRIFT_RATE = 0.15;

const HEADING_SMOOTHING = 0.15;
const HEADING_REDRAW_DEG = 5;

function screenAngle() {
    return typeof screen !== "undefined" ? (screen.orientation?.angle ?? 0) : 0;
}

function offsetToLatLon(lat: number, lon: number, dx: number, dy: number) {
    const deltaLat = dy / 111139;
    const deltaLon = dx / (111139 * Math.cos((lat * Math.PI) / 180));
    return {
        lat: lat + deltaLat,
        lon: lon + deltaLon,
    };
}

export function useUserLocation(
    enabled = true,
    forceDeadReckoning = false,
): UseUserLocationResult {
    const [location, setLocation] = useState<UserLocation | null>(null);
    const [status, setStatus] = useState<UserLocationStatus>(() =>
        navigator.geolocation ? "locating" : "unavailable",
    );
    const [hasNoReferencePoint, setHasNoReferencePoint] = useState(false);

    const lastGpsLoc = useRef<UserLocation | null>(null);
    const deadReckoningStartTime = useRef<number | null>(null);
    const distanceTravelled = useRef(0);
    const anchorAccuracy = useRef(0);
    const isForced = useRef(forceDeadReckoning);

    useEffect(() => {
        isForced.current = forceDeadReckoning;
    }, [forceDeadReckoning]);

    const setReferencePoint = (manualLocation: UserLocation) => {
        lastGpsLoc.current = manualLocation;
        deadReckoningStartTime.current = null;
        distanceTravelled.current = 0;
        anchorAccuracy.current = manualLocation.accuracy;

        setLocation(manualLocation);
        setHasNoReferencePoint(false);
        setStatus("dead-reckoning");
    };

    useEffect(() => {
        if (!enabled) return undefined;

        const geolocation = navigator.geolocation;
        if (!geolocation) return undefined;

        const watchId = geolocation.watchPosition(
            (position) => {
                if (isForced.current && lastGpsLoc.current) return;

                const { latitude, longitude, heading, accuracy } =
                    position.coords;
                const newLoc: UserLocation = {
                    lat: latitude,
                    lon: longitude,
                    heading:
                        heading !== null && !Number.isNaN(heading)
                            ? heading
                            : null,
                    accuracy: accuracy ?? 10,
                };

                lastGpsLoc.current = newLoc;
                deadReckoningStartTime.current = null;
                distanceTravelled.current = 0;
                anchorAccuracy.current = newLoc.accuracy;

                setLocation(newLoc);
                setStatus("tracking");
            },
            (error) => {
                if (error.code === PERMISSION_DENIED) {
                    setLocation(null);
                    setStatus("denied");
                    return;
                }
                if (lastGpsLoc.current) {
                    setStatus("dead-reckoning");
                } else {
                    setHasNoReferencePoint(true);
                    setStatus("needs-reference");
                }
            },
            WATCH_OPTIONS,
        );

        return () => geolocation.clearWatch(watchId);
    }, [enabled]);

    const effectiveStatus: UserLocationStatus =
        forceDeadReckoning && status === "tracking" ? "dead-reckoning" : status;

    //Offline location tracking
    useEffect(() => {
        if (effectiveStatus !== "dead-reckoning" || !window.DeviceMotionEvent) {
            return;
        }

        const detector = createStepDetector();
        let compassHeading: number | null = null;

        const handleOrientation = (event: DeviceOrientationEvent) => {
            const reading = compassFromEvent(event, screenAngle());
            if (reading === null) return;

            compassHeading =
                compassHeading === null
                    ? reading
                    : blendHeading(compassHeading, reading, HEADING_SMOOTHING);

            const current = lastGpsLoc.current;
            if (!current) return;
            if (
                current.heading !== null &&
                headingDifference(current.heading, compassHeading) <
                    HEADING_REDRAW_DEG
            ) {
                return;
            }
            const turned = { ...current, heading: compassHeading };
            lastGpsLoc.current = turned;
            setLocation(turned);
        };

        const handleMotion = (event: DeviceMotionEvent) => {
            const current = lastGpsLoc.current;
            if (!current) return;

            const magnitude =
                vectorMagnitude(event.accelerationIncludingGravity) ??
                vectorMagnitude(event.acceleration);
            if (magnitude === null) return;

            const now = performance.now() / 1000;
            deadReckoningStartTime.current ??= now;

            if (!detector.push(magnitude, now)) return;

            const heading = compassHeading ?? current.heading;
            if (heading === null) return;

            distanceTravelled.current += STEP_LENGTH_M;
            const headingRad = (heading * Math.PI) / 180;
            const updatedCoords = offsetToLatLon(
                current.lat,
                current.lon,
                STEP_LENGTH_M * Math.sin(headingRad),
                STEP_LENGTH_M * Math.cos(headingRad),
            );

            const accuracy =
                anchorAccuracy.current +
                (now - deadReckoningStartTime.current) * TIME_DRIFT_RATE +
                distanceTravelled.current * DIST_DRIFT_RATE;

            const updatedLocation: UserLocation = {
                lat: updatedCoords.lat,
                lon: updatedCoords.lon,
                heading,
                accuracy,
            };

            lastGpsLoc.current = updatedLocation;
            setLocation(updatedLocation);
        };

        const orientationEvent =
            "ondeviceorientationabsolute" in window
                ? "deviceorientationabsolute"
                : "deviceorientation";

        window.addEventListener("devicemotion", handleMotion);
        window.addEventListener(
            orientationEvent,
            handleOrientation as EventListener,
        );
        return () => {
            window.removeEventListener("devicemotion", handleMotion);
            window.removeEventListener(
                orientationEvent,
                handleOrientation as EventListener,
            );
        };
    }, [effectiveStatus]);

    if (!enabled)
        return {
            location: null,
            status: "idle",
            hasNoReferencePoint: false,
            setReferencePoint: () => {},
        };

    return {
        location,
        status: effectiveStatus,
        hasNoReferencePoint,
        setReferencePoint,
    };
}
