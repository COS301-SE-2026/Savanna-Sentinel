import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import TipoffPage from "@/pages/TipoffPage";
import { useAuthStore } from "@/store/authStore";
import { notifySafe, notifyCritical } from "@/components/ui/toast";
import { tipoffsApi } from "@/services/tipoffsApi";
import { mediaApi } from "@/services/mediaApi";

vi.mock("@/components/ui/toast", () => ({
    notifySafe: vi.fn(),
    notifyCritical: vi.fn(),
}));

vi.mock("@/services/tipoffsApi", () => ({
    tipoffsApi: {
        listTipoffs: vi.fn(),
        submitTipoff: vi.fn(),
    },
}));

vi.mock("@/services/mediaApi", () => ({
    mediaApi: {
        uploadPhoto: vi.fn(),
    },
}));

function setUser(role: string) {
    useAuthStore.setState({
        user: { id: "u1", username: "liaison1", role },
        accessToken: "token",
        refreshToken: "refresh",
    });
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

async function fillAndSubmitTipoff() {
    await userEvent.type(
        screen.getByLabelText("Description"),
        "Snare seen near the north gate.",
    );
    await userEvent.selectOptions(
        screen.getByRole("combobox", { name: "Incident Type" }),
        "Snare Found",
    );
    const occurredAt = screen.getByLabelText("When did this happen?");
    await userEvent.clear(occurredAt);
    await userEvent.type(occurredAt, "2020-01-01T08:00");
    await userEvent.click(
        screen.getByRole("button", { name: "Use current location" }),
    );
    await userEvent.click(
        screen.getByRole("button", { name: "Submit Tip-off" }),
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
        vi.mocked(mediaApi.uploadPhoto).mockResolvedValue(
            "http://minio/tipoffs/uploaded.jpg",
        );
        vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.clearAllMocks();
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
        expect(
            screen.queryByRole("tab", { name: "All Tip-offs" }),
        ).not.toBeInTheDocument();
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
        await userEvent.click(
            screen.getByRole("tab", { name: "All Tip-offs" }),
        );
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
        stubGeolocation(-24.205, 31.185);
        setUser("admin");
        render(<TipoffPage />);

        await fillAndSubmitTipoff();
        await waitFor(() => expect(notifySafe).toHaveBeenCalled());

        await userEvent.click(
            screen.getByRole("tab", { name: "All Tip-offs" }),
        );
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
});
