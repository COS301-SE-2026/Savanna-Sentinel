import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auditApi, type AuditLogResponse } from "@/services/auditApi";
import AuditLog from "@/components/admin/AuditLog";
import { Toaster } from "@/components/ui/sonner";

vi.mock("@/services/auditApi", () => ({
    auditApi: {
        getLogs: vi.fn(),
        exportCsv: vi.fn(),
    },
}));

const createMockResponse = (
    page = 1,
    total = 45,
    pageSize = 20,
): AuditLogResponse => ({
    total,
    page,
    page_size: pageSize,
    results: Array.from(
        {
            length: Math.min(
                pageSize,
                Math.max(0, total - (page - 1) * pageSize),
            ),
        },
        (_, i) => {
            const idNum = (page - 1) * pageSize + i + 1;
            return {
                id: `log-${idNum}`,
                actor_id: `actor-${idNum}`,
                actor_username: `actor_user_${idNum}`,
                action: `ACTION_${idNum}`,
                target_type: "user",
                target_id: `target-${idNum}`,
                target_username: `target_user_${idNum}`,
                details: idNum === 1 ? { new_role: "ranger" } : null,
                created_at: "2026-07-27T10:00:00Z",
            };
        },
    ),
});

describe("AuditLog Component Testing", () => {
    const mockedGetLogs = vi.mocked(auditApi.getLogs);
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("gets initial logs on mount", async () => {
        mockedGetLogs.mockResolvedValueOnce(createMockResponse(1, 40, 20));
        render(<AuditLog />);
        expect(auditApi.getLogs).toHaveBeenCalledWith({
            page: 1,
            page_size: 20,
        });
        expect(await screen.findByText("ACTION_1")).toBeInTheDocument();
        expect(screen.getByText("actor_user_1")).toBeInTheDocument();
        expect(screen.getByText("Role changed to ranger")).toBeInTheDocument();
    });

    it("shows the resolved actor username instead of the raw ID when present", async () => {
        mockedGetLogs.mockResolvedValueOnce({
            total: 1,
            page: 1,
            page_size: 20,
            results: [
                {
                    id: "log-1",
                    actor_id: "actor-1",
                    actor_username: "jane_admin",
                    action: "ACTION_1",
                    target_type: "user",
                    target_id: "target-1",
                    target_username: "john_ranger",
                    details: null,
                    created_at: "2026-07-27T10:00:00Z",
                },
            ],
        });
        render(<AuditLog />);

        expect(await screen.findByText("jane_admin")).toBeInTheDocument();
        expect(screen.getByText("john_ranger")).toBeInTheDocument();
        expect(screen.queryByText("actor-1")).not.toBeInTheDocument();
    });

    it("renders 'No details' fallback", async () => {
        mockedGetLogs.mockResolvedValueOnce(createMockResponse(1, 2, 20));
        render(<AuditLog />);
        expect(await screen.findByText("No details")).toBeInTheDocument();
    });

    it("calls api when page changes", async () => {
        const user = userEvent.setup();
        mockedGetLogs.mockResolvedValueOnce(createMockResponse(1, 45, 20));
        mockedGetLogs.mockResolvedValueOnce(createMockResponse(2, 45, 20));
        render(<AuditLog />);

        const nextButton = screen.getByRole("button", { name: /next|2/i });
        await user.click(nextButton);

        await waitFor(() => {
            expect(auditApi.getLogs).toHaveBeenCalledWith({
                page: 2,
                page_size: 20,
            });
        });
        expect(await screen.findByText("ACTION_21")).toBeInTheDocument();
    });

    it("downloads a CSV file when Export CSV is clicked", async () => {
        mockedGetLogs.mockResolvedValueOnce(createMockResponse(1, 1, 20));
        const mockedExport = vi.mocked(auditApi.exportCsv);
        mockedExport.mockResolvedValueOnce(
            new Blob(["id,action"], { type: "text/csv" }),
        );

        const createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
        const revokeObjectURL = vi.fn();
        URL.createObjectURL = createObjectURL;
        URL.revokeObjectURL = revokeObjectURL;
        const clickSpy = vi
            .spyOn(HTMLAnchorElement.prototype, "click")
            .mockImplementation(() => {});

        const user = userEvent.setup();
        render(<AuditLog />);
        await screen.findByText("ACTION_1");

        await user.click(screen.getByRole("button", { name: /export csv/i }));

        expect(auditApi.exportCsv).toHaveBeenCalled();
        expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
        expect(clickSpy).toHaveBeenCalled();
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    });

    it("shows an error toast when export fails", async () => {
        mockedGetLogs.mockResolvedValueOnce(createMockResponse(1, 1, 20));
        vi.mocked(auditApi.exportCsv).mockRejectedValueOnce(
            new Error("network"),
        );

        const user = userEvent.setup();
        render(
            <>
                <Toaster />
                <AuditLog />
            </>,
        );
        await screen.findByText("ACTION_1");

        await user.click(screen.getByRole("button", { name: /export csv/i }));

        expect(await screen.findByText(/export failed/i)).toBeInTheDocument();
    });
});
