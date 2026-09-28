import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

import { useUserLocation } from "@/hooks/useUserLocation";
import { STEP_LENGTH_M } from "@/lib/deadReckoning";
import type { UserLocation } from "@/types/location";

type SuccessCallback = (position: GeolocationPosition) => void;
type ErrorCallback = (error: GeolocationPositionError) => void;

interface FakeGeolocation {
    success: SuccessCallback | null;
    failure: ErrorCallback | null;
    clearWatch: ReturnType<typeof vi.fn>;
    watchPosition: ReturnType<typeof vi.fn>;
}

function installGeolocation(): FakeGeolocation {
    const fake: FakeGeolocation = {
        success: null,
        failure: null,
        clearWatch: vi.fn(),
        watchPosition: vi.fn(),
    };
    fake.watchPosition.mockImplementation(
        (success: SuccessCallback, failure: ErrorCallback) => {
            fake.success = success;
            fake.failure = failure;
            return 7;
        },
    );
    Object.defineProperty(window.navigator, "geolocation", {
        configurable: true,
        value: fake,
    });
    return fake;
}

function removeGeolocation() {
    Object.defineProperty(window.navigator, "geolocation", {
        configurable: true,
        value: undefined,
    });
}

function position(
    overrides: Partial<GeolocationCoordinates> = {},
): GeolocationPosition {
    return {
        coords: {
            latitude: -24.3,
            longitude: 31.05,
            accuracy: 12,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
            ...overrides,
        },
        timestamp: 1_700_000_000_000,
    } as GeolocationPosition;
}

function positionError(code: number): GeolocationPositionError {
    return { code, message: "" } as GeolocationPositionError;
}

describe("useUserLocation", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        removeGeolocation();
    });

    it("reports unavailable when the browser has no geolocation", () => {
        removeGeolocation();
        const { result } = renderHook(() => useUserLocation());
        expect(result.current.status).toBe("unavailable");
        expect(result.current.location).toBeNull();
    });

    it("starts a watch and reports locating before the first fix", () => {
        const geo = installGeolocation();
        const { result } = renderHook(() => useUserLocation());
        expect(geo.watchPosition).toHaveBeenCalledTimes(1);
        expect(result.current.status).toBe("locating");
        expect(result.current.location).toBeNull();
    });

    it("maps a fix onto a UserLocation", async () => {
        const geo = installGeolocation();
        const { result } = renderHook(() => useUserLocation());

        act(() => geo.success?.(position({ heading: 90 })));

        await waitFor(() => expect(result.current.status).toBe("tracking"));
        expect(result.current.location).toEqual({
            accuracy: 12,
            lat: -24.3,
            lon: 31.05,
            heading: 90,
        });
    });

    it("keeps following the watch as the fix moves", async () => {
        const geo = installGeolocation();
        const { result } = renderHook(() => useUserLocation());

        act(() => geo.success?.(position()));
        await waitFor(() => expect(result.current.location).not.toBeNull());

        act(() => geo.success?.(position({ latitude: -24.31 })));

        await waitFor(() =>
            expect(result.current.location?.lat).toBeCloseTo(-24.31),
        );
    });

    it("normalises a missing heading to null", async () => {
        const geo = installGeolocation();
        const { result } = renderHook(() => useUserLocation());

        act(() => geo.success?.(position({ heading: NaN })));

        await waitFor(() => expect(result.current.location).not.toBeNull());
        expect(result.current.location?.heading).toBeNull();
    });

    it("drops the fix when permission is denied", async () => {
        const geo = installGeolocation();
        const { result } = renderHook(() => useUserLocation());

        act(() => geo.success?.(position()));
        await waitFor(() => expect(result.current.location).not.toBeNull());

        act(() => geo.failure?.(positionError(1)));

        await waitFor(() => expect(result.current.status).toBe("denied"));
        expect(result.current.location).toBeNull();
    });

    it("holds the last known fix through a transient watch error", async () => {
        const geo = installGeolocation();
        const { result } = renderHook(() => useUserLocation());

        act(() => geo.success?.(position()));
        await waitFor(() => expect(result.current.status).toBe("tracking"));

        act(() => geo.failure?.(positionError(3)));

        expect(result.current.status).toBe("dead-reckoning");
        expect(result.current.location?.lat).toBeCloseTo(-24.3);
    });

    it("reports needs-reference when the watch fails before any fix", async () => {
        const geo = installGeolocation();
        const { result } = renderHook(() => useUserLocation());

        act(() => geo.failure?.(positionError(2)));

        await waitFor(() =>
            expect(result.current.status).toBe("needs-reference"),
        );
        expect(result.current.hasNoReferencePoint).toBe(true);
    });

    it("clears the watch on unmount", () => {
        const geo = installGeolocation();
        const { unmount } = renderHook(() => useUserLocation());
        unmount();
        expect(geo.clearWatch).toHaveBeenCalledWith(7);
    });

    it("asks the browser for nothing while disabled", () => {
        const geo = installGeolocation();
        const { result } = renderHook(() => useUserLocation(false));
        expect(geo.watchPosition).not.toHaveBeenCalled();
        expect(result.current.status).toBe("idle");
        expect(result.current.location).toBeNull();
    });

    it("starts the watch only once it is enabled", () => {
        const geo = installGeolocation();
        const { rerender } = renderHook(
            ({ on }: { on: boolean }) => useUserLocation(on),
            { initialProps: { on: false } },
        );
        expect(geo.watchPosition).not.toHaveBeenCalled();

        rerender({ on: true });
        expect(geo.watchPosition).toHaveBeenCalledTimes(1);
    });

    it("tears the watch down when it is disabled again", async () => {
        const geo = installGeolocation();
        const { result, rerender } = renderHook(
            ({ on }: { on: boolean }) => useUserLocation(on),
            { initialProps: { on: true } },
        );
        act(() => geo.success?.(position()));
        await waitFor(() => expect(result.current.status).toBe("tracking"));

        rerender({ on: false });

        expect(geo.clearWatch).toHaveBeenCalledWith(7);
        expect(result.current.location).toBeNull();
        expect(result.current.status).toBe("idle");
    });

    it("redraws the last fix straight away when re-enabled", async () => {
        const geo = installGeolocation();
        const { result, rerender } = renderHook(
            ({ on }: { on: boolean }) => useUserLocation(on),
            { initialProps: { on: true } },
        );
        act(() => geo.success?.(position({ latitude: -24.5 })));
        await waitFor(() => expect(result.current.location).not.toBeNull());

        rerender({ on: false });
        rerender({ on: true });

        expect(result.current.location?.lat).toBeCloseTo(-24.5);
    });
});

describe("dead reckoning for useUserLocation", () => {
    const degPerMetre = 1 / 111139;
    let currentTime = 1000;

    function motion(magnitude: number) {
        const event = new Event("devicemotion");
        Object.assign(event, {
            acceleration: null,
            accelerationIncludingGravity: { x: 0, y: 0, z: magnitude },
        });
        return event;
    }

    function faceCompass(heading: number) {
        act(() => {
            for (let i = 0; i < 60; i++) {
                const event = new Event("deviceorientation");
                Object.assign(event, {
                    alpha: (360 - heading) % 360,
                    beta: 0,
                    gamma: 0,
                    absolute: true,
                });
                window.dispatchEvent(event);
            }
        });
    }

    const stride = [
        ...Array<number>(5).fill(9.81),
        ...Array<number>(5).fill(12.5),
        ...Array<number>(5).fill(7.2),
        ...Array<number>(5).fill(9.81),
    ];

    function walk(steps: number) {
        act(() => {
            for (let i = 0; i < steps; i++) {
                for (const magnitude of stride) {
                    currentTime += 20;
                    window.dispatchEvent(motion(magnitude));
                }
            }
        });
    }

    async function startDeadReckoning(heading: number | null = null) {
        const geo = installGeolocation();
        const hook = renderHook(() => useUserLocation());

        act(() =>
            geo.success?.(
                position({
                    latitude: -24.3,
                    longitude: 31.05,
                    heading,
                    accuracy: 10,
                }),
            ),
        );
        act(() => geo.failure?.(positionError(2)));
        await waitFor(() =>
            expect(hook.result.current.status).toBe("dead-reckoning"),
        );
        return { geo, result: hook.result };
    }

    beforeEach(() => {
        currentTime = 1000;
        vi.spyOn(performance, "now").mockImplementation(() => currentTime);

        if (typeof window.DeviceMotionEvent === "undefined") {
            (window as unknown as Record<string, unknown>).DeviceMotionEvent =
                class extends Event {};
        }
    });

    afterEach(() => {
        vi.restoreAllMocks();
        removeGeolocation();
    });

    it("Moves from tracking to dead-reckoning on GPS failure", async () => {
        const { result } = await startDeadReckoning();

        expect(result.current.location?.lat).toBeCloseTo(-24.3);
        expect(result.current.location?.lon).toBeCloseTo(31.05);
    });

    it("moves one stride per step in the compass direction", async () => {
        const { result } = await startDeadReckoning();

        faceCompass(0);
        walk(3);

        expect(result.current.location?.lat).toBeCloseTo(
            -24.3 + 3 * STEP_LENGTH_M * degPerMetre,
            8,
        );
        expect(result.current.location?.lon).toBeCloseTo(31.05, 8);
    });

    it("follows the compass when the user turns", async () => {
        const { result } = await startDeadReckoning();

        faceCompass(0);
        walk(2);
        const afterNorth = result.current.location!;

        faceCompass(90);
        walk(2);

        expect(result.current.location?.lat).toBeCloseTo(afterNorth.lat, 8);
        expect(result.current.location?.lon).toBeGreaterThan(afterNorth.lon);
    });

    it("keeps a steady speed however long the user walks", async () => {
        const { result } = await startDeadReckoning();

        faceCompass(0);
        walk(5);
        const firstLeg = result.current.location!.lat - -24.3;
        walk(5);
        const secondLeg = result.current.location!.lat - -24.3 - firstLeg;

        expect(secondLeg).toBeCloseTo(firstLeg, 8);
    });

    it("rotates the puck with the compass while standing still", async () => {
        const { result } = await startDeadReckoning();

        faceCompass(135);

        expect(result.current.location?.heading).toBeCloseTo(135);
        expect(result.current.location?.lat).toBe(-24.3);
    });

    it("ignores relative orientation that isn't tied to north", async () => {
        const { result } = await startDeadReckoning(0);

        const event = new Event("deviceorientation");
        Object.assign(event, { alpha: 90, beta: 0, gamma: 0, absolute: false });
        act(() => {
            window.dispatchEvent(event);
        });

        expect(result.current.location?.heading).toBe(0);
    });

    it("falls back to the last GPS course when there is no compass", async () => {
        const { result } = await startDeadReckoning(90);

        walk(2);

        expect(result.current.location?.lat).toBeCloseTo(-24.3, 8);
        expect(result.current.location?.lon).toBeGreaterThan(31.05);
    });

    it("stays put with no compass and no GPS course", async () => {
        const { result } = await startDeadReckoning(null);

        walk(3);

        expect(result.current.location?.lat).toBe(-24.3);
        expect(result.current.location?.lon).toBe(31.05);
    });

    it("does not count hand jitter as steps", async () => {
        const { result } = await startDeadReckoning();
        faceCompass(0);

        act(() => {
            for (let i = 0; i < 200; i++) {
                currentTime += 16;
                window.dispatchEvent(motion(9.81 + (i % 2 ? 0.4 : -0.4)));
            }
        });

        expect(result.current.location?.lat).toBe(-24.3);
    });

    it("grows accuracy with distance without compounding", async () => {
        const { result } = await startDeadReckoning();
        faceCompass(0);

        walk(10);

        const accuracy = result.current.location!.accuracy;
        expect(accuracy).toBeGreaterThan(10);
        expect(accuracy).toBeLessThan(15);
    });

    it("returns to tracking when signal returns", async () => {
        const { geo, result } = await startDeadReckoning(90);
        walk(2);

        act(() =>
            geo.success?.(
                position({
                    latitude: -24.5,
                    longitude: 31.2,
                    heading: 180,
                    accuracy: 5,
                }),
            ),
        );

        expect(result.current.status).toBe("tracking");
        expect(result.current.location).toEqual({
            lat: -24.5,
            lon: 31.2,
            heading: 180,
            accuracy: 5,
        });
    });

    it("sets reference point manually and switches status to dead-reckoning", async () => {
        const geo = installGeolocation();
        const { result } = renderHook(() => useUserLocation());

        act(() => geo.failure?.(positionError(2)));
        await waitFor(() =>
            expect(result.current.status).toBe("needs-reference"),
        );
        expect(result.current.hasNoReferencePoint).toBe(true);

        const manualPoi: UserLocation = {
            lat: -24.3,
            lon: 31.05,
            heading: 0,
            accuracy: 10,
        };

        act(() => {
            result.current.setReferencePoint(manualPoi);
        });

        expect(result.current.status).toBe("dead-reckoning");
        expect(result.current.hasNoReferencePoint).toBe(false);
        expect(result.current.location).toEqual(manualPoi);
    });

    it("walks from a manually set reference point", async () => {
        const geo = installGeolocation();
        const { result } = renderHook(() => useUserLocation());

        act(() => geo.failure?.(positionError(2)));
        await waitFor(() =>
            expect(result.current.status).toBe("needs-reference"),
        );

        act(() => {
            result.current.setReferencePoint({
                lat: -24.3,
                lon: 31.05,
                heading: 0,
                accuracy: 10,
            });
        });
        faceCompass(180);
        walk(2);

        expect(result.current.location?.lat).toBeCloseTo(
            -24.3 - 2 * STEP_LENGTH_M * degPerMetre,
            8,
        );
    });

    it("switches to dead-reckoning when forced after a GPS fix", async () => {
        const geo = installGeolocation();
        const { result, rerender } = renderHook(
            ({ forced }) => useUserLocation(true, forced),
            { initialProps: { forced: false } },
        );

        act(() => geo.success?.(position({ heading: 0, accuracy: 10 })));
        await waitFor(() => expect(result.current.status).toBe("tracking"));

        rerender({ forced: true });
        expect(result.current.status).toBe("dead-reckoning");

        faceCompass(0);
        walk(2);

        expect(result.current.location?.lat).toBeGreaterThan(-24.3);
        expect(result.current.location?.accuracy).toBeGreaterThan(10);
    });

    it("ignores GPS fixes while forced and resumes them when released", async () => {
        const geo = installGeolocation();
        const { result, rerender } = renderHook(
            ({ forced }) => useUserLocation(true, forced),
            { initialProps: { forced: true } },
        );

        act(() => geo.success?.(position({ latitude: -24.3 })));
        await waitFor(() =>
            expect(result.current.status).toBe("dead-reckoning"),
        );

        act(() => geo.success?.(position({ latitude: -25 })));
        expect(result.current.location?.lat).toBeCloseTo(-24.3);

        rerender({ forced: false });
        act(() => geo.success?.(position({ latitude: -25 })));
        expect(result.current.status).toBe("tracking");
        expect(result.current.location?.lat).toBeCloseTo(-25);
    });

    it("stays locating when forced before any GPS fix", () => {
        installGeolocation();
        const { result } = renderHook(() => useUserLocation(true, true));
        expect(result.current.status).toBe("locating");
    });
});
