import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";

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

const createPlainUser = () => userEvent.setup();

const profileResponse = {
  id: "1",
  username: "jranger",
  email: "jane@example.com",
  first_name: "Jane",
  last_name: "Ranger",
  role: "ranger",
};

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.useRealTimers();
    getMe.mockResolvedValue(profileResponse);
    updateProfile.mockResolvedValue(profileResponse);
    changePassword.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // --- Profile Loading Tests ---
  it("loads the current profile", async () => {
    render(<ProfilePage />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(await screen.findByDisplayValue("Jane")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Ranger")).toBeInTheDocument();
    expect(getMe).toHaveBeenCalledTimes(1);
  });

  it("shows an error if profile fails to load", async () => {
    getMe.mockRejectedValueOnce(new Error("Network error"));
    render(<ProfilePage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /failed to load profile/i,
    );
    expect(screen.queryByText(/loading profile.../i)).not.toBeInTheDocument();
  });

  // --- Profile Update Tests ---
  it("disables save button when no changes are made", async () => {
    render(<ProfilePage />);
    await screen.findByDisplayValue("Jane");
    const user = createPlainUser();

    await user.click(screen.getByRole("button", { name: /edit/i }));
    expect(screen.getByRole("button", { name: /^save$/i })).toBeDisabled();
  });

  it("disables save button when all fields are cleared", async () => {
    render(<ProfilePage />);
    await screen.findByDisplayValue("Jane");
    const user = createPlainUser();

    await user.click(screen.getByRole("button", { name: /edit/i }));
    await user.clear(screen.getByLabelText(/first name/i));
    await user.clear(screen.getByLabelText(/last name/i));
    expect(screen.getByRole("button", { name: /^save$/i })).toBeDisabled();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("allows updating first name while last name is empty", async () => {
    const updatedProfile = {
      ...profileResponse,
      first_name: "Janet",
      last_name: "",
    };
    updateProfile.mockResolvedValueOnce(updatedProfile);

    render(<ProfilePage />);
    await screen.findByDisplayValue("Jane");
    const user = createPlainUser();

    await user.click(screen.getByRole("button", { name: /edit/i }));
    await user.clear(screen.getByLabelText(/first name/i));
    await user.type(screen.getByLabelText(/first name/i), "Janet");
    await user.clear(screen.getByLabelText(/last name/i));
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /confirm changes/i }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledWith({
        first_name: "Janet",
        last_name: "",
      });
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      /profile updated/i,
    );
    expect(screen.getByLabelText(/first name/i)).toHaveValue("Janet");
    expect(screen.getByLabelText(/last name/i)).toHaveValue("");
  });

  it("allows updating last name while first name is empty", async () => {
    const updatedProfile = {
      ...profileResponse,
      first_name: "",
      last_name: "Ranger-Smith",
    };
    updateProfile.mockResolvedValueOnce(updatedProfile);

    render(<ProfilePage />);
    await screen.findByDisplayValue("Jane");
    const user = createPlainUser();

    await user.click(screen.getByRole("button", { name: /edit/i }));
    await user.clear(screen.getByLabelText(/first name/i));
    await user.clear(screen.getByLabelText(/last name/i));
    await user.type(screen.getByLabelText(/last name/i), "Ranger-Smith");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /confirm changes/i }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledWith({
        first_name: "",
        last_name: "Ranger-Smith",
      });
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      /profile updated/i,
    );
    expect(screen.getByLabelText(/first name/i)).toHaveValue("");
    expect(screen.getByLabelText(/last name/i)).toHaveValue("Ranger-Smith");
  });

  it("allows updating both first and last name", async () => {
    const updatedProfile = {
      ...profileResponse,
      first_name: "Janet",
      last_name: "Ranger-Smith",
    };
    updateProfile.mockResolvedValueOnce(updatedProfile);

    render(<ProfilePage />);
    await screen.findByDisplayValue("Jane");
    const user = createPlainUser();

    await user.click(screen.getByRole("button", { name: /edit/i }));
    await user.clear(screen.getByLabelText(/first name/i));
    await user.type(screen.getByLabelText(/first name/i), "Janet");
    await user.clear(screen.getByLabelText(/last name/i));
    await user.type(screen.getByLabelText(/last name/i), "Ranger-Smith");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /confirm changes/i }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledWith({
        first_name: "Janet",
        last_name: "Ranger-Smith",
      });
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      /profile updated/i,
    );
    expect(screen.getByLabelText(/first name/i)).toHaveValue("Janet");
    expect(screen.getByLabelText(/last name/i)).toHaveValue("Ranger-Smith");
  });

  it("shows an error message if profile update fails", async () => {
    updateProfile.mockRejectedValueOnce(new Error("Update failed"));
    render(<ProfilePage />);
    await screen.findByDisplayValue("Jane");
    const user = createPlainUser();

    await user.click(screen.getByRole("button", { name: /edit/i }));
    await user.type(screen.getByLabelText(/first name/i), "NewName");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /confirm changes/i }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /update failed/i,
    );
  });

  // --- Password Change Tests ---
  it("disables change password button when current password is empty", async () => {
    render(<ProfilePage />);
    await screen.findByDisplayValue("Jane");
    const user = createPlainUser();

    await user.type(
      screen.getByLabelText(/^new password$/i),
      "new-password-123",
    );
    await user.type(
      screen.getByLabelText(/^confirm password$/i),
      "new-password-123",
    );
    expect(
      screen.getByRole("button", { name: /change password/i }),
    ).toBeDisabled();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("disables change password button when new password is empty", async () => {
    render(<ProfilePage />);
    await screen.findByDisplayValue("Jane");
    const user = createPlainUser();

    await user.type(
      screen.getByLabelText(/^current password$/i),
      "old-pass-123",
    );
    await user.type(
      screen.getByLabelText(/^confirm password$/i),
      "new-password-123",
    );
    expect(
      screen.getByRole("button", { name: /change password/i }),
    ).toBeDisabled();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("disables change password button when new password length is less than 8", async () => {
    render(<ProfilePage />);
    await screen.findByDisplayValue("Jane");
    const user = createPlainUser();

    await user.type(
      screen.getByLabelText(/^current password$/i),
      "old-pass-123",
    );
    await user.type(screen.getByLabelText(/^new password$/i), "short");
    await user.type(screen.getByLabelText(/^confirm password$/i), "short");

    expect(
      screen.getByRole("button", { name: /change password/i }),
    ).toBeDisabled();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("disables change password button when new password and confirm password do not match", async () => {
    render(<ProfilePage />);
    await screen.findByDisplayValue("Jane");
    const user = createPlainUser();

    await user.type(
      screen.getByLabelText(/^current password$/i),
      "old-pass-123",
    );
    await user.type(
      screen.getByLabelText(/^new password$/i),
      "new-password-123",
    );
    await user.type(screen.getByLabelText(/^confirm password$/i), "mismatch");

    expect(
      screen.getByRole("button", { name: /change password/i }),
    ).toBeDisabled();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("disables change password button when new password is the same as current password", async () => {
    render(<ProfilePage />);
    await screen.findByDisplayValue("Jane");
    const user = createPlainUser();

    await user.type(
      screen.getByLabelText(/^current password$/i),
      "SamePass123",
    );
    await user.type(screen.getByLabelText(/^new password$/i), "SamePass123");
    await user.type(
      screen.getByLabelText(/^confirm password$/i),
      "SamePass123",
    );

    expect(
      screen.getByRole("button", { name: /change password/i }),
    ).toBeDisabled();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("fails password update when current password does not match (server error)", async () => {
    changePassword.mockRejectedValueOnce({
      response: { data: { detail: "Current password is incorrect" } },
    });

    render(<ProfilePage />);
    await screen.findByDisplayValue("Jane");
    const user = createPlainUser();

    await user.type(
      screen.getByLabelText(/^current password$/i),
      "wrong-pass-123",
    );
    await user.type(
      screen.getByLabelText(/^new password$/i),
      "new-password-123",
    );
    await user.type(
      screen.getByLabelText(/^confirm password$/i),
      "new-password-123",
    );
    await user.click(screen.getByRole("button", { name: /change password/i }));

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /confirm changes/i }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /current password is incorrect/i,
    );
    expect(changePassword).toHaveBeenCalledWith(
      "wrong-pass-123",
      "new-password-123",
    );
  });

  it("successfully changes password and logs out the user", async () => {
    vi.useRealTimers();

    render(<ProfilePage />);

    await screen.findByDisplayValue("Jane");
    const user = createPlainUser();

    await user.type(
      screen.getByLabelText(/^current password$/i),
      "old-pass-123",
    );
    await user.type(
      screen.getByLabelText(/^new password$/i),
      "new-password-123",
    );
    await user.type(
      screen.getByLabelText(/^confirm password$/i),
      "new-password-123",
    );

    await user.click(screen.getByRole("button", { name: /change password/i }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: /confirm changes/i });
    await user.click(confirmBtn);

    expect(changePassword).toHaveBeenCalledWith(
      "old-pass-123",
      "new-password-123",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      /you will be signed out/i,
    );
    expect(logout).not.toHaveBeenCalled();

    await vi.waitUntil(() => logout.mock.calls.length === 1, {
      timeout: 2000,
      interval: 50,
    });

    expect(logout).toHaveBeenCalledTimes(1);
  }, 10_000);
});
