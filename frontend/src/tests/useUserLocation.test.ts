import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

import { useUserLocation } from "@/hooks/useUserLocation";

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

    it("reports unavailable when the watch fails before any fix", async () => {
        const geo = installGeolocation();
        const { result } = renderHook(() => useUserLocation());

        act(() => geo.failure?.(positionError(2)));

        await waitFor(() => expect(result.current.status).toBe("unavailable"));
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
    //Ignore added since it is used, yet eslint says it is not
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let performanceNowSpy: ReturnType<typeof vi.spyOn>;
    let currentTime = 1000;

    beforeEach(() => {
        currentTime = 1000;
        performanceNowSpy = vi
            .spyOn(performance, "now")
            .mockImplementation(() => currentTime);

        //Add DeviceMotionEvent if it is missing from the environment
        if (typeof window.DeviceMotionEvent === "undefined") {
            class CustomDeviceMotionEvent extends Event {
                acceleration: {
                    x: number | null;
                    y: number | null;
                    z: number | null;
                } | null;
                constructor(
                    type: string,
                    init?: {
                        acceleration?: {
                            x?: number;
                            y?: number;
                            z?: number;
                        };
                    },
                ) {
                    super(type);
                    this.acceleration = init?.acceleration
                        ? {
                              x: init.acceleration.x ?? 0,
                              y: init.acceleration.y ?? 0,
                              z: init.acceleration.z ?? 0,
                          }
                        : null;
                }
            }
            (window as unknown as Record<string, unknown>).DeviceMotionEvent =
                CustomDeviceMotionEvent;
        }
    });

    afterEach(() => {
        vi.restoreAllMocks();
        removeGeolocation();
    });

    it("Moves from tracking to dead-reckoning on GPS failure", async () => {
        const geo = installGeolocation();
        const { result } = renderHook(() => useUserLocation());

        act(() => geo.success?.(position()));
        await waitFor(() => expect(result.current.status).toBe("tracking"));

        act(() => geo.failure?.(positionError(2)));
        await waitFor(() =>
            expect(result.current.status).toBe("dead-reckoning"),
        );

        expect(result.current.location?.lat).toBeCloseTo(-24.3);
        expect(result.current.location?.lon).toBeCloseTo(31.05);
    });

    it("calculates forward velocity and correctly increases accuracy", async () => {
        const geo = installGeolocation();
        const { result } = renderHook(() => useUserLocation());

        act(() =>
            geo.success?.(
                position({
                    latitude: -24.3,
                    longitude: 31.05,
                    heading: 0,
                    accuracy: 10,
                }),
            ),
        );
        act(() => geo.failure?.(positionError(2)));
        await waitFor(() =>
            expect(result.current.status).toBe("dead-reckoning"),
        );

        act(() => {
            window.dispatchEvent(
                new DeviceMotionEvent("devicemotion", {
                    acceleration: {
                        y: 1.0,
                    },
                }),
            );
        });

        currentTime += 1000;

        act(() => {
            window.dispatchEvent(
                new DeviceMotionEvent("devicemotion", {
                    acceleration: {
                        y: 1.0,
                    },
                }),
            );
        });

        expect(result.current.location?.lat).toBeGreaterThan(-24.3);
        expect(result.current.location?.accuracy).toBeGreaterThan(10);
    });

    it("calculates displacement in the current heading, 90 degrees", async () => {
        const geo = installGeolocation();
        const { result } = renderHook(() => useUserLocation());

        act(() =>
            geo.success?.(
                position({
                    latitude: -24.3,
                    longitude: 31.05,
                    heading: 90,
                }),
            ),
        );
        act(() => geo.failure?.(positionError(2)));
        await waitFor(() =>
            expect(result.current.status).toBe("dead-reckoning"),
        );

        act(() => {
            window.dispatchEvent(
                new DeviceMotionEvent("devicemotion", {
                    acceleration: {
                        y: 2.0,
                    },
                }),
            );
        });

        act(() => {
            window.dispatchEvent(
                new DeviceMotionEvent("devicemotion", {
                    acceleration: {
                        y: 2.0,
                    },
                }),
            );
        });

        expect(result.current.location?.lon).toBeCloseTo(31.05);
        expect(result.current.location?.lat).toBeCloseTo(-24.3, 5);
    });

    it("filters out acceleration noise which is below the threshold <0.2 m/s^2", async () => {
        const geo = installGeolocation();
        const { result } = renderHook(() => useUserLocation());

        act(() =>
            geo.success?.(
                position({
                    latitude: -24.3,
                    longitude: 31.05,
                    heading: 90,
                }),
            ),
        );
        act(() => geo.failure?.(positionError(2)));
        await waitFor(() =>
            expect(result.current.status).toBe("dead-reckoning"),
        );

        act(() => {
            window.dispatchEvent(
                new DeviceMotionEvent("devicemotion", {
                    acceleration: {
                        y: 0.1,
                    },
                }),
            );
        });

        currentTime += 1000;

        act(() => {
            window.dispatchEvent(
                new DeviceMotionEvent("devicemotion", {
                    acceleration: {
                        y: 0.1,
                    },
                }),
            );
        });

        expect(result.current.location?.lat).toBe(-24.3);
        expect(result.current.location?.lon).toBe(31.05);
    });

    it("velocity resets and returns to tracking when signal returns", async () => {
        const geo = installGeolocation();
        const { result } = renderHook(() => useUserLocation());

        act(() =>
            geo.success?.(
                position({
                    latitude: -24.3,
                    longitude: 31.05,
                    heading: 90,
                }),
            ),
        );
        act(() => geo.failure?.(positionError(2)));
        await waitFor(() =>
            expect(result.current.status).toBe("dead-reckoning"),
        );

        act(() => {
            window.dispatchEvent(
                new DeviceMotionEvent("devicemotion", {
                    acceleration: {
                        y: 2.0,
                    },
                }),
            );
        });

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

        expect(result.current.location).toEqual({
            lat: -24.5,
            lon: 31.2,
            heading: 180,
            accuracy: 5,
        });
    });
});
