import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReportsPage from "@/pages/ReportsPage";
import { useAuthStore } from "@/store/authStore";
import { notifySafe } from "@/components/ui/toast";
import { reportsApi } from "@/services/reportsApi";
import { mediaApi } from "@/services/mediaApi";

vi.mock("@/components/ui/toast", () => ({
    notifySafe: vi.fn(),
}));

vi.mock("@/services/reportsApi", () => ({
    reportsApi: {
        listReports: vi.fn(),
        submitReport: vi.fn(),
        updateReport: vi.fn(),
        deleteReport: vi.fn(),
        getSpecies: vi.fn(),
        getUsernames: vi.fn().mockResolvedValue({ usernames: ["admin1"] }),
    },
}));

vi.mock("@/services/mediaApi", () => ({
    mediaApi: {
        uploadPhoto: vi.fn(),
    },
}));

function setUser(role: string) {
    useAuthStore.setState({
        user: { id: "u1", username: "ranger1", role },
        accessToken: "token",
        refreshToken: "refresh",
    });
}

async function submitMinimalIncidentReport(description: string) {
    await userEvent.type(screen.getByLabelText("Description"), description);
    await userEvent.selectOptions(
        screen.getByRole("combobox", { name: "Incident Type" }),
        "Snare Found",
    );
    await userEvent.type(screen.getByLabelText("Latitude"), "-25.1");
    await userEvent.type(screen.getByLabelText("Longitude"), "28.1");
    const occurredAt = screen.getByLabelText("When did this happen?");
    await userEvent.clear(occurredAt);
    await userEvent.type(occurredAt, "2020-01-01T08:00");
    await userEvent.click(
        screen.getByRole("button", { name: "Submit Report" }),
    );
}

describe("ReportsPage", () => {
    beforeEach(() => {
        URL.createObjectURL = vi.fn(() => "blob:mock-url");
        URL.revokeObjectURL = vi.fn();
        vi.mocked(notifySafe).mockClear();
        vi.mocked(reportsApi.getSpecies).mockResolvedValue({ species: [] });
        vi.mocked(reportsApi.listReports).mockResolvedValue({
            results: [],
            total: 0,
            page: 1,
            page_size: 10,
        });
        vi.mocked(reportsApi.submitReport).mockResolvedValue({
            report_id: "rep-123",
            submitted_by: "u1",
            created_at: new Date().toISOString(),
        } as Awaited<ReturnType<typeof reportsApi.submitReport>>);
        vi.mocked(reportsApi.updateReport).mockResolvedValue(
            {} as Awaited<ReturnType<typeof reportsApi.updateReport>>,
        );
        vi.mocked(reportsApi.deleteReport).mockResolvedValue(
            {} as unknown as Awaited<
                ReturnType<typeof reportsApi.deleteReport>
            >,
        );
        vi.mocked(mediaApi.uploadPhoto).mockResolvedValue(
            "http://minio/reports/uploaded.jpg",
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

    it("fetches and renders reports on load", async () => {
        vi.mocked(reportsApi.listReports).mockResolvedValueOnce({
            results: [
                {
                    report_id: "rep-1",
                    submitted_by: "ranger1",
                    report_type: "incident",
                    description: "Initial poached snare",
                    incident_type: "Snare Found",
                    severity: "high",
                    occurred_at: "2026-01-01T00:00:00Z",
                    location: { lat: -25.1, lon: 28.1 },
                    images: [],
                    created_at: "2026-01-01T00:00:00Z",
                } as unknown as Awaited<
                    ReturnType<typeof reportsApi.listReports>
                >["results"][number],
            ],
            total: 1,
            page: 1,
            page_size: 10,
        });

        setUser("ranger");
        render(<ReportsPage />);
        await userEvent.click(screen.getByRole("tab", { name: "All Reports" }));
        expect(
            await screen.findByText("Initial poached snare"),
        ).toBeInTheDocument();
    });

    it("shows a toast notification if fetching reports fail", async () => {
        vi.mocked(reportsApi.listReports).mockRejectedValueOnce(
            new Error("Network error"),
        );
        setUser("ranger");
        render(<ReportsPage />);
        await waitFor(() => {
            expect(notifySafe).toHaveBeenCalledWith(
                "Error",
                "Failed to fetch reports",
            );
        });
    });

    it("shows both tabs for a ranger, defaulting to New Report", async () => {
        setUser("ranger");
        render(<ReportsPage />);
        expect(screen.getByRole("tab", { name: "New Report" })).toHaveAttribute(
            "data-state",
            "active",
        );
        expect(
            screen.getByRole("tab", { name: "All Reports" }),
        ).toBeInTheDocument();
    });

    it("shows only All Reports for an analyst, with no submit controls", async () => {
        setUser("analyst");
        render(<ReportsPage />);
        expect(
            screen.queryByRole("tab", { name: "New Report" }),
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole("tab", { name: "All Reports" }),
        ).toHaveAttribute("data-state", "active");
    });

    it("shows a submitted draft in All Reports with a Pending Sync badge", async () => {
        setUser("ranger");
        render(<ReportsPage />);
        await submitMinimalIncidentReport("Snare found near the river");
        await userEvent.click(screen.getByRole("tab", { name: "All Reports" }));
        expect(
            screen.getByText("Snare found near the river"),
        ).toBeInTheDocument();
        expect(screen.getByText("Pending Sync")).toBeInTheDocument();
    });

    it("switches to New Report when the empty state action is clicked", async () => {
        setUser("ranger");
        render(<ReportsPage />);
        await userEvent.click(screen.getByRole("tab", { name: "All Reports" }));
        await userEvent.click(
            screen.getByRole("button", { name: "Submit First Report" }),
        );
        expect(screen.getByRole("tab", { name: "New Report" })).toHaveAttribute(
            "data-state",
            "active",
        );
    });

    it("shows a toast on submission failure, handles submission failure", async () => {
        vi.mocked(reportsApi.submitReport).mockRejectedValueOnce(
            new Error("Validation error"),
        );
        setUser("ranger");
        render(<ReportsPage />);
        await submitMinimalIncidentReport("Snare found near the river");
        expect(notifySafe).toHaveBeenCalledWith(
            "Submission failed",
            "Could not send report to the server",
        );
    });

    it("uploads attached photos through mediaApi and includes the returned url in the submitted report", async () => {
        setUser("ranger");
        const { container } = render(<ReportsPage />);
        const fileInput = container.querySelector(
            "input[type='file']",
        ) as HTMLInputElement;
        const photo = new File(["x"], "snare.jpg", { type: "image/jpeg" });
        await userEvent.upload(fileInput, photo);

        await submitMinimalIncidentReport("Snare found near the river");

        expect(mediaApi.uploadPhoto).toHaveBeenCalledWith(photo);
        expect(reportsApi.submitReport).toHaveBeenCalledWith(
            expect.objectContaining({
                images: ["http://minio/reports/uploaded.jpg"],
            }),
        );
    });

    it("shows a toast and scrolls to top when a report is submitted", async () => {
        setUser("ranger");
        render(<ReportsPage />);
        await submitMinimalIncidentReport("Snare found near the river");
        expect(notifySafe).toHaveBeenCalledWith(
            "Report submitted",
            expect.any(String),
        );
        expect(window.scrollTo).toHaveBeenCalledWith({
            top: 0,
            behavior: "smooth",
        });
    });

    it("shows a toast and scrolls to top when a draft is saved", async () => {
        setUser("ranger");
        render(<ReportsPage />);
        await submitMinimalIncidentReport("Snare found near the river");
        vi.mocked(notifySafe).mockClear();
        vi.mocked(window.scrollTo).mockClear();

        await userEvent.click(screen.getByRole("button", { name: "1" }));
        await userEvent.click(
            screen.getByRole("button", { name: "Save Draft" }),
        );
        expect(reportsApi.updateReport).toHaveBeenCalled();
        expect(notifySafe).toHaveBeenCalledWith(
            "Draft saved",
            "Your report has been updated.",
        );
        expect(window.scrollTo).toHaveBeenCalledWith({
            top: 0,
            behavior: "smooth",
        });
    });

    it("shows a toast when a report is deleted", async () => {
        setUser("ranger");
        render(<ReportsPage />);
        await submitMinimalIncidentReport("Snare found near the river");
        vi.mocked(notifySafe).mockClear();

        await userEvent.click(screen.getByRole("button", { name: "1" }));
        await userEvent.click(
            screen.getByRole("button", { name: "Delete Draft" }),
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Delete Report" }),
        );
        expect(reportsApi.deleteReport).toHaveBeenCalled();
        expect(notifySafe).toHaveBeenCalledWith("Report deleted");
    });
});
