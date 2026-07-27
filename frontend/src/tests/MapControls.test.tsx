import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { MapControls } from "@/components/map/MapControls";

describe("MapControls", () => {
    it("does nothing when map is null", async () => {
        render(<MapControls map={null} />);
        await userEvent.click(screen.getByRole("button", { name: /zoom in/i }));
        // no throw = pass
    });

    it("calls zoomIn/zoomOut/flyTo on the map instance", async () => {
        const map = {
            zoomIn: vi.fn(),
            zoomOut: vi.fn(),
            flyTo: vi.fn(),
            getCenter: vi.fn(),
            getZoom: vi.fn(),
        };
        render(<MapControls map={map as never} />);

        await userEvent.click(screen.getByRole("button", { name: /zoom in/i }));
        expect(map.zoomIn).toHaveBeenCalledTimes(1);

        await userEvent.click(
            screen.getByRole("button", { name: /zoom out/i }),
        );
        expect(map.zoomOut).toHaveBeenCalledTimes(1);

        await userEvent.click(
            screen.getByRole("button", { name: /reset view/i }),
        );
        expect(map.flyTo).toHaveBeenCalledTimes(1);
    });

    it("resets to the given default center/zoom on reset view", async () => {
        const map = {
            zoomIn: vi.fn(),
            zoomOut: vi.fn(),
            flyTo: vi.fn(),
            getCenter: vi.fn(),
            getZoom: vi.fn(),
        };
        render(
            <MapControls
                map={map as never}
                defaultCenter={[31.18, -24.2]}
                defaultZoom={10}
            />,
        );

        await userEvent.click(
            screen.getByRole("button", { name: /reset view/i }),
        );
        expect(map.flyTo).toHaveBeenCalledWith(
            expect.objectContaining({
                center: [31.18, -24.2],
                zoom: 10,
                bearing: 0,
                pitch: 0,
            }),
        );
    });
});
