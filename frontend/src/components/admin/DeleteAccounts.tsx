import { useEffect, useState } from "react";
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
import { cn, formatRole } from "@/lib/utils";
import { usersApi, type UserResponse } from "@/services/usersApi";
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

type SortKey = "username" | "name" | "email" | "role";

const sortAccessors: Record<SortKey, (user: UserResponse) => string | number> =
    {
        username: (user) => user.username.toLowerCase(),
        name: (user) => `${user.first_name} ${user.last_name}`.toLowerCase(),
        email: (user) => user.email.toLowerCase(),
        role: (user) => user.role.toLowerCase(),
    };

interface UserRowProps {
    user: UserResponse;
}

export const UserRow = ({ user }: UserRowProps) => {
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);

    const fullName = `${user.first_name} ${user.last_name}`;

    const handleConfirm = () => {
        setIsConfirmOpen(false);
        // soft delete endpoint
    };

    return (
        <>
            <TableRow className={rowClass}>
                <TableCell className={cn(cellClass, "font-medium")}>
                    {user.username}
                </TableCell>
                <TableCell className={cellClass}>{fullName}</TableCell>
                <TableCell
                    className={cn(
                        cellClass,
                        "text-sm text-color-text-secondary",
                    )}
                >
                    {user.email}
                </TableCell>
                <TableCell className={cellClass}>
                    <span className="rounded-full border-[1.5px] border-brand-muted bg-color-surface-bg px-2 py-0.5 text-xs font-semibold text-color-text-primary capitalize">
                        {formatRole(user.role)}
                    </span>
                </TableCell>
                <TableCell className={cellClass}>
                    <Button
                        variant="destructive"
                        onClick={() => setIsConfirmOpen(true)}
                    >
                        Delete
                    </Button>
                </TableCell>
            </TableRow>

            <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                <DialogContent preventBackdropClose>
                    <DialogHeader>
                        <DialogTitle>Confirm deletion</DialogTitle>
                    </DialogHeader>
                    <DialogDescription>
                        Delete {fullName}&apos;s account? This action cannot be
                        undone.
                    </DialogDescription>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsConfirmOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleConfirm}
                        >
                            Confirm
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export const DeleteAccounts = () => {
    const [users, setUsers] = useState<UserResponse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [pageError, setPageError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState<string[]>([]);

    useEffect(() => {
        usersApi
            .getActiveUsers()
            .then((data) => {
                setUsers(data.results.filter((u) => u.role !== "admin"));
            })
            .catch(() => setPageError("Failed to load users."))
            .finally(() => setIsLoading(false));
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
                Loading users...
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
                Delete Accounts
            </div>

            <UserSearchFilterBar
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search active users..."
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
                                label="Email"
                                active={sortKey === "email"}
                                direction={direction}
                                onSort={() => requestSort("email")}
                            />
                            <SortableTableHead
                                label="Current Role"
                                active={sortKey === "role"}
                                direction={direction}
                                onSort={() => requestSort("role")}
                            />
                            <TableHead className={theadClass}>
                                Actions
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedUsers.length === 0 ? (
                            <TableRow className={rowClass}>
                                <TableCell
                                    colSpan={5}
                                    className={cn(
                                        cellClass,
                                        "text-center text-color-text-secondary",
                                    )}
                                >
                                    {users.length === 0
                                        ? "No active users found."
                                        : "No users match your search or filters."}
                                </TableCell>
                            </TableRow>
                        ) : (
                            sortedUsers.map((user) => (
                                <UserRow key={user.id} user={user} />
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default DeleteAccounts;
