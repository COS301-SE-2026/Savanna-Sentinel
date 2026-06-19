import React, { useEffect, useState } from "react";
import { usersApi } from "@/services/usersApi";
import type { UserResponse } from "@/services/usersApi";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Eye, EyeOff } from "lucide-react";
import {
  Card,
  CardDescription,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
  const profileUsername = profile?.username ?? "";
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
      setFirstName(updated.first_name ?? "");
      setLastName(updated.last_name ?? "");
      setIsEditingProfile(false);
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
    if (!isEditingProfile || isSaveDisabled) return;
    setMessage(null);
    setError(null);
    setPendingAction("save-profile");
  };

  const startEditingProfile = () => {
    setMessage(null);
    setError(null);
    setIsEditingProfile(true);
  };

  const cancelEditingProfile = () => {
    setFirstName(profileFirstName);
    setLastName(profileLastName);
    setIsEditingProfile(false);
    setMessage(null);
    setError(null);
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
    <div className="min-h-screen bg-brand-off-white text-spot-dark-grey">
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Dialog
          open={isConfirmDialogOpen}
          onOpenChange={(open: boolean) => !open && setPendingAction(null)}
        >
          <DialogContent
            showCloseButton={!isConfirming}
            className="max-w-lg rounded-xl border border-brand-light-grey bg-brand-off-white p-0 shadow-[0_18px_40px_rgba(0,35,84,0.18)]"
          >
            <DialogHeader className="bg-brand-dark-blue text-white rounded-t-xl p-5">
              <DialogTitle className="text-white">
                {confirmDialogTitle}
              </DialogTitle>
              <DialogDescription className="text-brand-light-grey">
                {confirmDialogBody}
              </DialogDescription>
            </DialogHeader>
            {pendingAction === "save-profile" ? (
              <div className="px-5 pb-5 pt-4 text-sm text-spot-dark-grey">
                <div className="mb-3 font-medium text-brand-royal-blue">
                  Changes to be applied:
                </div>
                <div className="space-y-2 rounded-md border border-brand-light-grey bg-white p-3">
                  {profileChanges.map((change) => (
                    <div
                      key={change.label}
                      className="grid grid-cols-[96px_1fr_auto_1fr] items-center gap-2 text-sm"
                    >
                      <span className="font-medium text-brand-dark-blue">
                        {change.label}
                      </span>
                      <span className="rounded bg-brand-off-white px-2 py-1 text-spot-dark-grey">
                        {change.from === "" ? "Empty" : change.from}
                      </span>
                      <span
                        className="text-brand-steel-blue"
                        aria-hidden="true"
                      >
                        →
                      </span>
                      <span className="rounded bg-brand-light-grey/60 px-2 py-1 text-brand-dark-blue">
                        {change.to === "" ? "Empty" : change.to}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-spot-dark-grey">
                  Please click{" "}
                  <span className="font-semibold text-brand-dark-blue">
                    Confirm changes
                  </span>{" "}
                  to apply the update.
                </p>
              </div>
            ) : (
              <div className="px-5 pb-5 pt-4 text-sm text-spot-dark-grey">
                Please click{" "}
                <span className="font-semibold text-brand-dark-blue">
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
                className="border-brand-dark-blue text-brand-dark-blue hover:bg-brand-light-grey/60"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="default"
                onClick={handleConfirmChanges}
                disabled={isConfirming}
                className="bg-brand-dark-blue text-white hover:bg-brand-navy"
              >
                {isConfirming ? "Applying changes..." : "Confirm changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="pb-8">
          <h1 className="text-2xl font-bold tracking-tight text-brand-dark-blue">
            Account settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your profile and update your password.
          </p>
        </div>

        <Card className="border-brand-light-grey shadow-sm">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-brand-dark-blue text-white flex items-center justify-center text-lg font-semibold shrink-0 select-none">
                {loadingProfile
                  ? ""
                  : `${profile?.first_name?.[0] ?? ""} ${profile?.last_name?.[0] ?? ""}`.trim() ||
                    "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg font-semibold text-spot-dark-grey">
                    {profile?.first_name} {profile?.last_name}
                  </span>
                  <Badge variant="secondary" className="capitalize">
                    {profile?.role || "Not set"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {profile?.email}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 pt-6 md:grid-cols-2">
          <Card className="gap-0 rounded-md border border-brand-light-grey bg-white shadow-sm">
            <CardHeader className="space-y-1 px-6 pt-6 pb-4">
              <CardTitle className="text-lg font-semibold text-brand-dark-blue">
                Personal details
              </CardTitle>
              <CardDescription className="text-sm text-brand-grey-blue">
                Make your changes, then save to confirm.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-8">
              {loadingProfile ? (
                <p className="text-sm text-brand-grey-blue">
                  Loading profile...
                </p>
              ) : (
                <form onSubmit={onSaveProfile}>
                  <div className="space-y-4">
                    <div>
                      <Label
                        htmlFor="username"
                        className="block text-sm font-medium text-spot-dark-grey"
                      >
                        Username
                      </Label>
                      <div className="mt-1">
                        <Input
                          id="username"
                          value={profileUsername}
                          disabled
                          className="h-10 border-brand-steel-blue bg-white text-spot-dark-grey placeholder:text-brand-grey-blue focus-visible:border-brand-royal-blue focus-visible:ring-brand-royal-blue/30 disabled:text-gray-400 disabled:border-brand-light-grey disabled:opacity-100 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>

                    <div>
                      <Label
                        htmlFor="first_name"
                        className="block text-sm font-medium text-spot-dark-grey"
                      >
                        First name
                      </Label>
                      <div className="mt-1">
                        <Input
                          id="first_name"
                          disabled={!isEditingProfile}
                          className="h-10 border-brand-steel-blue bg-white text-spot-dark-grey placeholder:text-brand-grey-blue focus-visible:border-brand-royal-blue focus-visible:ring-brand-royal-blue/30 disabled:text-gray-400 disabled:border-brand-light-grey disabled:opacity-100 disabled:cursor-not-allowed"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <Label
                        htmlFor="last_name"
                        className="block text-sm font-medium text-spot-dark-grey"
                      >
                        Last name
                      </Label>
                      <div className="mt-1">
                        <Input
                          id="last_name"
                          disabled={!isEditingProfile}
                          className="h-10 border-brand-steel-blue bg-white text-spot-dark-grey placeholder:text-brand-grey-blue focus-visible:border-brand-royal-blue focus-visible:ring-brand-royal-blue/30 disabled:text-gray-400 disabled:border-brand-light-grey disabled:opacity-100 disabled:cursor-not-allowed"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator className="my-5 bg-brand-light-grey" />

                  <div className="flex items-center gap-3">
                    {!isEditingProfile ? (
                      <Button
                        type="button"
                        variant="default"
                        className="bg-brand-dark-blue text-white hover:bg-brand-navy"
                        onClick={startEditingProfile}
                      >
                        Edit
                      </Button>
                    ) : (
                      <>
                        <Button
                          type="submit"
                          variant="default"
                          className="bg-brand-dark-blue text-white hover:bg-brand-navy"
                          disabled={isSaveDisabled}
                        >
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="border-brand-royal-blue text-brand-royal-blue hover:bg-brand-light-grey/60"
                          onClick={cancelEditingProfile}
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          <Card className="gap-0 rounded-md border border-brand-light-grey bg-white shadow-sm">
            <CardHeader className="space-y-1 px-6 pt-6 pb-4">
              <CardTitle className="text-lg font-semibold text-brand-dark-blue">
                Change password
              </CardTitle>
              <CardDescription className="text-sm text-brand-grey-blue">
                You will be signed out after a successful change.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-8">
              <form onSubmit={onChangePassword}>
                <div className="space-y-4">
                  <div>
                    <Label
                      htmlFor="current_password"
                      className="block text-sm font-medium text-spot-dark-grey"
                    >
                      Current password
                    </Label>
                    <div className="relative mt-1">
                      <Input
                        id="current_password"
                        type={showCurrentPassword ? "text" : "password"}
                        className="h-10 pr-10 border-brand-steel-blue bg-white text-spot-dark-grey placeholder:text-brand-grey-blue focus-visible:border-brand-royal-blue focus-visible:ring-brand-royal-blue/30 disabled:text-gray-400 disabled:border-brand-light-grey disabled:opacity-100 disabled:cursor-not-allowed"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex size-8 items-center justify-center rounded-md text-brand-grey-blue transition-colors hover:bg-brand-light-grey/60 hover:text-brand-dark-blue"
                        onClick={() =>
                          setShowCurrentPassword((visible) => !visible)
                        }
                        aria-label={
                          showCurrentPassword
                            ? "Hide current password"
                            : "Show current password"
                        }
                        aria-pressed={showCurrentPassword}
                      >
                        {showCurrentPassword ? <EyeOff /> : <Eye />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label
                      htmlFor="new_password"
                      className="block text-sm font-medium text-spot-dark-grey"
                    >
                      New password
                    </Label>
                    <div className="relative mt-1">
                      <Input
                        id="new_password"
                        type={showNewPassword ? "text" : "password"}
                        className="h-10 pr-10 border-brand-steel-blue bg-white text-spot-dark-grey placeholder:text-brand-grey-blue focus-visible:border-brand-royal-blue focus-visible:ring-brand-royal-blue/30 disabled:text-gray-400 disabled:border-brand-light-grey disabled:opacity-100 disabled:cursor-not-allowed"
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          setError(null);
                        }}
                      />
                      <button
                        type="button"
                        className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex size-8 items-center justify-center rounded-md text-brand-grey-blue transition-colors hover:bg-brand-light-grey/60 hover:text-brand-dark-blue"
                        onClick={() =>
                          setShowNewPassword((visible) => !visible)
                        }
                        aria-label={
                          showNewPassword
                            ? "Hide new password"
                            : "Show new password"
                        }
                        aria-pressed={showNewPassword}
                      >
                        {showNewPassword ? <EyeOff /> : <Eye />}
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-brand-grey-blue">
                      Min. 8 characters & must differ from current password
                    </p>
                  </div>

                  <div>
                    <Label
                      htmlFor="confirm_password"
                      className="block text-sm font-medium text-spot-dark-grey"
                    >
                      Confirm password
                    </Label>
                    <div className="relative mt-1">
                      <Input
                        id="confirm_password"
                        type={showConfirmPassword ? "text" : "password"}
                        className="h-10 pr-10 border-brand-steel-blue bg-white text-spot-dark-grey placeholder:text-brand-grey-blue focus-visible:border-brand-royal-blue focus-visible:ring-brand-royal-blue/30 disabled:text-gray-400 disabled:border-brand-light-grey disabled:opacity-100 disabled:cursor-not-allowed"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setError(null);
                        }}
                      />
                      <button
                        type="button"
                        className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex size-8 items-center justify-center rounded-md text-brand-grey-blue transition-colors hover:bg-brand-light-grey/60 hover:text-brand-dark-blue"
                        onClick={() =>
                          setShowConfirmPassword((visible) => !visible)
                        }
                        aria-label={
                          showConfirmPassword
                            ? "Hide confirm password"
                            : "Show confirm password"
                        }
                        aria-pressed={showConfirmPassword}
                      >
                        {showConfirmPassword ? <EyeOff /> : <Eye />}
                      </button>
                    </div>
                  </div>
                </div>

                <Separator className="my-5 bg-brand-light-grey" />

                <div className="flex items-center gap-3">
                  <Button
                    type="submit"
                    variant="default"
                    className="bg-brand-dark-blue text-white hover:bg-brand-navy"
                    disabled={isChangePasswordDisabled}
                  >
                    Change Password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {message && (
          <div
            className="mt-6 rounded-md border border-spot-green/40 bg-spot-green/10 p-3 text-spot-navy"
            role="status"
            aria-live="polite"
          >
            {message}
          </div>
        )}

        {error && (
          <div
            className="mt-6 rounded-md border border-spot-red/40 bg-spot-red/10 p-3 text-spot-red"
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
