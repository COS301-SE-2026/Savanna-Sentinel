import { setupServer } from "msw/node"
import { describe, beforeAll, afterAll, afterEach, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import ParkZoneUploadPage from "@/pages/ParkZoneUploadPage"
import {
    parkZoneHandlers,
} from "./mocks/parkZoneHandlers"

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
        onMapReady?.({ fitBounds: vi.fn() });
        return <div data-testid="map-view">Mocked Map View</div>
    }
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
})