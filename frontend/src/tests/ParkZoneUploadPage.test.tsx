import { setupServer } from "msw/node";
import {
    describe,
    beforeAll,
    afterAll,
    afterEach,
    it,
    expect,
    vi,
    beforeEach,
} from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import ParkZoneUploadPage from "@/pages/ParkZoneUploadPage";
import {
    deleteErrorHandlers,
    parkZoneHandlers,
    uploadError401Handlers,
    uploadError403Handlers,
    uploadError422Handlers,
    uploadErrorHandlers,
} from "./mocks/parkZoneHandlers";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { notifyCritical, notifySafe } from "@/components/ui/toast";
import { useAuthStore } from "@/store/authStore";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual("react-router-dom");
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

beforeEach(() => {
    useAuthStore.setState({
        user: {
            id: "test-admin-id",
            username: "admin",
            role: "admin",
        },
        accessToken: "mock-token",
        isUploaded: false,
    });
});

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
    notifyCritical: vi.fn(),
    notifySafe: vi.fn(),
}));

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => {
    server.resetHandlers();
    vi.clearAllMocks();
});
afterAll(() => server.close());

describe("ParkZoneUploadPage", () => {
    it("renders the file upload dropzone initially", () => {
        server.use(...parkZoneHandlers);
        render(<ParkZoneUploadPage />);

        expect(screen.getByText(/Upload wgs84/i)).toBeInTheDocument();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    it("uploads a geojson file and opens the map confirmation dialog", async () => {
        const user = userEvent.setup();
        server.use(...parkZoneHandlers);
        const { container } = render(<ParkZoneUploadPage />);

        const file = new File(
            ['{"type":"FeatureCollection"}'],
            "reserve.geojson",
            {
                type: "application/json",
            },
        );

        const fileInput = container.querySelector(
            "#park-geojson-file",
        ) as HTMLInputElement;
        await user.upload(fileInput, file);

        expect(await screen.findByRole("dialog")).toBeInTheDocument();
        expect(
            screen.getByRole("heading", { name: /confirm map layout/i }),
        ).toBeInTheDocument();
        expect(screen.getByTestId("map-view")).toBeInTheDocument();
    });
    it("shows a critical toast notification when file upload fails", async () => {
        const user = userEvent.setup();
        server.use(...uploadErrorHandlers);
        const { container } = render(<ParkZoneUploadPage />);

        const file = new File(
            ['{"type":"FeatureCollection"}'],
            "reserve.geojson",
            {
                type: "application/json",
            },
        );

        const fileInput = container.querySelector(
            "#park-geojson-file",
        ) as HTMLInputElement;
        await user.upload(fileInput, file);

        await waitFor(() => {
            expect(notifyCritical).toHaveBeenCalledWith(
                "An unexpected server error occurred. Please try again or contact the developers.",
            );
        });

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    it("shows a critical toast notification when file upload fails with 401 unauthorized", async () => {
        const user = userEvent.setup();
        server.use(...uploadError401Handlers);
        const { container } = render(<ParkZoneUploadPage />);

        const file = new File(
            ['{"type":"FeatureCollection"}'],
            "reserve.geojson",
            { type: "application/json" },
        );

        const fileInput = container.querySelector(
            "#park-geojson-file",
        ) as HTMLInputElement;
        await user.upload(fileInput, file);

        await waitFor(() => {
            expect(notifyCritical).toHaveBeenCalledWith(
                "Your session has expired. Please log in again.",
            );
        });

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    it("shows a critical toast notification when file upload fails with 403 forbidden", async () => {
        const user = userEvent.setup();
        server.use(...uploadError403Handlers);
        const { container } = render(<ParkZoneUploadPage />);

        const file = new File(
            ['{"type":"FeatureCollection"}'],
            "reserve.geojson",
            { type: "application/json" },
        );

        const fileInput = container.querySelector(
            "#park-geojson-file",
        ) as HTMLInputElement;
        await user.upload(fileInput, file);

        await waitFor(() => {
            expect(notifyCritical).toHaveBeenCalledWith(
                "You do not have permission to upload park zones.",
            );
        });

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    it("shows a critical toast notification when file upload fails with 422 unprocessable entity", async () => {
        const user = userEvent.setup();
        server.use(...uploadError422Handlers);
        const { container } = render(<ParkZoneUploadPage />);

        const file = new File(
            ['{"type":"FeatureCollection"}'],
            "reserve.geojson",
            { type: "application/json" },
        );

        const fileInput = container.querySelector(
            "#park-geojson-file",
        ) as HTMLInputElement;
        await user.upload(fileInput, file);

        await waitFor(() => {
            expect(notifyCritical).toHaveBeenCalledWith(
                "Boundary coordinates must follow standard WGS 84 latitude/longitude formats.",
            );
        });

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    it("switches to the existing grid when the upload finds one already saved", async () => {
        const user = userEvent.setup();
        server.use(
            http.post(
                "**/v1/risk/upload*",
                () => new HttpResponse(null, { status: 409 }),
            ),
        );
        const { container } = render(<ParkZoneUploadPage />);

        const file = new File(
            ['{"type":"FeatureCollection"}'],
            "reserve.geojson",
            { type: "application/json" },
        );

        const fileInput = container.querySelector(
            "#park-geojson-file",
        ) as HTMLInputElement;
        await user.upload(fileInput, file);

        await waitFor(() => {
            expect(notifyCritical).toHaveBeenCalledWith(
                "A park grid already exists. Delete it before uploading a new one.",
            );
        });
        expect(useAuthStore.getState().isUploaded).toBe(true);
        expect(
            screen.getByRole("button", { name: "Delete grid" }),
        ).toBeInTheDocument();
    });
    it("deletes the upload and closes the modal when clicking reject", async () => {
        const user = userEvent.setup({ pointerEventsCheck: 0 });
        server.use(...parkZoneHandlers);
        const { container } = render(<ParkZoneUploadPage />);

        const file = new File(
            ['{"type":"FeatureCollection"}'],
            "reserve.geojson",
            {
                type: "application/json",
            },
        );

        const fileInput = container.querySelector(
            "#park-geojson-file",
        ) as HTMLInputElement;
        await user.upload(fileInput, file);

        const rejectButton = await screen.findByRole("button", {
            name: /reject/i,
        });
        await user.click(rejectButton);

        await waitFor(() => {
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        });
    });
    it("deletes the upload when the preview is dismissed with Escape", async () => {
        const user = userEvent.setup({ pointerEventsCheck: 0 });
        const onDelete = vi.fn();
        server.use(
            http.delete("**/v1/risk/geojson*", () => {
                onDelete();
                return HttpResponse.json({ success: true });
            }),
            ...parkZoneHandlers,
        );
        const { container } = render(<ParkZoneUploadPage />);

        const file = new File(
            ['{"type":"FeatureCollection"}'],
            "reserve.geojson",
            {
                type: "application/json",
            },
        );

        const fileInput = container.querySelector(
            "#park-geojson-file",
        ) as HTMLInputElement;
        await user.upload(fileInput, file);
        await screen.findByRole("button", { name: /reject/i });

        await user.keyboard("{Escape}");

        await waitFor(() => {
            expect(onDelete).toHaveBeenCalledTimes(1);
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        });
    });
    it("shows a critical toast notification if rejecting the upload fails", async () => {
        const user = userEvent.setup();
        server.use(...deleteErrorHandlers, ...parkZoneHandlers);
        const { container } = render(<ParkZoneUploadPage />);

        const file = new File(
            ['{"type":"FeatureCollection"}'],
            "reserve.geojson",
            {
                type: "application/json",
            },
        );

        const fileInput = container.querySelector(
            "#park-geojson-file",
        ) as HTMLInputElement;
        await user.upload(fileInput, file);

        const rejectButton = await screen.findByRole("button", {
            name: /reject/i,
        });
        await user.click(rejectButton);

        await waitFor(() => {
            expect(notifyCritical).toHaveBeenCalledWith(
                "Failed to delete park zone file",
            );
        });
    });

    describe("when a park grid already exists", () => {
        beforeEach(() => {
            useAuthStore.setState({ isUploaded: true });
        });

        async function deleteGridThroughDialog() {
            const user = userEvent.setup();
            await user.click(
                await screen.findByRole("button", { name: /^delete grid$/i }),
            );
            await user.type(
                screen.getByRole("textbox", {
                    name: /type confirm deletion to continue/i,
                }),
                "Confirm Deletion",
            );
            const dialog = screen.getByRole("dialog");
            await user.click(
                within(dialog).getByRole("button", { name: /^delete grid$/i }),
            );
        }

        it("shows the current grid on a map with a delete button, not the dropzone", async () => {
            server.use(...parkZoneHandlers);
            render(<ParkZoneUploadPage />);

            expect(await screen.findByTestId("map-view")).toBeInTheDocument();
            expect(
                screen.getByRole("button", { name: /^delete grid$/i }),
            ).toBeInTheDocument();
            expect(screen.queryByText(/upload wgs84/i)).not.toBeInTheDocument();
        });

        it("deletes the grid and returns to the upload form", async () => {
            let hasDeleted = false;
            server.use(
                http.delete("**/v1/risk/geojson*", () => {
                    hasDeleted = true;
                    return HttpResponse.json({ success: true });
                }),
                ...parkZoneHandlers,
            );
            render(<ParkZoneUploadPage />);

            await deleteGridThroughDialog();

            expect(
                await screen.findByText(/upload wgs84/i),
            ).toBeInTheDocument();
            expect(hasDeleted).toBe(true);
            expect(useAuthStore.getState().isUploaded).toBe(false);
            expect(notifySafe).toHaveBeenCalledWith("Park grid deleted");
        });

        it("keeps the grid view and reports an error when the delete fails", async () => {
            server.use(
                http.delete(
                    "**/v1/risk/geojson*",
                    () => new HttpResponse(null, { status: 500 }),
                ),
                ...parkZoneHandlers,
            );
            render(<ParkZoneUploadPage />);

            await deleteGridThroughDialog();

            await waitFor(() => {
                expect(notifyCritical).toHaveBeenCalledWith(
                    "Could not delete the park grid",
                );
            });
            expect(useAuthStore.getState().isUploaded).toBe(true);
            expect(screen.queryByText(/upload wgs84/i)).not.toBeInTheDocument();
        });
    });
});
