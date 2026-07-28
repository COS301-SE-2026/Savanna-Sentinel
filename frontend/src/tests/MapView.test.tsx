import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("maplibre-gl", async () => {
    const { createMapLibreMock } = await import("./mocks/maplibreMock");
    return createMapLibreMock();
});

import maplibregl from "maplibre-gl";
import { MapView } from "@/components/map/MapView";
import type { FakeMap } from "./mocks/maplibreMock";

function tileFetchError() {
    const error = new Error(
        "AJAXError: Failed to fetch (0): https://tile.openstreetmap.org/10/600/583.png",
    );
    return Object.assign(error, {
        status: 0,
        statusText: "Failed to fetch",
        url: "https://tile.openstreetmap.org/10/600/583.png",
    });
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe("MapView", () => {
    it("calls onMapReady once the underlying map fires 'load'", async () => {
        const onMapReady = vi.fn();
        render(
            <MapView
                center={[31.1, -24.3]}
                zoom={12}
                onMapReady={onMapReady}
                onMapRemove={() => {}}
            />,
        );
        await waitFor(() => expect(onMapReady).toHaveBeenCalledTimes(1));
    });

    it("disables 3D pitch/tilt while leaving rotation enabled", async () => {
        const onMapReady = vi.fn();
        render(
            <MapView
                center={[31.1, -24.3]}
                zoom={12}
                onMapReady={onMapReady}
                onMapRemove={() => {}}
            />,
        );
        await waitFor(() => expect(onMapReady).toHaveBeenCalled());
        const map = onMapReady.mock.calls[0][0] as unknown as FakeMap;

        expect(map.options.pitch).toBe(0);
        expect(map.options.maxPitch).toBe(0);
        expect(map.options.dragPitch).toBe(false);
        expect(map.options.touchPitch).toBe(false);
        expect(map.options.pitchWithRotate).toBe(false);
        expect(map.options.dragRotate).not.toBe(false);
    });

    it("always forwards clicks to the latest onMapClick, even after a rerender", async () => {
        const onMapReady = vi.fn();
        const firstHandler = vi.fn();
        const { rerender } = render(
            <MapView
                center={[31.1, -24.3]}
                zoom={12}
                onMapReady={onMapReady}
                onMapRemove={() => {}}
                onMapClick={firstHandler}
            />,
        );
        await waitFor(() => expect(onMapReady).toHaveBeenCalled());
        const map = onMapReady.mock.calls[0][0] as unknown as FakeMap;

        const secondHandler = vi.fn();
        rerender(
            <MapView
                center={[31.1, -24.3]}
                zoom={12}
                onMapReady={onMapReady}
                onMapRemove={() => {}}
                onMapClick={secondHandler}
            />,
        );

        map.fireClick({ lng: 31.05, lat: -24.32 });
        expect(firstHandler).not.toHaveBeenCalled();
        expect(secondHandler).toHaveBeenCalledWith({ lng: 31.05, lat: -24.32 });
    });

    it("keeps the map usable when a single tile fetch fails", async () => {
        const onMapReady = vi.fn();
        render(
            <MapView
                center={[31.1, -24.3]}
                zoom={12}
                onMapReady={onMapReady}
                onMapRemove={() => {}}
            />,
        );
        await waitFor(() => expect(onMapReady).toHaveBeenCalled());
        const map = onMapReady.mock.calls[0][0] as unknown as FakeMap;

        act(() => map.fireError(tileFetchError()));

        expect(screen.queryByText(/Map failed to initialise/i)).toBeNull();
    });

    it("shows the blocking overlay when the map cannot be constructed", async () => {
        // A function expression, not an arrow: MapView calls this with `new`.
        vi.spyOn(maplibregl, "Map").mockImplementation(
            function throwingMap(): never {
                throw new Error("WebGL is not supported");
            } as never,
        );

        render(
            <MapView
                center={[31.1, -24.3]}
                zoom={12}
                onMapReady={() => {}}
                onMapRemove={() => {}}
            />,
        );

        await waitFor(() =>
            expect(
                screen.getByText(
                    /Map failed to initialise: Error: WebGL is not supported/i,
                ),
            ).toBeInTheDocument(),
        );
    });

    it("still surfaces a non-fetch runtime failure on the overlay", async () => {
        const onMapReady = vi.fn();
        render(
            <MapView
                center={[31.1, -24.3]}
                zoom={12}
                onMapReady={onMapReady}
                onMapRemove={() => {}}
            />,
        );
        await waitFor(() => expect(onMapReady).toHaveBeenCalled());
        const map = onMapReady.mock.calls[0][0] as unknown as FakeMap;

        act(() => map.fireError(new Error("WebGL context lost")));

        expect(screen.getByText(/WebGL context lost/i)).toBeInTheDocument();
    });
});
