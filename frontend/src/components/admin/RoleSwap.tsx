import { useEffect, useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Select } from "@/components/ui/select";
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

const ASSIGNABLE_ROLES = [
    { value: "ranger", label: "Ranger" },
    { value: "analyst", label: "Analyst" },
    { value: "community_liaison", label: "Community Liaison" },
];

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
    onRoleChanged: () => void;
}

export const UserRow = ({ user, onRoleChanged }: UserRowProps) => {
    const [selectedRole, setSelectedRole] = useState(user.role);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSuccessful, setSuccessful] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);

    const isDirty = selectedRole !== user.role;
    const fullName = `${user.first_name} ${user.last_name}`;

    useEffect(() => {
        if (!isSuccessful) return;
        const t = setTimeout(() => setSuccessful(false), 5000);
        return () => clearTimeout(t);
    }, [isSuccessful]);

    const handleApply = () => {
        if (!isDirty || isProcessing) return;
        setIsConfirmOpen(true);
    };

    const handleConfirm = async () => {
        setIsConfirmOpen(false);
        setIsProcessing(true);
        setError(null);
        setSuccessful(false);

        try {
            await usersApi.changeUserRole(user.id, selectedRole);
            setSuccessful(true);
            onRoleChanged();
        } catch {
            setError("Failed to update role.");
            setSelectedRole(user.role);
        } finally {
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
                    <Select
                        className="w-44"
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value)}
                    >
                        {ASSIGNABLE_ROLES.map((r) => (
                            <option key={r.value} value={r.value}>
                                {r.label}
                            </option>
                        ))}
                    </Select>
                </TableCell>
                <TableCell className={cellClass}>
                    <Button
                        variant="default"
                        disabled={!isDirty || isProcessing}
                        onClick={handleApply}
                    >
                        {isProcessing ? "Applying..." : "Apply"}
                    </Button>
                </TableCell>
            </TableRow>

            <Dialog
                open={isConfirmOpen}
                onOpenChange={(open) => !isProcessing && setIsConfirmOpen(open)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm role change</DialogTitle>
                    </DialogHeader>
                    <DialogDescription>
                        Update {fullName} from {formatRole(user.role)} to{" "}
                        {formatRole(selectedRole)}?
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
                            variant="default"
                            onClick={handleConfirm}
                        >
                            Confirm
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {(error || isSuccessful) && (
                <TableRow className={rowClass}>
                    <TableCell
                        colSpan={6}
                        className={cn(
                            "px-4 py-1.5 text-xs italic",
                            error
                                ? "text-status-critical-text bg-status-critical/5"
                                : "text-status-safe-text bg-status-safe/10",
                        )}
                    >
                        {error ??
                            `Role updated to ${formatRole(selectedRole)}.`}
                    </TableCell>
                </TableRow>
            )}
        </>
    );
};

export const RoleSwap = () => {
    const [users, setUsers] = useState<UserResponse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [pageError, setPageError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState<string[]>([]);

    const fetchUsers = async () => {
        try {
            const data = await usersApi.getActiveUsers();
            setUsers(data.results);
        } catch {
            // silent on refresh
        }
    };

    useEffect(() => {
        usersApi
            .getActiveUsers()
            .then((data) => {
                setUsers(data.results);
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
                Role Management
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
                                Assign Role
                            </TableHead>
                            <TableHead className={theadClass} />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedUsers.length === 0 ? (
                            <TableRow className={rowClass}>
                                <TableCell
                                    colSpan={6}
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
                                <UserRow
                                    key={user.id}
                                    user={user}
                                    onRoleChanged={fetchUsers}
                                />
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default RoleSwap;
