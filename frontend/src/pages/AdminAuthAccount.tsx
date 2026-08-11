import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { usersApi, type UserResponse } from "@/services/usersApi";
import { cn, formatRole } from "@/lib/utils";
import { notifyCritical } from "@/components/ui/toast";
import { useState } from "react";
import { useManagedUsers } from "@/hooks/useManagedUsers";
import { UserSearchFilterBar } from "@/components/admin/UserSearchFilterBar";
import { UserTableStatus } from "@/components/admin/UserTableStatus";
import { SortableColumns } from "@/components/admin/SortableColumns";
import {
    UsernameCell,
    NameCell,
    RoleBadgeCell,
} from "@/components/admin/UserIdentityCells";
import { theadClass, cellClass, rowClass } from "@/components/ui/table-styles";

interface UserRowProps {
    user: UserResponse;
    refreshList: () => void;
}

type SortKey = "username" | "name" | "role" | "created_at";

const sortAccessors: Record<SortKey, (user: UserResponse) => string | number> =
    {
        username: (user) => user.username.toLowerCase(),
        name: (user) => `${user.first_name} ${user.last_name}`.toLowerCase(),
        role: (user) => user.role.toLowerCase(),
        ["created_at"]: (user) => new Date(user.created_at).getTime(),
    };

const PENDING_USER_COLUMNS: { key: SortKey; label: string }[] = [
    { key: "username", label: "Username" },
    { key: "name", label: "Name" },
    { key: "role", label: "Role Claim" },
    { key: "created_at", label: "Created At" },
];

const AuthPage = () => {
    const {
        users,
        isLoading,
        pageError,
        search,
        setSearch,
        roleFilter,
        setRoleFilter,
        roleOptions,
        sortedUsers,
        sortKey,
        direction,
        requestSort,
        refetch: fetchPendingUsers,
    } = useManagedUsers(usersApi.getPendingUsers, sortAccessors, {
        errorMessage: "Failed to load pending registrations.",
        onError: (error) => console.error("Failed to fetch users:", error),
    });

    if (isLoading || pageError) {
        return (
            <UserTableStatus
                isLoading={isLoading}
                pageError={pageError}
                loadingText="Loading pending users..."
            />
        );
    }

    return (
        <div className="space-y-4">
            <div className="font-heading text-2xl leading-[1.15] font-bold text-brand-primary">
                Pending Registrations
            </div>

            <UserSearchFilterBar
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search pending registrations..."
                roleOptions={roleOptions}
                selectedRoles={roleFilter}
                onRolesChange={setRoleFilter}
            />

            <div className="overflow-hidden rounded-lg border border-color-border bg-color-surface-raised shadow-sm">
                <Table>
                    <TableHeader className="bg-brand-primary">
                        <TableRow className="hover:bg-transparent">
                            <SortableColumns
                                columns={PENDING_USER_COLUMNS}
                                sortKey={sortKey}
                                direction={direction}
                                requestSort={requestSort}
                            />
                            <TableHead
                                className={cn(theadClass, "text-center")}
                            >
                                Actions
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedUsers.length === 0 ? (
                            <TableRow className={rowClass}>
                                <TableCell colSpan={5} className={cellClass}>
                                    {users.length === 0
                                        ? "No Pending Registrations found"
                                        : "No registrations match your search or filters."}
                                </TableCell>
                            </TableRow>
                        ) : (
                            sortedUsers.map((user) => (
                                <UserRow
                                    key={user.id}
                                    user={user}
                                    refreshList={fetchPendingUsers}
                                />
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

const UserRow = ({ user, refreshList }: UserRowProps) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [pendingAction, setPendingAction] = useState<
        "accept" | "reject" | null
    >(null);

    const [dialogAction, setDialogAction] = useState<"accept" | "reject">(
        "accept",
    );
    if (pendingAction !== null && pendingAction !== dialogAction) {
        setDialogAction(pendingAction);
    }

    const fullName = `${user.first_name} ${user.last_name}`;

    const handleAccept = async () => {
        setPendingAction(null);
        setIsProcessing(true);

        try {
            await usersApi.setUserStatus(user.id, true);
            //Refresh the list
            refreshList();
        } catch (error: unknown) {
            console.error("Failed to activate user:", error);

            const err = error as { response?: { status?: number } };
            if (err.response?.status === 401) {
                notifyCritical("Permission denied. Cannot modify admins");
            } else {
                notifyCritical("Failed to accept user.");
            }
            setIsProcessing(false);
        }
    };

    const handleReject = async () => {
        setPendingAction(null);
        setIsProcessing(true);

        try {
            await usersApi.deleteUser(user.id);
            refreshList();
        } catch (error) {
            console.error("Failed to reject user:", error);
            notifyCritical("Failed to reject user.");
            setIsProcessing(false);
        }
    };

    return (
        <>
            <TableRow className={rowClass}>
                <UsernameCell value={user.username} />
                <NameCell value={fullName} />
                <RoleBadgeCell role={user.role} />
                <TableCell
                    className={cn(
                        cellClass,
                        "text-sm text-color-text-secondary",
                    )}
                >
                    {new Date(user.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className={cn(cellClass, "text-center")}>
                    <Button
                        variant="default"
                        onClick={() => setPendingAction("accept")}
                        disabled={isProcessing}
                    >
                        Accept
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={() => setPendingAction("reject")}
                        disabled={isProcessing}
                        className="ml-2"
                    >
                        Reject
                    </Button>
                </TableCell>
            </TableRow>

            <Dialog
                open={pendingAction !== null}
                onOpenChange={(open) =>
                    !isProcessing && !open && setPendingAction(null)
                }
            >
                <DialogContent preventBackdropClose={dialogAction === "reject"}>
                    <DialogHeader>
                        <DialogTitle>
                            {dialogAction === "reject"
                                ? "Confirm rejection"
                                : "Confirm approval"}
                        </DialogTitle>
                    </DialogHeader>
                    <DialogDescription>
                        {dialogAction === "reject"
                            ? `Reject ${fullName}'s registration? This permanently removes their pending account.`
                            : `Approve ${fullName} as ${formatRole(user.role)}?`}
                    </DialogDescription>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setPendingAction(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant={
                                dialogAction === "reject"
                                    ? "destructive"
                                    : "default"
                            }
                            onClick={
                                dialogAction === "reject"
                                    ? handleReject
                                    : handleAccept
                            }
                        >
                            Confirm
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default AuthPage;
