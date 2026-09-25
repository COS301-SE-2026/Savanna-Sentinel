import { useEffect, useRef, useState } from "react";

import type { UserLocation } from "@/types/location";

export type UserLocationStatus =
    | "idle"
    | "locating"
    | "tracking"
    | "dead-reckoning"
    | "denied"
    | "unavailable";

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

//Drift rates for accuracy
const TIME_DRIFT_RATE = 0.5;
const DIST_DRIFT_RATE = 0.15;

function offsetToLatLon(lat: number, lon: number, dx: number, dy: number) {
    const deltaLat = dy / 111139;
    const deltaLon = dx / (111139 * Math.cos((lat * Math.PI) / 180));
    return {
        lat: lat + deltaLat,
        lon: lon + deltaLon,
    };
}

export function useUserLocation(enabled = true): UseUserLocationResult {
    const [location, setLocation] = useState<UserLocation | null>(null);
    const [status, setStatus] = useState<UserLocationStatus>(() =>
        navigator.geolocation ? "locating" : "unavailable",
    );

    const lastGpsLoc = useRef<UserLocation | null>(null);
    const currentVelocity = useRef<number>(0);
    const lastMotionTime = useRef<number | null>(null);
    const deadReckoningStartTime = useRef<number | null>(null);

    useEffect(() => {
        if (!enabled) return undefined;

        const geolocation = navigator.geolocation;
        if (!geolocation) return undefined;

        const watchId = geolocation.watchPosition(
            (position) => {
                const { latitude, longitude, heading, accuracy } =
                    position.coords;
                const newLoc: UserLocation = {
                    lat: latitude,
                    lon: longitude,
                    heading: heading && !Number.isNaN(heading) ? heading : null,
                    accuracy: accuracy ?? 10,
                };

                //To use as a reference point
                lastGpsLoc.current = newLoc;
                //Reset the simulated velocity since connectivity is restored
                currentVelocity.current = 0;
                lastMotionTime.current = null;
                deadReckoningStartTime.current = null;

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
                    setStatus("unavailable");
                }
            },
            WATCH_OPTIONS,
        );

        return () => geolocation.clearWatch(watchId);
    }, [enabled]);

    //Offline location tracking
    useEffect(() => {
        if (status !== "dead-reckoning" || !window.DeviceMotionEvent) {
            return;
        }

        const handleMotion = (event: DeviceMotionEvent) => {
            //End offline handling when there is no known reference point
            if (!lastGpsLoc.current) {
                return;
            }

            //Get the current time for displacement calculations
            const now = performance.now() / 1000;
            if (!lastMotionTime.current) {
                lastMotionTime.current = now;
                deadReckoningStartTime.current = now;
                return;
            }

            //Find the change in time since last measurement
            const dt = now - lastMotionTime.current;
            lastMotionTime.current = now;

            const totalOfflineTime =
                now - (deadReckoningStartTime.current ?? now);

            //calculate acceleration
            let accelY = event.acceleration?.y || 0;

            //Filter out noise to prevent engine drift
            if (Math.abs(accelY) < 0.2) {
                accelY = 0;
            }

            //Calculate the displacement from acceleration and change in time
            currentVelocity.current += accelY * dt;
            //0 out reverse movement
            if (currentVelocity.current < 0) {
                currentVelocity.current = 0;
            }
            const distanceMoved = currentVelocity.current * dt;

            const headingDeg = lastGpsLoc.current.heading ?? 0;
            const headingRad = (headingDeg * Math.PI) / 180;
            const dx = distanceMoved * Math.sin(headingRad);
            const dy = distanceMoved * Math.cos(headingRad);

            const updatedCoords = offsetToLatLon(
                lastGpsLoc.current.lat,
                lastGpsLoc.current.lon,
                dx,
                dy,
            );

            const baseAccuracy = lastGpsLoc.current.accuracy;
            //Accuracy decreases the longer the application has been tracking for
            //and the further away from last known location you are.
            const expandedAccuracy =
                baseAccuracy +
                totalOfflineTime * TIME_DRIFT_RATE +
                distanceMoved * DIST_DRIFT_RATE;

            const updatedLocation: UserLocation = {
                lat: updatedCoords.lat,
                lon: updatedCoords.lon,
                heading: headingDeg,
                accuracy: expandedAccuracy,
            };

            lastGpsLoc.current = updatedLocation;
            setLocation(updatedLocation);
        };

        window.addEventListener("devicemotion", handleMotion);
        return () => window.removeEventListener("devicemotion", handleMotion);
    }, [status]);

    if (!enabled) return { location: null, status: "idle" };

    return { location, status };
}
