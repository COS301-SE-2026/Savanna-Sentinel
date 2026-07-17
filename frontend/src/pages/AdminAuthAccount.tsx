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
import { usersApi } from "@/services/usersApi";
import { cn, formatRole } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useSort } from "@/hooks/useSort";
import {
    useRoleOptions,
    useUserSearchFilter,
} from "@/hooks/useUserSearchFilter";
import { SortableTableHead } from "@/components/admin/SortableTableHead";
import { UserSearchFilterBar } from "@/components/admin/UserSearchFilterBar";
import {
    theadClass,
    cellClass,
    rowClass,
} from "@/components/admin/userTableStyles";

export interface UserResponse {
    id: string;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    is_active: boolean;
    created_at: string;
}
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

const AuthPage = () => {
    const [users, setUsers] = useState<UserResponse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [pageError, setPageError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState<string[]>([]);

    const fetchPendingUsers = async () => {
        setIsLoading(true);
        setPageError(null);

        try {
            const data = await usersApi.getPendingUsers();
            setUsers(data.results);
        } catch (error) {
            console.error("Failed to fetch users:", error);
            setPageError("Failed to load pending registrations.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        Promise.resolve().then(() => {
            fetchPendingUsers();
        });
    }, []);

    const roleOptions = useRoleOptions(users);
    const filteredUsers = useUserSearchFilter(users, search, roleFilter);

    const {
        sorted: sortedUsers,
        sortKey,
        direction,
        requestSort,
    } = useSort<UserResponse, SortKey>(filteredUsers, sortAccessors);

    if (isLoading) {
        return (
            <div className="py-10 text-sm text-color-text-secondary">
                Loading pending users...
            </div>
        );
    }
    if (pageError) {
        return (
            <div className="py-10 text-sm text-status-critical-text">
                {pageError}
            </div>
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
                            <SortableTableHead
                                label="Username"
                                active={sortKey === "username"}
                                direction={direction}
                                onSort={() => requestSort("username")}
                            />
                            <SortableTableHead
                                label="Name"
                                active={sortKey === "name"}
                                direction={direction}
                                onSort={() => requestSort("name")}
                            />
                            <SortableTableHead
                                label="Role Claim"
                                active={sortKey === "role"}
                                direction={direction}
                                onSort={() => requestSort("role")}
                            />
                            <SortableTableHead
                                label="Created At"
                                active={sortKey === "created_at"}
                                direction={direction}
                                onSort={() => requestSort("created_at")}
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
    const [rowError, setRowError] = useState<string | null>(null);
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
        setRowError(null);

        try {
            await usersApi.setUserStatus(user.id, true);
            //Refresh the list
            refreshList();
        } catch (error: unknown) {
            console.error("Failed to activate user:", error);

            const err = error as { response?: { status?: number } };
            if (err.response?.status === 401) {
                setRowError("Permission denied. Cannot modify admins");
            } else {
                setRowError("Failed to accept user.");
            }
            setIsProcessing(false);
        }
    };

    const handleReject = async () => {
        setPendingAction(null);
        setIsProcessing(true);
        setRowError(null);

        try {
            await usersApi.deleteUser(user.id);
            refreshList();
        } catch (error) {
            console.error("Failed to reject user:", error);
            setRowError("Failed to reject user.");
            setIsProcessing(false);
        }
    };

    return (
        <>
            <TableRow className={rowClass}>
                <TableCell className={cn(cellClass, "font-medium")}>
                    {user.username}
                </TableCell>
                <TableCell className={cellClass}>
                    {`${user.first_name} ${user.last_name}`}
                </TableCell>
                <TableCell className={cellClass}>
                    <span className="rounded-full border-[1.5px] border-brand-muted bg-color-surface-bg px-2 py-0.5 text-xs font-semibold text-color-text-primary capitalize">
                        {formatRole(user.role)}
                    </span>
                </TableCell>
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

            {rowError && (
                <TableRow className={rowClass}>
                    <TableCell
                        colSpan={5}
                        className="px-4 py-2 text-sm text-status-critical-text bg-status-critical/5 italic"
                    >
                        {rowError}
                    </TableCell>
                </TableRow>
            )}
        </>
    );
};

export default AuthPage;
