import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import TipoffPage from "@/pages/TipoffPage";
import { useAuthStore } from "@/store/authStore";
import { notifySafe, notifyCritical } from "@/components/ui/toast";
import { tipoffsApi } from "@/services/tipoffsApi";
import { mediaApi } from "@/services/mediaApi";

const originalGeolocation = navigator.geolocation;

vi.mock("@/components/ui/toast", () => ({
    notifySafe: vi.fn(),
    notifyCritical: vi.fn(),
}));

vi.mock("@/services/tipoffsApi", () => ({
    tipoffsApi: {
        listTipoffs: vi.fn(),
        submitTipoff: vi.fn(),
        getSpecies: vi.fn(),
        getUsernames: vi.fn(),
    },
}));

vi.mock("@/services/mediaApi", () => ({
    mediaApi: {
        uploadPhoto: vi.fn(),
    },
}));

vi.mock("@/store/authStore", () => {
    const mockStore = vi.fn();
    (mockStore as unknown as { setState: ReturnType<typeof vi.fn> }).setState =
        vi.fn();
    return { useAuthStore: mockStore };
});

function setUser(role: string) {
    const mockState = {
        user: { id: "u1", username: "liaison1", role },
        accessToken: "token",
        refreshToken: "refresh",
    };

    vi.mocked(useAuthStore).mockImplementation(((selector) => {
        return selector ? selector(mockState as never) : mockState;
    }) as typeof useAuthStore);
}

function stubGeolocation(latitude: number, longitude: number) {
    Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
            getCurrentPosition: (success: PositionCallback) =>
                success({
                    coords: { latitude, longitude },
                } as GeolocationPosition),
        },
    });
}

async function applyFilter(groupName: RegExp, optionLabel: string) {
    if (!screen.queryByRole("button", { name: /^report type/i })) {
        await userEvent.click(
            screen.getByRole("button", { name: /^open filters/i }),
        );
    }
    const trigger = screen
        .getAllByRole("button", { name: groupName })
        .find((button) => button.getAttribute("aria-haspopup") === "listbox");
    await userEvent.click(trigger!);
    await userEvent.click(
        within(screen.getByRole("listbox")).getByLabelText(optionLabel),
    );
    await userEvent.click(screen.getByRole("button", { name: /^apply$/i }));
}

function mockOneTipoff(overrides: Record<string, unknown> = {}) {
    vi.mocked(tipoffsApi.listTipoffs).mockResolvedValue({
        results: [
            {
                tipoff_id: "tip-1",
                report_type: "incident",
                description: "Suspicious tracks near the fence",
                incident_type: "Suspicious Tracks",
                severity: "medium",
                occurred_at: "2026-01-01T00:00:00Z",
                location: { lat: -24.205, lon: 31.185 },
                images: [],
                submitted_by: "2f9c1f42-1e2b-4a1c-9c2f-8c7a1d3b5e60",
                submitted_by_username: "liaison1",
                created_at: "2026-01-01T00:00:00Z",
                ...overrides,
            },
        ],
        total: 1,
        page: 1,
        page_size: 20,
    });
}

async function fillAndSubmitTipoff() {
    const user = userEvent.setup();
    const activePanel = screen.getByRole("tabpanel", { name: "New Tip-off" });

    await user.type(
        within(activePanel).getByLabelText("Description"),
        "Snare seen near the north gate.",
    );

    await user.selectOptions(
        within(activePanel).getByRole("combobox", { name: "Incident Type" }),
        "Snare Found",
    );

    const occurredAt = within(activePanel).getByLabelText(
        "When did this happen?",
    );
    await user.clear(occurredAt);
    await user.type(occurredAt, "2020-01-01T08:00");

    await user.click(
        within(activePanel).getByRole("button", {
            name: "Use current location",
        }),
    );

    await user.click(
        within(activePanel).getByRole("button", { name: "Submit Tip-off" }),
    );
}

describe("TipoffPage", () => {
    beforeEach(() => {
        URL.createObjectURL = vi.fn(() => "blob:mock-url");
        URL.revokeObjectURL = vi.fn();
        vi.mocked(notifySafe).mockClear();
        vi.mocked(notifyCritical).mockClear();
        vi.mocked(tipoffsApi.listTipoffs).mockResolvedValue({
            results: [],
            total: 0,
            page: 1,
            page_size: 20,
        });
        vi.mocked(tipoffsApi.submitTipoff).mockResolvedValue({
            tipoff_id: "tip-123",
            report_type: "incident",
            status: "submitted",
            submitted_by: "u1",
            created_at: new Date().toISOString(),
        });
        vi.mocked(tipoffsApi.getSpecies).mockResolvedValue({ species: [] });
        vi.mocked(tipoffsApi.getUsernames).mockResolvedValue({
            usernames: [],
        });
        vi.mocked(mediaApi.uploadPhoto).mockResolvedValue(
            "http://minio/tipoffs/uploaded.jpg",
        );
        vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.clearAllMocks();

        Object.defineProperty(navigator, "geolocation", {
            configurable: true,
            value: originalGeolocation,
        });

        useAuthStore.setState({
            user: null,
            accessToken: null,
            refreshToken: null,
        });
    });

    it("shows only New Tip-off for a community liaison", () => {
        setUser("community_liaison");
        render(<TipoffPage />);
        expect(
            screen.getByRole("tab", { name: "New Tip-off" }),
        ).toHaveAttribute("data-state", "active");
    });

    it("shows only All Tip-offs for an analyst, with no submit controls", () => {
        setUser("analyst");
        render(<TipoffPage />);
        expect(
            screen.queryByRole("tab", { name: "New Tip-off" }),
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole("tab", { name: "All Tip-offs" }),
        ).toHaveAttribute("data-state", "active");
    });

    it("shows both tabs for an admin", () => {
        setUser("admin");
        render(<TipoffPage />);
        expect(
            screen.getByRole("tab", { name: "New Tip-off" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("tab", { name: "All Tip-offs" }),
        ).toBeInTheDocument();
    });

    it("shows only All Tip-offs for a ranger, with no submit controls", () => {
        setUser("ranger");
        render(<TipoffPage />);
        expect(
            screen.queryByRole("tab", { name: "New Tip-off" }),
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole("tab", { name: "All Tip-offs" }),
        ).toHaveAttribute("data-state", "active");
        expect(
            screen.queryByText(
                "Your account does not have access to tip-offs.",
            ),
        ).not.toBeInTheDocument();
    });

    it("fetches and renders tip-offs for an admin", async () => {
        const user = userEvent.setup();
        vi.mocked(tipoffsApi.listTipoffs).mockResolvedValueOnce({
            results: [
                {
                    tipoff_id: "tip-1",
                    report_type: "incident",
                    description: "Suspicious tracks near the fence",
                    incident_type: "Suspicious Tracks",
                    severity: "medium",
                    occurred_at: "2026-01-01T00:00:00Z",
                    location: { lat: -24.205, lon: 31.185 },
                    images: [],
                    submitted_by: "liaison1",
                    created_at: "2026-01-01T00:00:00Z",
                },
            ],
            total: 1,
            page: 1,
            page_size: 20,
        });

        setUser("admin");
        render(<TipoffPage />);
        await user.click(screen.getByRole("tab", { name: "All Tip-offs" }));
        expect(
            await screen.findByText("Suspicious tracks near the fence"),
        ).toBeInTheDocument();
    });

    it("submits a tip-off and reports it as sent", async () => {
        stubGeolocation(-24.205, 31.185);
        setUser("community_liaison");
        render(<TipoffPage />);

        await fillAndSubmitTipoff();

        await waitFor(() =>
            expect(tipoffsApi.submitTipoff).toHaveBeenCalledWith(
                expect.objectContaining({
                    report_type: "incident",
                    description: "Snare seen near the north gate.",
                    incident_type: "Snare Found",
                    location: { lat: -24.205, lon: 31.185 },
                    images: [],
                }),
            ),
        );
        expect(notifySafe).toHaveBeenCalledWith(
            "Tip-off submitted",
            "Thank you, rangers have been notified.",
        );
    });

    it("adds the submitted tip-off to the list for an admin", async () => {
        const user = userEvent.setup();
        stubGeolocation(-24.205, 31.185);
        setUser("admin");
        render(<TipoffPage />);

        await fillAndSubmitTipoff();
        await waitFor(() => expect(notifySafe).toHaveBeenCalled());

        await user.click(screen.getByRole("tab", { name: "All Tip-offs" }));
        expect(
            await screen.findByText("Snare seen near the north gate."),
        ).toBeInTheDocument();
    });

    it("shows a toast when submitting a tip-off fails", async () => {
        vi.mocked(tipoffsApi.submitTipoff).mockRejectedValueOnce(
            new Error("Network error"),
        );
        stubGeolocation(-24.205, 31.185);
        setUser("community_liaison");
        render(<TipoffPage />);

        await fillAndSubmitTipoff();

        await waitFor(() =>
            expect(notifyCritical).toHaveBeenCalledWith(
                "Submission failed",
                "Could not send tip-off to the server",
            ),
        );
        expect(notifySafe).not.toHaveBeenCalled();
    });

    it("re-enables the submit button after a failed submission", async () => {
        vi.mocked(tipoffsApi.submitTipoff).mockRejectedValueOnce(
            new Error("Network error"),
        );
        stubGeolocation(-24.205, 31.185);
        setUser("community_liaison");
        render(<TipoffPage />);

        await fillAndSubmitTipoff();

        await waitFor(() =>
            expect(
                screen.getByRole("button", { name: "Submit Tip-off" }),
            ).toBeEnabled(),
        );
    });

    it("shows a toast if fetching tip-offs fails", async () => {
        vi.mocked(tipoffsApi.listTipoffs).mockRejectedValueOnce(
            new Error("Network error"),
        );
        setUser("admin");
        render(<TipoffPage />);
        await waitFor(() => {
            expect(notifyCritical).toHaveBeenCalledWith(
                "Error",
                "Failed to fetch tip-offs",
            );
        });
    });

    it("shows the submitter username instead of the user id", async () => {
        mockOneTipoff();
        setUser("analyst");
        render(<TipoffPage />);

        expect(await screen.findByText("liaison1")).toBeInTheDocument();
        expect(
            screen.queryByText("2f9c1f42-1e2b-4a1c-9c2f-8c7a1d3b5e60"),
        ).not.toBeInTheDocument();
    });

    it("re-queries the backend as the search term changes", async () => {
        mockOneTipoff();
        setUser("analyst");
        render(<TipoffPage />);
        await screen.findByText("Suspicious tracks near the fence");

        await userEvent.type(
            screen.getByPlaceholderText("Search tip-offs..."),
            "snare",
        );

        await waitFor(() =>
            expect(tipoffsApi.listTipoffs).toHaveBeenLastCalledWith(
                expect.objectContaining({ search: "snare" }),
            ),
        );
    });

    it("re-queries the backend for each filter group", async () => {
        vi.mocked(tipoffsApi.getSpecies).mockResolvedValue({
            species: ["Rhino"],
        });
        vi.mocked(tipoffsApi.getUsernames).mockResolvedValue({
            usernames: ["liaison1"],
        });
        mockOneTipoff();
        setUser("analyst");
        render(<TipoffPage />);
        await screen.findByText("Suspicious tracks near the fence");

        await applyFilter(/^report type/i, "Incident");
        await waitFor(() =>
            expect(tipoffsApi.listTipoffs).toHaveBeenLastCalledWith(
                expect.objectContaining({ report_type: ["incident"] }),
            ),
        );

        await applyFilter(/^severity/i, "High");
        await waitFor(() =>
            expect(tipoffsApi.listTipoffs).toHaveBeenLastCalledWith(
                expect.objectContaining({ severity: ["high"] }),
            ),
        );

        await applyFilter(/^species/i, "Rhino");
        await waitFor(() =>
            expect(tipoffsApi.listTipoffs).toHaveBeenLastCalledWith(
                expect.objectContaining({ species: ["Rhino"] }),
            ),
        );

        await applyFilter(/^submitted by/i, "liaison1");
        await waitFor(() =>
            expect(tipoffsApi.listTipoffs).toHaveBeenLastCalledWith(
                expect.objectContaining({ users: ["liaison1"] }),
            ),
        );
    });
});
