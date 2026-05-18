import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";

import ProfilePage from "@/pages/ProfilePage";

const { getMe, updateProfile, changePassword, logout } = vi.hoisted(() => ({
  getMe: vi.fn(),
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/services/usersApi", () => ({
  usersApi: {
    getMe,
    updateProfile,
    changePassword,
  },
}));

vi.mock("@/store/authStore", () => ({
  useAuthStore: (selector: (state: { logout: () => void }) => unknown) =>
    selector({ logout }),
}));

describe("ProfilePage", () => {
  beforeEach(() => {
    getMe.mockResolvedValue({
      id: "1",
      username: "jranger",
      email: "jane@example.com",
      first_name: "Jane",
      last_name: "Ranger",
      role: "ranger",
    });
    updateProfile.mockResolvedValue({
      id: "1",
      username: "jranger",
      email: "jane@example.com",
      first_name: "Jane",
      last_name: "Ranger",
      role: "ranger",
    });
    changePassword.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("loads and displays the current profile", async () => {
    render(<ProfilePage />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    expect(await screen.findByDisplayValue("Jane")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Ranger")).toBeInTheDocument();
    expect(getMe).toHaveBeenCalledTimes(1);
  });

  it("saves profile changes and shows a confirmation message", async () => {
    render(<ProfilePage />);
    const firstNameInput = await screen.findByDisplayValue("Jane");

    await userEvent.clear(firstNameInput);
    await userEvent.type(firstNameInput, "Janet");
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledWith({ first_name: "Janet", last_name: "Ranger" });
    });
    expect(await screen.findByRole("status")).toHaveTextContent(/profile updated/i);
  });

  it("rejects a new password shorter than 8 characters", async () => {
    render(<ProfilePage />);
    await screen.findByDisplayValue("Jane");

    await userEvent.type(screen.getByLabelText(/current password/i), "old-pass");
    await userEvent.type(screen.getByLabelText(/new password/i), "short");
    await userEvent.click(screen.getByRole("button", { name: /change password/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/at least 8 characters/i);
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("changes the password and logs the user out after success", async () => {
    render(<ProfilePage />);
    await screen.findByDisplayValue("Jane");

    await userEvent.type(screen.getByLabelText(/current password/i), "old-pass-123");
    await userEvent.type(screen.getByLabelText(/new password/i), "new-pass-123");
    await userEvent.click(screen.getByRole("button", { name: /change password/i }));

    await waitFor(() => {
      expect(changePassword).toHaveBeenCalledWith("old-pass-123", "new-pass-123");
    });
    expect(screen.getByRole("status")).toHaveTextContent(/you will be signed out/i);

    await waitFor(() => {
      expect(logout).toHaveBeenCalledTimes(1);
    }, { timeout: 3000 });
  });

  it("shows the backend error message when profile saving fails", async () => {
    updateProfile.mockRejectedValue({
      response: { data: { detail: "Profile update denied" } },
    });

    render(<ProfilePage />);
    await screen.findByDisplayValue("Jane");

    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/profile update denied/i);
  });
});