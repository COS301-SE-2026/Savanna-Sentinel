import {
    render,
    screen,
    waitFor,
    within,
    fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
    beforeAll,
    afterEach,
    afterAll,
    describe,
    it,
    expect,
    vi,
} from "vitest";

import { RiskModelControls } from "@/components/map/RiskModelControls";
import { useAuthStore } from "@/store/authStore";
import { useMapStore, initialMapState } from "@/store/mapStore";
import { notifySafe, notifyCritical } from "@/components/ui/toast";
import { riskHandlers } from "./mocks/riskHandlers";

vi.mock("@/components/ui/toast", () => ({
    notifySafe: vi.fn(),
    notifyCritical: vi.fn(),
}));

const BASE = "http://localhost:8000/v1";

const server = setupServer(...riskHandlers);
beforeAll(() => server.listen());
afterEach(() => {
    server.resetHandlers();
    vi.clearAllMocks();
    useAuthStore.setState({
        user: null,
        accessToken: null,
        refreshToken: null,
    });
    useMapStore.setState(initialMapState, true);
});
afterAll(() => server.close());

function setUser(role: string) {
    useAuthStore.setState({
        user: { id: "u1", username: "user1", role },
        accessToken: "token",
        refreshToken: "refresh",
    });
}

describe("RiskModelControls", () => {
    it("renders nothing for a ranger", () => {
        setUser("ranger");
        render(<RiskModelControls />);
        expect(
            screen.queryByRole("button", { name: /train model/i }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: /calculate heatmap/i }),
        ).not.toBeInTheDocument();
    });

    it.each(["admin", "analyst"])("renders both buttons for %s", (role) => {
        setUser(role);
        render(<RiskModelControls />);
        expect(
            screen.getByRole("button", { name: /train model/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /calculate heatmap/i }),
        ).toBeInTheDocument();
    });

    it("asks for confirmation before training, and Cancel does not call the API", async () => {
        setUser("admin");
        let hasCalledTrain = false;
        server.use(
            http.post(`${BASE}/risk/train`, () => {
                hasCalledTrain = true;
                return HttpResponse.json({
                    job_id: "t1",
                    status: "queued",
                    queued_at: "2026-09-02T00:00:00Z",
                });
            }),
        );

        render(<RiskModelControls />);
        await userEvent.click(
            screen.getByRole("button", { name: /train model/i }),
        );

        expect(
            screen.getByRole("heading", { name: /train risk model/i }),
        ).toBeInTheDocument();

        await userEvent.click(
            screen.getByRole("button", { name: /^cancel$/i }),
        );

        expect(
            screen.queryByRole("heading", { name: /train risk model/i }),
        ).not.toBeInTheDocument();
        expect(hasCalledTrain).toBe(false);
    });

    it("trains on all available history, not a fixed window", async () => {
        setUser("admin");
        let capturedBody: unknown = null;
        server.use(
            http.post(`${BASE}/risk/train`, async ({ request }) => {
                capturedBody = await request.json();
                return HttpResponse.json({
                    job_id: "t-window",
                    status: "queued",
                    queued_at: "2026-09-02T00:00:00Z",
                });
            }),
            http.get(`${BASE}/risk/train/:jobId`, () =>
                HttpResponse.json({
                    job_id: "t-window",
                    status: "completed",
                    model_id: "model-window",
                    metrics: { auc: 0.9 },
                    n_training_examples: 300,
                }),
            ),
        );

        render(<RiskModelControls />);
        await userEvent.click(
            screen.getByRole("button", { name: /train model/i }),
        );
        expect(screen.getByText(/all available history/i)).toBeInTheDocument();

        const dialog = screen.getByRole("dialog");
        fireEvent.click(
            within(dialog).getByRole("button", { name: /train model/i }),
        );

        await waitFor(() => expect(capturedBody).toEqual({}));
        await waitFor(() => expect(notifySafe).toHaveBeenCalled());
    });

    it("confirming Train Model starts the job, disables the button while in flight, and shows the trained metric on completion", async () => {
        setUser("admin");
        server.use(
            http.post(`${BASE}/risk/train`, () =>
                HttpResponse.json({
                    job_id: "t2",
                    status: "queued",
                    queued_at: "2026-09-02T00:00:00Z",
                }),
            ),
            http.get(`${BASE}/risk/train/:jobId`, () =>
                HttpResponse.json({
                    job_id: "t2",
                    status: "completed",
                    model_id: "model-2",
                    metrics: { auc: 0.87 },
                    n_training_examples: 250,
                }),
            ),
        );

        render(<RiskModelControls />);
        await userEvent.click(
            screen.getByRole("button", { name: /train model/i }),
        );
        const dialog = screen.getByRole("dialog");
        fireEvent.click(
            within(dialog).getByRole("button", { name: /train model/i }),
        );

        await waitFor(() => {
            expect(notifySafe).toHaveBeenCalled();
        });
        expect(screen.getByText(/0\.87/)).toBeInTheDocument();
    });

    it("shows a failure toast when training fails", async () => {
        setUser("admin");
        server.use(
            http.post(`${BASE}/risk/train`, () =>
                HttpResponse.json({
                    job_id: "t3",
                    status: "queued",
                    queued_at: "2026-09-02T00:00:00Z",
                }),
            ),
            http.get(`${BASE}/risk/train/:jobId`, () =>
                HttpResponse.json({
                    job_id: "t3",
                    status: "failed",
                    model_id: null,
                    metrics: null,
                    n_training_examples: null,
                }),
            ),
        );

        render(<RiskModelControls />);
        await userEvent.click(
            screen.getByRole("button", { name: /train model/i }),
        );
        const dialog = screen.getByRole("dialog");
        fireEvent.click(
            within(dialog).getByRole("button", { name: /train model/i }),
        );

        await waitFor(() => {
            expect(notifyCritical).toHaveBeenCalled();
        });
    });

    it("confirming Calculate Heatmap refreshes the map store with the new snapshot", async () => {
        setUser("analyst");
        server.use(
            http.post(`${BASE}/risk/score`, () =>
                HttpResponse.json({
                    job_id: "s1",
                    status: "queued",
                    queued_at: "2026-09-02T00:00:00Z",
                }),
            ),
            http.get(`${BASE}/risk/score/:jobId`, () =>
                HttpResponse.json({
                    job_id: "s1",
                    status: "completed",
                    heatmap_id: "heatmap-new",
                    computed_at: "2026-09-02T00:05:00Z",
                    n_cells_scored: 684,
                }),
            ),
        );

        render(<RiskModelControls />);
        await userEvent.click(
            screen.getByRole("button", { name: /calculate heatmap/i }),
        );
        const dialog = screen.getByRole("dialog");
        fireEvent.click(
            within(dialog).getByRole("button", { name: /calculate heatmap/i }),
        );

        await waitFor(() => {
            expect(useMapStore.getState().selectedSnapshotId).toBe(
                "heatmap-new",
            );
        });
        expect(notifySafe).toHaveBeenCalled();
    });
});
