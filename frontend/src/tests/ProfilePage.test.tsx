import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import ProfilePage from "@/pages/ProfilePage";
import { notifySafe, notifyCritical } from "@/components/ui/toast";

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

vi.mock("@/components/ui/toast", () => ({
    notifySafe: vi.fn(),
    notifyCritical: vi.fn(),
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
        getMe.mockResolvedValue(profileResponse);
        updateProfile.mockResolvedValue(profileResponse);
        changePassword.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    const expectProfileUpdatedToast = () =>
        waitFor(() =>
            expect(notifySafe).toHaveBeenCalledWith("Profile updated"),
        );

    it("loads the current profile", async () => {
        render(<ProfilePage />);

        expect(screen.getByText(/loading/i)).toBeInTheDocument();
        expect(await screen.findByDisplayValue("Jane")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Ranger")).toBeInTheDocument();
        expect(getMe).toHaveBeenCalledTimes(1);
    });

    it("fails profile update when all fields are empty", async () => {
        render(<ProfilePage />);
        await screen.findByDisplayValue("Jane");
        const user = createPlainUser();

        await user.clear(screen.getByLabelText(/first name/i));
        await user.clear(screen.getByLabelText(/last name/i));
        expect(screen.getByRole("button", { name: /^save$/i })).toBeDisabled();
        expect(updateProfile).not.toHaveBeenCalled();
    });

    it("passes when updating first name with empty last name", async () => {
        render(<ProfilePage />);
        await screen.findByDisplayValue("Jane");
        const user = createPlainUser();

        await user.clear(screen.getByLabelText(/first name/i));
        await user.type(screen.getByLabelText(/first name/i), "Janet");
        await user.clear(screen.getByLabelText(/last name/i));
        await user.click(screen.getByRole("button", { name: /^save$/i }));

        expect(await screen.findByRole("dialog")).toBeInTheDocument();
        await user.click(
            screen.getByRole("button", { name: /confirm changes/i }),
        );

        await waitFor(() => {
            expect(updateProfile).toHaveBeenCalledWith({ first_name: "Janet" });
        });
        await expectProfileUpdatedToast();
    });

    it("passes when updating last name with empty first name", async () => {
        render(<ProfilePage />);
        await screen.findByDisplayValue("Jane");
        const user = createPlainUser();

        await user.clear(screen.getByLabelText(/first name/i));
        await user.clear(screen.getByLabelText(/last name/i));
        await user.type(screen.getByLabelText(/last name/i), "Ranger-Smith");
        await user.click(screen.getByRole("button", { name: /^save$/i }));

        expect(await screen.findByRole("dialog")).toBeInTheDocument();
        await user.click(
            screen.getByRole("button", { name: /confirm changes/i }),
        );

        await waitFor(() => {
            expect(updateProfile).toHaveBeenCalledWith({
                last_name: "Ranger-Smith",
            });
        });
        await expectProfileUpdatedToast();
    });

    it("passes when updating both first and last name", async () => {
        render(<ProfilePage />);
        await screen.findByDisplayValue("Jane");
        const user = createPlainUser();

        await user.clear(screen.getByLabelText(/first name/i));
        await user.type(screen.getByLabelText(/first name/i), "Janet");
        await user.clear(screen.getByLabelText(/last name/i));
        await user.type(screen.getByLabelText(/last name/i), "Ranger-Smith");
        await user.click(screen.getByRole("button", { name: /^save$/i }));

        expect(await screen.findByRole("dialog")).toBeInTheDocument();
        await user.click(
            screen.getByRole("button", { name: /confirm changes/i }),
        );

        await waitFor(() => {
            expect(updateProfile).toHaveBeenCalledWith({
                first_name: "Janet",
                last_name: "Ranger-Smith",
            });
        });
        await expectProfileUpdatedToast();
    });

    it("fails password update when current password is empty", async () => {
        render(<ProfilePage />);
        await screen.findByDisplayValue("Jane");
        const user = createPlainUser();

        await user.type(screen.getByLabelText(/new password/i), "new-pass-1");
        expect(
            screen.getByRole("button", { name: /change password/i }),
        ).toBeDisabled();
        expect(changePassword).not.toHaveBeenCalled();
    });

    it("fails password update when new password is empty", async () => {
        render(<ProfilePage />);
        await screen.findByDisplayValue("Jane");
        const user = createPlainUser();

        await user.type(
            screen.getByLabelText(/current password/i),
            "old-pass-123",
        );
        expect(
            screen.getByRole("button", { name: /change password/i }),
        ).toBeDisabled();
        expect(changePassword).not.toHaveBeenCalled();
    });

    it("fails password update when new password length is less than 8", async () => {
        render(<ProfilePage />);
        await screen.findByDisplayValue("Jane");
        const user = createPlainUser();

        // Using a password of length 7
        await user.type(
            screen.getByLabelText(/current password/i),
            "old-pass-123",
        );
        await user.type(screen.getByLabelText(/new password/i), "1234567");
        expect(
            screen.getByRole("button", { name: /change password/i }),
        ).toBeDisabled();
        expect(changePassword).not.toHaveBeenCalled();
    });

    it("fails password update when current password does not match", async () => {
        changePassword.mockRejectedValue({
            response: { data: { detail: "Current password is incorrect" } },
        });

        render(<ProfilePage />);
        await screen.findByDisplayValue("Jane");
        const user = createPlainUser();

        await user.type(
            screen.getByLabelText(/current password/i),
            "wrong-pass",
        );
        await user.type(screen.getByLabelText(/new password/i), "new-pass-123");
        await user.type(
            screen.getByLabelText(/confirm password/i),
            "new-pass-123",
        );
        await user.click(
            screen.getByRole("button", { name: /change password/i }),
        );

        expect(await screen.findByRole("dialog")).toBeInTheDocument();
        await user.click(
            screen.getByRole("button", { name: /confirm changes/i }),
        );

        await waitFor(() =>
            expect(notifyCritical).toHaveBeenCalledWith(
                "Current password is incorrect",
            ),
        );
    });

    it("passes password update when current password matches and new password is valid", async () => {
        render(<ProfilePage />);
        await screen.findByDisplayValue("Jane");
        fireEvent.change(screen.getByLabelText(/current password/i), {
            target: { value: "old-pass-123" },
        });
        fireEvent.change(screen.getByLabelText(/new password/i), {
            target: { value: "new-pass-123" },
        });
        fireEvent.change(screen.getByLabelText(/confirm password/i), {
            target: { value: "new-pass-123" },
        });
        fireEvent.click(
            screen.getByRole("button", { name: /change password/i }),
        );

        await waitFor(() => {
            expect(screen.getByRole("dialog")).toBeInTheDocument();
        });
        fireEvent.click(
            screen.getByRole("button", { name: /confirm changes/i }),
        );

        await waitFor(() => {
            expect(changePassword).toHaveBeenCalledWith(
                "old-pass-123",
                "new-pass-123",
            );
        });
        expect(notifySafe).toHaveBeenCalledWith(
            "Password changed",
            "You will be signed out...",
        );
    });

    it("resets the profile form back to the loaded values", async () => {
        render(<ProfilePage />);
        await screen.findByDisplayValue("Jane");
        const user = createPlainUser();

        await user.clear(screen.getByLabelText(/first name/i));
        await user.type(screen.getByLabelText(/first name/i), "Janet");
        await user.clear(screen.getByLabelText(/last name/i));
        await user.type(screen.getByLabelText(/last name/i), "Smithers");

        await user.click(screen.getByRole("button", { name: /^reset$/i }));

        expect(screen.getByLabelText(/first name/i)).toHaveValue("Jane");
        expect(screen.getByLabelText(/last name/i)).toHaveValue("Ranger");
    });

    it("cancels pending profile changes without saving", async () => {
        render(<ProfilePage />);
        await screen.findByDisplayValue("Jane");
        const user = createPlainUser();

        await user.clear(screen.getByLabelText(/first name/i));
        await user.type(screen.getByLabelText(/first name/i), "Janet");
        await user.click(screen.getByRole("button", { name: /^save$/i }));

        expect(await screen.findByRole("dialog")).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Cancel" }));

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(updateProfile).not.toHaveBeenCalled();
    });

    it("closes the confirmation dialog via the header close button", async () => {
        render(<ProfilePage />);
        await screen.findByDisplayValue("Jane");
        const user = createPlainUser();

        await user.clear(screen.getByLabelText(/first name/i));
        await user.type(screen.getByLabelText(/first name/i), "Janet");
        await user.click(screen.getByRole("button", { name: /^save$/i }));

        const dialog = await screen.findByRole("dialog");
        await user.click(
            screen.getByRole("button", { name: /cancel, close dialog/i }),
        );

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(updateProfile).not.toHaveBeenCalled();
        expect(dialog).not.toBeInTheDocument();
    });

    it("toggles the visibility of each password field", async () => {
        render(<ProfilePage />);
        await screen.findByDisplayValue("Jane");
        const user = createPlainUser();

        const currentPasswordInput = screen.getByLabelText(/current password/i);
        const newPasswordInput = screen.getByLabelText(/^new password/i);
        const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

        expect(currentPasswordInput).toHaveAttribute("type", "password");
        expect(newPasswordInput).toHaveAttribute("type", "password");
        expect(confirmPasswordInput).toHaveAttribute("type", "password");

        await user.click(
            screen.getAllByRole("button", { name: /show password/i })[0],
        );
        expect(currentPasswordInput).toHaveAttribute("type", "text");

        await user.click(
            screen.getAllByRole("button", { name: /show password/i })[0],
        );
        expect(newPasswordInput).toHaveAttribute("type", "text");

        await user.click(
            screen.getAllByRole("button", { name: /show password/i })[0],
        );
        expect(confirmPasswordInput).toHaveAttribute("type", "text");

        await user.click(
            screen.getAllByRole("button", { name: /hide password/i })[0],
        );
        expect(currentPasswordInput).toHaveAttribute("type", "password");
    });
});
