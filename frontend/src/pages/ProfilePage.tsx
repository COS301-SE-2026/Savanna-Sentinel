import React, { useEffect, useState } from "react";
import { usersApi } from "@/services/usersApi";
import type { UserResponse } from "@/services/usersApi";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const ProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<UserResponse | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    "save-profile" | "change-password" | null
  >(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const logout = useAuthStore((s) => s.logout);
  const profileFirstName = profile?.first_name ?? "";
  const profileLastName = profile?.last_name ?? "";
  const trimmedFirstName = firstName.trim();
  const trimmedLastName = lastName.trim();
  const trimmedProfileFirstName = profileFirstName.trim();
  const trimmedProfileLastName = profileLastName.trim();
  const hasAnyProfileName = trimmedFirstName !== "" || trimmedLastName !== "";
  const isProfileDirty =
    !loadingProfile &&
    (trimmedFirstName !== trimmedProfileFirstName ||
      trimmedLastName !== trimmedProfileLastName);
  const isSaveDisabled = savingProfile || !isProfileDirty || !hasAnyProfileName;
  const isResetDisabled = !isProfileDirty;
  const profileChanges = [
    {
      label: "First name",
      from: trimmedProfileFirstName,
      to: trimmedFirstName,
    },
    { label: "Last name", from: trimmedProfileLastName, to: trimmedLastName },
  ].filter((change) => change.from !== change.to);
  const canChangePassword =
    currentPassword.trim() !== "" &&
    newPassword.trim() !== "" &&
    confirmPassword.trim() !== "" &&
    currentPassword.length >= 8 &&
    newPassword.length >= 8 &&
    currentPassword !== newPassword &&
    newPassword === confirmPassword;

  const isChangePasswordDisabled = changingPassword || !canChangePassword;
  const isConfirmDialogOpen = pendingAction !== null;
  const confirmDialogTitle =
    pendingAction === "change-password"
      ? "Confirm password change"
      : "Confirm profile changes";
  const confirmDialogBody =
    pendingAction === "change-password"
      ? "You are about to update your password. Confirm changes to continue."
      : "Review your profile updates before confirming.";

  useEffect(() => {
    let mounted = true;
    usersApi
      .getMe()
      .then((p) => {
        if (!mounted) return;
        setProfile(p);
        setFirstName(p.first_name ?? "");
        setLastName(p.last_name ?? "");
      })
      .catch(() => {
        if (!mounted) return;
        setError("Failed to load profile");
      })
      .finally(() => mounted && setLoadingProfile(false));

    return () => {
      mounted = false;
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
      if (trimmedFirstName !== trimmedProfileFirstName)
        payload.first_name = trimmedFirstName;
      if (trimmedLastName !== trimmedProfileLastName)
        payload.last_name = trimmedLastName;

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

    const currentPasswordShort = currentPassword.length < 8;
    const newPasswordShort = newPassword.length < 8;

    if (currentPasswordShort || newPasswordShort) {
      if (currentPasswordShort && newPasswordShort) {
        setError("Current and new password must be at least 8 characters");
      } else if (currentPasswordShort) {
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
    <div className="min-h-screen bg-[#F2F2F2] text-[#313131]">
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Dialog
          open={isConfirmDialogOpen}
          onOpenChange={(open: boolean) => !open && setPendingAction(null)}
        >
          <DialogContent
            showCloseButton={!isConfirming}
            className="max-w-lg rounded-xl border border-[#D8DAD6] bg-[#F2F2F2] p-0 shadow-[0_18px_40px_rgba(0,35,84,0.18)]"
          >
            <DialogHeader className="bg-[#003A6B] text-white rounded-t-xl p-5">
              <DialogTitle className="text-white">
                {confirmDialogTitle}
              </DialogTitle>
              <DialogDescription className="text-[#D8DAD6]">
                {confirmDialogBody}
              </DialogDescription>
            </DialogHeader>
            {pendingAction === "save-profile" ? (
              <div className="px-5 pb-5 pt-4 text-sm text-[#313131]">
                <div className="mb-3 font-medium text-[#174585]">
                  Changes to be applied:
                </div>
                <div className="space-y-2 rounded-md border border-[#D8DAD6] bg-white p-3">
                  {profileChanges.map((change) => (
                    <div
                      key={change.label}
                      className="grid grid-cols-[96px_1fr_auto_1fr] items-center gap-2 text-sm"
                    >
                      <span className="font-medium text-[#003A6B]">
                        {change.label}
                      </span>
                      <span className="rounded bg-[#F2F2F2] px-2 py-1 text-[#313131]">
                        {change.from === "" ? "Empty" : change.from}
                      </span>
                      <span className="text-[#6897B8]" aria-hidden="true">
                        →
                      </span>
                      <span className="rounded bg-[#D8DAD6]/60 px-2 py-1 text-[#003A6B]">
                        {change.to === "" ? "Empty" : change.to}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[#313131]">
                  Please click{" "}
                  <span className="font-semibold text-[#003A6B]">
                    Confirm changes
                  </span>{" "}
                  to apply the update.
                </p>
              </div>
            ) : (
              <div className="px-5 pb-5 pt-4 text-sm text-[#313131]">
                Please click{" "}
                <span className="font-semibold text-[#003A6B]">
                  Confirm changes
                </span>{" "}
                to apply the update.
              </div>
            )}
            <DialogFooter className="p-5 pt-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPendingAction(null)}
                disabled={isConfirming}
                className="border-[#003A6B] text-[#003A6B] hover:bg-[#D8DAD6]/60"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="default"
                onClick={handleConfirmChanges}
                disabled={isConfirming}
                className="bg-[#003A6B] text-white hover:bg-[#002354]"
              >
                {isConfirming ? "Applying changes..." : "Confirm changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 gap-6 pt-4 md:grid-cols-2">
          <section className="rounded-md border border-[#D8DAD6] bg-[#F2F2F2] p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-[#003A6B]">
              Profile
            </h2>
            {loadingProfile ? (
              <p className="text-sm text-[#4F7392]">Loading profile...</p>
            ) : (
              <form onSubmit={onSaveProfile}>
                <label
                  htmlFor="first_name"
                  className="block text-sm font-medium text-[#313131]"
                >
                  First name
                </label>
                <Input
                  id="first_name"
                  className="mt-1 border-[#6897B8] bg-white text-[#313131] placeholder:text-[#4F7392] focus-visible:border-[#174585] focus-visible:ring-[#174585]/30"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />

                <label
                  htmlFor="last_name"
                  className="mt-4 block text-sm font-medium text-[#313131]"
                >
                  Last name
                </label>
                <Input
                  id="last_name"
                  className="mt-1 border-[#6897B8] bg-white text-[#313131] placeholder:text-[#4F7392] focus-visible:border-[#174585] focus-visible:ring-[#174585]/30"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />

                <div className="mt-4 flex items-center gap-3 pt-2">
                  <Button
                    type="submit"
                    variant="default"
                    className="bg-[#003A6B] text-white hover:bg-[#002354]"
                    disabled={isSaveDisabled}
                  >
                    {savingProfile ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-[#174585] text-[#174585] hover:bg-[#D8DAD6]/60"
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

          <section className="rounded-md border border-[#D8DAD6] bg-[#F2F2F2] p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-[#003A6B]">
              Change password
            </h2>
            <form onSubmit={onChangePassword}>
              <label
                htmlFor="current_password"
                className="block text-sm font-medium text-[#313131]"
              >
                Current password
              </label>
              <Input
                id="current_password"
                type="password"
                className="mt-1 border-[#6897B8] bg-white text-[#313131] placeholder:text-[#4F7392] focus-visible:border-[#174585] focus-visible:ring-[#174585]/30"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />

              <label
                htmlFor="new_password"
                className="mt-4 block text-sm font-medium text-[#313131]"
              >
                New password
              </label>
              <Input
                id="new_password"
                type="password"
                className="mt-1 border-[#6897B8] bg-white text-[#313131] placeholder:text-[#4F7392] focus-visible:border-[#174585] focus-visible:ring-[#174585]/30"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setError(null);
                }}
              />
              <p className="mt-2 text-xs text-[#4F7392]">
                New password must be at least 8 characters.
              </p>

              <label
                htmlFor="confirm_password"
                className="mt-4 block text-sm font-medium text-[#313131]"
              >
                Confirm password
              </label>
              <Input
                id="confirm_password"
                type="password"
                className="mt-1 border-[#6897B8] bg-white text-[#313131] placeholder:text-[#4F7392] focus-visible:border-[#174585] focus-visible:ring-[#174585]/30"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError(null);
                }}
              />

              <div className="mt-4">
                <Button
                  type="submit"
                  variant="default"
                  className="bg-[#003A6B] text-white hover:bg-[#002354]"
                  disabled={isChangePasswordDisabled}
                >
                  {changingPassword
                    ? "Changing password..."
                    : "Change password"}
                </Button>
              </div>
            </form>
          </section>
        </div>

        {message && (
          <div
            className="mt-6 rounded-md border border-[#06B050]/40 bg-[#06B050]/10 p-3 text-[#103364]"
            role="status"
            aria-live="polite"
          >
            {message}
          </div>
        )}

        {error && (
          <div
            className="mt-6 rounded-md border border-[#C00000]/40 bg-[#C00000]/10 p-3 text-[#C00000]"
            role="alert"
          >
            {error}
          </div>
        )}
      </main>
    </div>
  );
};

export default ProfilePage;
