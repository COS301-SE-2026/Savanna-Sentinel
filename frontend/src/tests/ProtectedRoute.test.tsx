import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import { useAuthStore } from "@/store/authStore";
import { riskApi } from "@/services/riskApi";
import { AxiosError, AxiosHeaders } from "axios";

vi.mock("@/services/riskApi", () => ({
    riskApi: {
        checkUploaded: vi.fn(),
    },
}));

const renderTestRouter = (initialEntry: string) => {
    return render(
        <MemoryRouter initialEntries={[initialEntry]}>
            <Routes>
                <Route path="/login" element={<div>Login Page</div>} />
                <Route element={<ProtectedRoute />}>
                    <Route
                        path="/dashboard"
                        element={<div>Dashboard Page</div>}
                    />
                    <Route path="/reports" element={<div>Reports Page</div>} />
                    <Route path="/upload" element={<div>Upload Page</div>} />
                </Route>
            </Routes>
        </MemoryRouter>,
    );
};

beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
        accessToken: null,
        refreshToken: null,
        user: null,
    });
});

describe("ProtectedRoute", () => {
    it("redirects unauthenticated users to /login immediately", () => {
        renderTestRouter("/dashboard");

        expect(screen.getByText("Login Page")).toBeInTheDocument();
        expect(riskApi.checkUploaded).not.toHaveBeenCalled();
    });
    it("redirects users to /upload if boundaries are unuploaded", async () => {
        useAuthStore.setState({ accessToken: "mock-valid-token" });
        vi.mocked(riskApi.checkUploaded).mockResolvedValue({ uploaded: false });

        renderTestRouter("/reports");

        expect(screen.getByText("Loading...")).toBeInTheDocument();
        expect(await screen.findByText("Upload Page")).toBeInTheDocument();
    });
    it("allows access to protected content if boundaries are uploaded", async () => {
        useAuthStore.setState({ accessToken: "mock-valid-token" });
        vi.mocked(riskApi.checkUploaded).mockResolvedValue({ uploaded: true });

        renderTestRouter("/reports");

        expect(await screen.findByText("Reports Page")).toBeInTheDocument();
    });

    it("redirects away from upload to dashboard if system is already uploaded", async () => {
        useAuthStore.setState({ accessToken: "mock-valid-token" });
        vi.mocked(riskApi.checkUploaded).mockResolvedValue({ uploaded: true });

        renderTestRouter("/upload");

        expect(await screen.findByText("Dashboard Page")).toBeInTheDocument();
    });

    it("logs out user and redirects to login when checkUploaded fails with 401", async () => {
        useAuthStore.setState({
            accessToken: "mock-expired-token",
            refreshToken: "mock-refresh-token",
            user: { id: "1", username: "admin", role: "admin" },
        });

        const axios401Error = new AxiosError(
            "Unauthorized",
            "401",
            undefined,
            {},
            {
                status: 401,
                statusText: "Unauthorized",
                headers: new AxiosHeaders(),
                config: { headers: new AxiosHeaders() },
                data: {},
            },
        );

        vi.mocked(riskApi.checkUploaded).mockRejectedValue(axios401Error);

        renderTestRouter("/dashboard");

        expect(await screen.findByText("Login Page")).toBeInTheDocument();
        expect(useAuthStore.getState().accessToken).toBeNull();
    });
});
