import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

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

        expect(result.current.status).toBe("tracking");
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
