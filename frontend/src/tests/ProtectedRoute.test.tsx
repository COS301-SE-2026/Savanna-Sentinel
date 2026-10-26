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
                    <Route path="/tipoffs" element={<div>Tipoffs Page</div>} />
                    <Route path="/upload" element={<div>Upload Page</div>} />
                    <Route path="/profile" element={<div>Profile Page</div>} />
                    <Route path="/admin" element={<div>Admin Page</div>} />
                    <Route path="/help" element={<div>Help Page</div>} />
                    <Route path="/map" element={<div>Map Page</div>} />
                    <Route path="/patrol" element={<div>Patrol Page</div>} />
                    <Route
                        path="/workspace"
                        element={<div>Workspace Page</div>}
                    />
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
        isUploaded: null,
    });
});

function signIn(role: string, uploaded: boolean) {
    useAuthStore.setState({
        accessToken: "mock-valid-token",
        user: { id: "1", username: role, role },
    });
    vi.mocked(riskApi.checkUploaded).mockResolvedValue({ uploaded });
}

describe("ProtectedRoute", () => {
    it("redirects unauthenticated users to /login immediately", () => {
        renderTestRouter("/dashboard");

        expect(screen.getByText("Login Page")).toBeInTheDocument();
        expect(riskApi.checkUploaded).not.toHaveBeenCalled();
    });
    it("redirects admins to /upload if boundaries are unuploaded", async () => {
        signIn("admin", false);

        renderTestRouter("/reports");

        expect(screen.getByText("Loading...")).toBeInTheDocument();
        expect(await screen.findByText("Upload Page")).toBeInTheDocument();
    });
    it("allows access to protected content if boundaries are uploaded", async () => {
        signIn("ranger", true);

        renderTestRouter("/reports");

        expect(await screen.findByText("Reports Page")).toBeInTheDocument();
    });

    it("redirects a non-admin away from upload to dashboard if system is already uploaded", async () => {
        signIn("ranger", true);

        renderTestRouter("/upload");

        expect(await screen.findByText("Dashboard Page")).toBeInTheDocument();
    });

    it("lets an admin open /upload when a park exists", async () => {
        signIn("admin", true);

        renderTestRouter("/upload");

        expect(await screen.findByText("Upload Page")).toBeInTheDocument();
    });

    it("sends a liaison leaving upload to tipoffs, not the dashboard", async () => {
        useAuthStore.setState({
            accessToken: "mock-valid-token",
            user: { id: "2", username: "liaison", role: "community_liaison" },
        });
        vi.mocked(riskApi.checkUploaded).mockResolvedValue({ uploaded: true });

        renderTestRouter("/upload");

        expect(await screen.findByText("Tipoffs Page")).toBeInTheDocument();
    });

    describe("with no park uploaded", () => {
        it.each([
            ["/profile", "Profile Page"],
            ["/admin", "Admin Page"],
            ["/help", "Help Page"],
        ])("lets an admin open %s", async (path, pageText) => {
            signIn("admin", false);

            renderTestRouter(path);

            expect(await screen.findByText(pageText)).toBeInTheDocument();
        });

        it.each(["/profile", "/help"])(
            "lets a ranger open %s",
            async (path) => {
                signIn("ranger", false);

                renderTestRouter(path);

                expect(
                    await screen.findByText(
                        path === "/profile" ? "Profile Page" : "Help Page",
                    ),
                ).toBeInTheDocument();
            },
        );

        it.each([
            ["ranger", "/reports"],
            ["analyst", "/upload"],
            ["community_liaison", "/upload"],
            ["ranger", "/admin"],
        ])("sends a %s trying %s to their profile", async (role, path) => {
            signIn(role, false);

            renderTestRouter(path);

            expect(await screen.findByText("Profile Page")).toBeInTheDocument();
        });
    });

    describe("pages the role cannot use", () => {
        it.each([
            ["ranger", "/workspace", "Dashboard Page"],
            ["analyst", "/patrol", "Dashboard Page"],
            ["analyst", "/admin", "Dashboard Page"],
            ["community_liaison", "/map", "Tipoffs Page"],
            ["community_liaison", "/dashboard", "Tipoffs Page"],
        ])(
            "sends a %s trying %s to their home page",
            async (role, path, homeText) => {
                signIn(role, true);

                renderTestRouter(path);

                expect(await screen.findByText(homeText)).toBeInTheDocument();
            },
        );

        it("lets a role open a page it is allowed to use", async () => {
            signIn("analyst", true);

            renderTestRouter("/workspace");

            expect(
                await screen.findByText("Workspace Page"),
            ).toBeInTheDocument();
        });
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
