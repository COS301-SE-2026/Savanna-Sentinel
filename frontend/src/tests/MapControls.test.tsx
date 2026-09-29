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

    it("disables the zoom in/out and reset view buttons when zoomDisabled is true", async () => {
        const map = {
            zoomIn: vi.fn(),
            zoomOut: vi.fn(),
            flyTo: vi.fn(),
            getCenter: vi.fn(),
            getZoom: vi.fn(),
        };
        render(<MapControls map={map as never} zoomDisabled />);

        expect(screen.getByRole("button", { name: /zoom in/i })).toBeDisabled();
        expect(
            screen.getByRole("button", { name: /zoom out/i }),
        ).toBeDisabled();
        expect(
            screen.getByRole("button", { name: /reset view/i }),
        ).toBeDisabled();

        await userEvent.click(screen.getByRole("button", { name: /zoom in/i }));
        expect(map.zoomIn).not.toHaveBeenCalled();
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

    it("does not render the reference button when showReferenceButton is false", () => {
        render(<MapControls map={null} />);
        expect(
            screen.queryByRole("button", { name: /set reference point/i }),
        ).not.toBeInTheDocument();
    });

    it("renders the reference button when showReferenceButton is true and triggers onOpenPoiModal when clicked", async () => {
        const onOpenPoiModal = vi.fn();
        render(
            <MapControls
                map={null}
                showReferenceButton
                onOpenPoiModal={onOpenPoiModal}
            />,
        );

        const button = screen.getByRole("button", {
            name: /set reference point/i,
        });
        expect(button).toBeInTheDocument();

        await userEvent.click(button);
        expect(onOpenPoiModal).toHaveBeenCalledTimes(1);
    });

    it("applies the 'set reference point' title and pulsing error styles", () => {
        render(
            <MapControls
                map={null}
                showReferenceButton
                hasReferencePoint={false}
            />,
        );

        const button = screen.getByRole("button", {
            name: /set reference point/i,
        });
        expect(button).toHaveAttribute("title", "Set reference point");

        const icon = button.querySelector("svg");
        expect(icon).toHaveClass("text-destructive", "animate-pulse");
        expect(icon).not.toHaveClass("text-brand-primary");
    });
    it("applies the 'change reference point' title and primary brand styles when hasReferencePoint is true", () => {
        render(
            <MapControls
                map={null}
                showReferenceButton
                hasReferencePoint={true}
            />,
        );

        const button = screen.getByRole("button", {
            name: /set reference point/i,
        });
        expect(button).toHaveAttribute("title", "Change reference point");

        const icon = button.querySelector("svg");
        expect(icon).toHaveClass("text-brand-primary");
        expect(icon).not.toHaveClass("text-destructive", "animate-pulse");
    });
});
