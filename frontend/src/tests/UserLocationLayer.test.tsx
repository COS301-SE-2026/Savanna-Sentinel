import { render, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("maplibre-gl", async () => {
    const { createMapLibreMock } = await import("./mocks/maplibreMock");
    return createMapLibreMock();
});

import * as maplibregl from "maplibre-gl";
import { UserLocationLayer } from "@/components/map/UserLocationLayer";
import { USER_LOCATION_COLOR } from "@/lib/mapTokens";
import type { UserLocation } from "@/types/location";
import type { FakeMap, FakeMarker } from "./mocks/maplibreMock";

const FIX: UserLocation = {
    lat: -24.3,
    lon: 31.05,
    heading: 45,
};

function createMap(): FakeMap {
    return new maplibregl.Map({
        container: document.createElement("div"),
    }) as unknown as FakeMap;
}

function onlyMarker(map: FakeMap): FakeMarker {
    const markers = [...map.markers];
    expect(markers).toHaveLength(1);
    return markers[0];
}

describe("UserLocationLayer", () => {
    it("renders nothing while there is no fix", () => {
        const map = createMap();
        render(<UserLocationLayer map={map as never} location={null} />);
        expect(map.markers.size).toBe(0);
    });

    it("places a marker at the fix once one arrives", async () => {
        const map = createMap();
        render(<UserLocationLayer map={map as never} location={FIX} />);

        await waitFor(() => expect(map.markers.size).toBe(1));
        expect(onlyMarker(map).getLngLat()).toEqual({
            lng: 31.05,
            lat: -24.3,
        });
    });

    it("labels the puck for screen readers and paints it in the brand colour", async () => {
        const map = createMap();
        render(<UserLocationLayer map={map as never} location={FIX} />);

        await waitFor(() => expect(map.markers.size).toBe(1));
        const puck = within(onlyMarker(map).element).getByRole("img", {
            name: "Your current location",
        });
        const probe = document.createElement("span");
        probe.style.background = USER_LOCATION_COLOR;
        expect(puck.style.background).toBe(probe.style.background);
    });

    it("moves the existing marker rather than adding another one", async () => {
        const map = createMap();
        const { rerender } = render(
            <UserLocationLayer map={map as never} location={FIX} />,
        );
        await waitFor(() => expect(map.markers.size).toBe(1));
        const first = onlyMarker(map);

        rerender(
            <UserLocationLayer
                map={map as never}
                location={{ ...FIX, lat: -24.25, lon: 31.1 }}
            />,
        );

        expect(map.markers.size).toBe(1);
        expect(onlyMarker(map)).toBe(first);
        expect(first.getLngLat()).toEqual({ lng: 31.1, lat: -24.25 });
    });

    it("rotates the marker to the reported heading", async () => {
        const map = createMap();
        const { rerender } = render(
            <UserLocationLayer map={map as never} location={FIX} />,
        );
        await waitFor(() => expect(map.markers.size).toBe(1));
        expect(onlyMarker(map).getRotation()).toBe(45);

        rerender(
            <UserLocationLayer
                map={map as never}
                location={{ ...FIX, heading: 200 }}
            />,
        );
        expect(onlyMarker(map).getRotation()).toBe(200);
    });

    it("aligns rotation to the map so the arrow tracks true north", async () => {
        const map = createMap();
        render(<UserLocationLayer map={map as never} location={FIX} />);
        await waitFor(() => expect(map.markers.size).toBe(1));
        expect(onlyMarker(map).options.rotationAlignment).toBe("map");
    });

    it("always draws the heading arrow", async () => {
        const map = createMap();
        render(<UserLocationLayer map={map as never} location={FIX} />);

        await waitFor(() => expect(map.markers.size).toBe(1));
        expect(
            within(onlyMarker(map).element).getByTestId(
                "user-location-heading-arrow",
            ),
        ).toBeTruthy();
    });

    it("keeps the arrow on north when the heading is unknown", async () => {
        const map = createMap();
        render(
            <UserLocationLayer
                map={map as never}
                location={{ ...FIX, heading: null }}
            />,
        );

        await waitFor(() => expect(map.markers.size).toBe(1));
        expect(
            within(onlyMarker(map).element).getByTestId(
                "user-location-heading-arrow",
            ),
        ).toBeTruthy();
        expect(onlyMarker(map).getRotation()).toBe(0);
    });

    it("draws no accuracy ring around the puck", async () => {
        const map = createMap();
        render(<UserLocationLayer map={map as never} location={FIX} />);

        await waitFor(() => expect(map.markers.size).toBe(1));
        const puck = within(onlyMarker(map).element).getByRole("img", {
            name: "Your current location",
        });
        expect(puck.querySelectorAll("span")).toHaveLength(0);
        expect(puck.querySelectorAll("svg")).toHaveLength(1);
    });

    it("removes the marker when the fix goes away", async () => {
        const map = createMap();
        const { rerender } = render(
            <UserLocationLayer map={map as never} location={FIX} />,
        );
        await waitFor(() => expect(map.markers.size).toBe(1));

        rerender(<UserLocationLayer map={map as never} location={null} />);
        expect(map.markers.size).toBe(0);
    });

    it("removes the marker on unmount", async () => {
        const map = createMap();
        const { unmount } = render(
            <UserLocationLayer map={map as never} location={FIX} />,
        );
        await waitFor(() => expect(map.markers.size).toBe(1));

        unmount();
        expect(map.markers.size).toBe(0);
    });

    it("does not intercept clicks meant for the heatmap underneath", async () => {
        const map = createMap();
        render(<UserLocationLayer map={map as never} location={FIX} />);

        await waitFor(() => expect(map.markers.size).toBe(1));
        const puck = within(onlyMarker(map).element).getByRole("img", {
            name: "Your current location",
        });
        expect(puck.className).toContain("pointer-events-none");
    });
});
