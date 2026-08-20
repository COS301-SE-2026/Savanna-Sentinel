import { setupServer } from "msw/node"
import { describe, beforeAll, afterAll, afterEach, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import ParkZoneUploadPage from "@/pages/ParkZoneUploadPage"
import {
    deleteErrorHandlers,
    parkZoneHandlers,
    uploadErrorHandlers,
} from "./mocks/parkZoneHandlers"
import userEvent from "@testing-library/user-event"
import { useEffect } from "react"
import { notifyCritical } from "@/components/ui/toast"

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual("react-router-dom");
    return {
        ...actual,
        useNavigate: () => mockNavigate
    }
})

vi.mock("@/components/map/MapView", () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    MapView: ({ onMapReady }: any) => {
        useEffect(() => {
            const mockMap = {
                fitBounds: vi.fn(),
                getContainer: vi.fn(() => document.createElement("div")),
                on: vi.fn(),
                off: vi.fn(),
                addLayer: vi.fn(),
                removeLayer: vi.fn(),
                addSource: vi.fn(),
                removeSource: vi.fn(),
                getLayer: vi.fn(),
                getSource: vi.fn(),
            };
            onMapReady?.(mockMap);
        }, [onMapReady]);

        return <div data-testid="map-view">Mocked Map View</div>;
    },
}));

vi.mock("@/components/ui/toast", () => ({
    notifyCritical: vi.fn()
}))

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => {
    server.resetHandlers();
    vi.clearAllMocks();
})
afterAll(() => server.close())

describe("ParkZoneUploadPage", () => {
    it("renders the file upload dropzone initially", () => {
        server.use(...parkZoneHandlers)
        render(<ParkZoneUploadPage />)

        expect(
            screen.getByText(/Upload wgs84/i)
        ).toBeInTheDocument()
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    })
    it("uploads a geojson file and opens the map confirmation dialog", async () => {
        const user = userEvent.setup();
        server.use(...parkZoneHandlers);
        const { container } = render(<ParkZoneUploadPage />)

        const file = new File(['{"type":"FeatureCollection"}'], "reserve.geojson", {
            type: "application/json",
        });

        const fileInput = container.querySelector("#park-geojson-file") as HTMLInputElement
        await user.upload(fileInput, file)

        expect (await screen.findByRole("dialog")).toBeInTheDocument()
        expect(
            screen.getByRole("heading", { name: /confirm map layout/i})
        ).toBeInTheDocument()
        expect(screen.getByTestId("map-view")).toBeInTheDocument();
    })
    it("shows a critical toast notification when file upload fails", async () => {
        const user = userEvent.setup();
        server.use(...uploadErrorHandlers)
        const { container } = render(<ParkZoneUploadPage />)

        const file = new File(['{"type":"FeatureCollection"}'], "reserve.geojson", {
            type: "application/json",
        });

        const fileInput = container.querySelector("#park-geojson-file") as HTMLInputElement
        await user.upload(fileInput, file)

        await waitFor(() => {
            expect(notifyCritical).toHaveBeenCalledWith(
                "Failed to upload park zone file"
            )
        })

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    })
    it("navigates to /profile when confirming the layout", async () => {
        const user = userEvent.setup();
        server.use(...parkZoneHandlers);
        const { container } = render(<ParkZoneUploadPage />)

        const file = new File(['{"type":"FeatureCollection"}'], "reserve.geojson", {
            type: "application/json",
        });

        const fileInput = container.querySelector("#park-geojson-file") as HTMLInputElement
        await user.upload(fileInput, file)

        const confirmButton = await screen.findByRole("button", {name: /confirm/i})
        await user.click(confirmButton);

        expect(mockNavigate).toHaveBeenCalledWith("/profile")
    })
    it("deletes the upload and closes the modal when clicking reject", async () => {
        const user = userEvent.setup({ pointerEventsCheck: 0 });
        server.use(...parkZoneHandlers);
        const { container } = render(<ParkZoneUploadPage />)

        const file = new File(['{"type":"FeatureCollection"}'], "reserve.geojson", {
            type: "application/json",
        });

        const fileInput = container.querySelector("#park-geojson-file") as HTMLInputElement
        await user.upload(fileInput, file)

        const rejectButton = await screen.findByRole("button", {name: /reject/i})
        await user.click(rejectButton);

        await waitFor(() => {
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
        })
    })
    it("shows a critical toast notification if rejecting the upload fails", async () => {
        const user = userEvent.setup();
        server.use(...deleteErrorHandlers, ...parkZoneHandlers);
        const { container } = render(<ParkZoneUploadPage />)

        const file = new File(['{"type":"FeatureCollection"}'], "reserve.geojson", {
            type: "application/json",
        });

        const fileInput = container.querySelector("#park-geojson-file") as HTMLInputElement
        await user.upload(fileInput, file)

        const rejectButton = await screen.findByRole("button", {name: /reject/i})
        await user.click(rejectButton);

        await waitFor(() => {
            expect(notifyCritical).toHaveBeenCalledWith(
                "Failed to delete park zone file"
            );
        })

    })
})