import React, { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { usersApi } from "@/services/usersApi";
import type { UserResponse } from "@/services/usersApi";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";

export const ProfilePage: React.FC = () => {
    const [profile, setProfile] = useState<UserResponse | null>(null);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [isLoadingProfile, setLoadingProfile] = useState(true);
    const [isSavingProfile, setSavingProfile] = useState(false);
    const [isChangingPassword, setChangingPassword] = useState(false);
    const [pendingAction, setPendingAction] = useState<
        "save-profile" | "change-password" | null
    >(null);
    const [isConfirming, setIsConfirming] = useState(false);

    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const logout = useAuthStore((s) => s.logout);
    const profileFirstName = profile?.first_name ?? "";
    const profileLastName = profile?.last_name ?? "";
    const hasAnyProfileName = firstName.trim() !== "" || lastName.trim() !== "";
    const isProfileDirty =
        !isLoadingProfile &&
        (firstName.trim() !== profileFirstName.trim() ||
            lastName.trim() !== profileLastName.trim());
    const isSaveDisabled =
        isSavingProfile || !isProfileDirty || !hasAnyProfileName;
    const isResetDisabled = !isProfileDirty;
    const canChangePassword =
        currentPassword.trim() !== "" &&
        newPassword.trim() !== "" &&
        confirmPassword.trim() !== "" &&
        currentPassword.length >= 8 &&
        newPassword.length >= 8 &&
        currentPassword !== newPassword &&
        newPassword === confirmPassword;

    const isChangePasswordDisabled = isChangingPassword || !canChangePassword;
    const isConfirmDialogOpen = pendingAction !== null;
    const confirmDialogTitle =
        pendingAction === "change-password"
            ? "Confirm password change"
            : "Confirm profile changes";
    const confirmDialogBody =
        pendingAction === "change-password"
            ? "You are about to update your password. Confirm changes to continue."
            : "You are about to update your profile details. Confirm changes to continue.";

    useEffect(() => {
        let isMounted = true;
        usersApi
            .getMe()
            .then((p) => {
                if (!isMounted) return;
                setProfile(p);
                setFirstName(p.first_name ?? "");
                setLastName(p.last_name ?? "");
            })
            .catch(() => {
                if (!isMounted) return;
                setError("Failed to load profile");
            })
            .finally(() => isMounted && setLoadingProfile(false));

        return () => {
            isMounted = false;
        };
    }, []);

    const getErrorMessage = (err: unknown, fallback: string) => {
        if (typeof err === "object" && err !== null) {
            type ErrWithResponse = {
                response?: { data?: unknown };
                message?: string;
            };
            const e = err as ErrWithResponse;
            if (
                e.response &&
                typeof e.response === "object" &&
                e.response.data &&
                typeof e.response.data === "object"
            ) {
                const data = e.response.data as Record<string, unknown>;
                if (typeof data.detail === "string") return data.detail;
                if (typeof data.message === "string") return data.message;
            }
            if (typeof e.message === "string") return e.message;
        }

        return fallback;
    };

    const applyProfileChanges = async () => {
        setSavingProfile(true);
        setMessage(null);
        setError(null);

        try {
            const payload: { first_name?: string; last_name?: string } = {};
            const fn = firstName.trim();
            const ln = lastName.trim();
            if (fn !== "") payload.first_name = fn;
            if (ln !== "") payload.last_name = ln;

            const updated = await usersApi.updateProfile(payload);
            setProfile(updated);
            setMessage("Profile updated");
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Failed to update profile"));
        } finally {
            setSavingProfile(false);
        }
    };

    const applyPasswordChanges = async () => {
        setChangingPassword(true);
        setMessage(null);
        setError(null);

        const isCurrentPasswordShort = currentPassword.length < 8;
        const isNewPasswordShort = newPassword.length < 8;

        if (isCurrentPasswordShort || isNewPasswordShort) {
            if (isCurrentPasswordShort && isNewPasswordShort) {
                setError(
                    "Current and new password must be at least 8 characters",
                );
            } else if (isCurrentPasswordShort) {
                setError("Current password cannot be less than 8 characters");
            } else {
                setError("New password cannot be less than 8 characters");
            }
            setChangingPassword(false);
            return;
        }

        if (currentPassword === newPassword) {
            setError("Current and New password cannot be the same");
            setChangingPassword(false);
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("New password and confirm password must match");
            setChangingPassword(false);
            return;
        }

        try {
            await usersApi.changePassword(currentPassword, newPassword);
            setMessage("Password changed — you will be signed out...");
            setTimeout(() => logout(), 1500);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Failed to change password"));
        } finally {
            setChangingPassword(false);
        }
    };

    const handleConfirmChanges = async () => {
        if (!pendingAction || isConfirming) return;
        setIsConfirming(true);
        try {
            if (pendingAction === "save-profile") {
                await applyProfileChanges();
            } else {
                await applyPasswordChanges();
            }
            setPendingAction(null);
        } finally {
            setIsConfirming(false);
        }
    };

    const onSaveProfile = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (isSaveDisabled) return;
        setMessage(null);
        setError(null);
        setPendingAction("save-profile");
    };

    const onChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isChangePasswordDisabled) {
            return;
        }
        setMessage(null);
        setError(null);
        setPendingAction("change-password");
    };

    return (
        <div className="mx-auto max-w-[1120px] px-4 pt-8 pb-10 md:px-6">
            <Dialog
                open={isConfirmDialogOpen}
                onOpenChange={(open) => {
                    if (!open && !isConfirming) setPendingAction(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{confirmDialogTitle}</DialogTitle>
                    </DialogHeader>
                    <DialogDescription>{confirmDialogBody}</DialogDescription>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setPendingAction(null)}
                            disabled={isConfirming}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="default"
                            onClick={handleConfirmChanges}
                            disabled={isConfirming}
                        >
                            Confirm Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <h1 className="mb-6 font-heading text-3xl leading-[1.1] font-bold text-brand-primary">
                Profile
            </h1>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <section className="rounded-lg border border-color-border bg-color-surface-raised p-6 shadow-sm">
                    <h2 className="mb-4 font-heading text-2xl leading-[1.15] font-bold text-brand-primary">
                        Profile Details
                    </h2>
                    {isLoadingProfile ? (
                        <p className="text-sm text-color-text-secondary">
                            Loading…
                        </p>
                    ) : (
                        <form
                            onSubmit={onSaveProfile}
                            className="flex flex-col gap-5"
                        >
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="first_name">First name</Label>
                                <Input
                                    id="first_name"
                                    value={firstName}
                                    onChange={(e) =>
                                        setFirstName(e.target.value)
                                    }
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <Label htmlFor="last_name">Last name</Label>
                                <Input
                                    id="last_name"
                                    value={lastName}
                                    onChange={(e) =>
                                        setLastName(e.target.value)
                                    }
                                />
                            </div>

                            <div className="flex items-center gap-3 pt-2">
                                <Button
                                    type="submit"
                                    variant="default"
                                    disabled={isSaveDisabled}
                                >
                                    Save
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={isResetDisabled}
                                    onClick={() => {
                                        setFirstName(profileFirstName);
                                        setLastName(profileLastName);
                                        setMessage(null);
                                        setError(null);
                                    }}
                                >
                                    Reset
                                </Button>
                            </div>
                        </form>
                    )}
                </section>

                <section className="rounded-lg border border-color-border bg-color-surface-raised p-6 shadow-sm">
                    <h2 className="mb-4 font-heading text-2xl leading-[1.15] font-bold text-brand-primary">
                        Change Password
                    </h2>
                    <form
                        onSubmit={onChangePassword}
                        className="flex flex-col gap-5"
                    >
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="current_password">
                                Current password
                            </Label>
                            <div className="relative">
                                <Input
                                    id="current_password"
                                    type={
                                        showCurrentPassword
                                            ? "text"
                                            : "password"
                                    }
                                    className="pr-12"
                                    value={currentPassword}
                                    onChange={(e) =>
                                        setCurrentPassword(e.target.value)
                                    }
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label={
                                        showCurrentPassword
                                            ? "Hide password"
                                            : "Show password"
                                    }
                                    onClick={() =>
                                        setShowCurrentPassword((v) => !v)
                                    }
                                    className="absolute right-1 top-1/2 -translate-y-1/2"
                                >
                                    {showCurrentPassword ? (
                                        <EyeOff size={17} />
                                    ) : (
                                        <Eye size={17} />
                                    )}
                                </Button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="new_password">New password</Label>
                            <div className="relative">
                                <Input
                                    id="new_password"
                                    type={showNewPassword ? "text" : "password"}
                                    className="pr-12"
                                    value={newPassword}
                                    onChange={(e) => {
                                        setNewPassword(e.target.value);
                                        setError(null);
                                    }}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label={
                                        showNewPassword
                                            ? "Hide password"
                                            : "Show password"
                                    }
                                    onClick={() =>
                                        setShowNewPassword((v) => !v)
                                    }
                                    className="absolute right-1 top-1/2 -translate-y-1/2"
                                >
                                    {showNewPassword ? (
                                        <EyeOff size={17} />
                                    ) : (
                                        <Eye size={17} />
                                    )}
                                </Button>
                            </div>
                            <p className="text-xs text-color-text-secondary">
                                New password must be at least 8 characters.
                            </p>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="confirm_password">
                                Confirm password
                            </Label>
                            <div className="relative">
                                <Input
                                    id="confirm_password"
                                    type={
                                        showConfirmPassword
                                            ? "text"
                                            : "password"
                                    }
                                    className="pr-12"
                                    value={confirmPassword}
                                    onChange={(e) => {
                                        setConfirmPassword(e.target.value);
                                        setError(null);
                                    }}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label={
                                        showConfirmPassword
                                            ? "Hide password"
                                            : "Show password"
                                    }
                                    onClick={() =>
                                        setShowConfirmPassword((v) => !v)
                                    }
                                    className="absolute right-1 top-1/2 -translate-y-1/2"
                                >
                                    {showConfirmPassword ? (
                                        <EyeOff size={17} />
                                    ) : (
                                        <Eye size={17} />
                                    )}
                                </Button>
                            </div>
                        </div>

                        <div className="pt-2">
                            <Button
                                type="submit"
                                variant="default"
                                disabled={isChangePasswordDisabled}
                            >
                                Change Password
                            </Button>
                        </div>
                    </form>
                </section>
            </div>

            {message && (
                <output className="mt-6 block rounded-md border border-color-border bg-status-safe/10 p-3 text-sm text-status-safe-text">
                    {message}
                </output>
            )}

            {error && (
                <div
                    className="mt-6 rounded-md border border-color-border bg-status-critical/5 p-3 text-sm text-status-critical-text"
                    role="alert"
                >
                    {error}
                </div>
            )}
        </div>
    );
};

export default ProfilePage;
