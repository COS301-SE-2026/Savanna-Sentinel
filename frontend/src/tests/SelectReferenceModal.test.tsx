import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import SelectReferenceModal, {
    type Poi,
} from "@/components/map/SelectReferenceModal";

const mockPois: Poi[] = [
    { id: "1", name: "Test 1", lat: -24.321, lon: 31.052 },
    { id: "2", name: "Test 2", lat: -24.4, lon: 31.1 },
];

describe("SelectReferenceModal", () => {
    it("renders dialog title and table headers when open becomes true", () => {
        render(
            <SelectReferenceModal
                open={true}
                onOpenChange={vi.fn()}
                pois={mockPois}
            />,
        );

        expect(
            screen.getByRole("heading", { name: /Select Point of Interest/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("columnheader", { name: "Preview" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("columnheader", { name: "Location Name" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("columnheader", { name: "Select" }),
        ).toBeInTheDocument();
    });

    it("does not render content when open is false", () => {
        render(
            <SelectReferenceModal
                open={false}
                onOpenChange={vi.fn()}
                pois={mockPois}
            />,
        );

        expect(
            screen.queryByRole("heading", {
                name: /Select Point of Interest/i,
            }),
        ).toBeNull();
    });

    it("renders empty state message when pois array is empty", () => {
        render(
            <SelectReferenceModal
                open={true}
                onOpenChange={vi.fn()}
                pois={[]}
            />,
        );

        expect(
            screen.getByText(/No points of interest available/i),
        ).toBeInTheDocument();
    });

    it("renders all POIs elements in array", () => {
        render(
            <SelectReferenceModal
                open={true}
                onOpenChange={vi.fn()}
                pois={mockPois}
            />,
        );

        expect(screen.getByText("Test 1")).toBeInTheDocument();
        expect(screen.getByText("Test 2")).toBeInTheDocument();
        expect(
            screen.getAllByRole("button", { name: /^Select$/i }),
        ).toHaveLength(2);
    });

    it("calls onSelectPoi and closes the modal when Select is clicked", async () => {
        const user = userEvent.setup();
        const onSelectPoi = vi.fn();
        const onOpenChange = vi.fn();

        render(
            <SelectReferenceModal
                open={true}
                onOpenChange={onOpenChange}
                pois={mockPois}
                onSelectPoi={onSelectPoi}
            />,
        );

        const selectButtons = screen.getAllByRole("button", {
            name: /^Select$/i,
        });
        await user.click(selectButtons[0]);

        expect(onSelectPoi).toHaveBeenCalledTimes(1);
        expect(onSelectPoi).toHaveBeenCalledWith(mockPois[0]);
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("calls onPreviewPoi when the Preview button is clicked", async () => {
        const user = userEvent.setup();
        const onPreviewPoi = vi.fn();
        const onOpenChange = vi.fn();

        render(
            <SelectReferenceModal
                open={true}
                onOpenChange={onOpenChange}
                pois={mockPois}
                onPreviewPoi={onPreviewPoi}
            />,
        );

        const previewButton = screen.getByRole("button", {
            name: /Preview Test 1 on map/i,
        });
        await user.click(previewButton);

        expect(onPreviewPoi).toHaveBeenCalledTimes(1);
        expect(onPreviewPoi).toHaveBeenCalledWith(mockPois[0]);
    });
});
