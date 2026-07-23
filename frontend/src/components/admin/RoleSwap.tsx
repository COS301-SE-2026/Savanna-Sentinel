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
import { useManagedUsers } from "@/hooks/useManagedUsers";
import { UserSearchFilterBar } from "@/components/admin/UserSearchFilterBar";
import { UserTableStatus } from "@/components/admin/UserTableStatus";
import { SortableColumns } from "@/components/admin/SortableColumns";
import { EmptyTableRow } from "@/components/admin/EmptyTableRow";
import {
    UsernameCell,
    NameCell,
    RoleBadgeCell,
} from "@/components/admin/UserIdentityCells";
import {
    standardUserSortAccessors as sortAccessors,
    STANDARD_USER_COLUMNS as USER_COLUMNS,
} from "@/components/admin/standardUserColumns";
import { theadClass, cellClass, rowClass } from "@/components/ui/table-styles";

const ASSIGNABLE_ROLES = [
    { value: "ranger", label: "Ranger" },
    { value: "analyst", label: "Analyst" },
    { value: "community_liaison", label: "Community Liaison" },
];

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
                <UsernameCell value={user.username} />
                <NameCell value={fullName} />
                <TableCell
                    className={cn(
                        cellClass,
                        "text-sm text-color-text-secondary",
                    )}
                >
                    {user.email}
                </TableCell>
                <RoleBadgeCell role={user.role} />
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
    const {
        users,
        setUsers,
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
    } = useManagedUsers(usersApi.getActiveUsers, sortAccessors);

    const fetchUsers = async () => {
        try {
            const data = await usersApi.getActiveUsers();
            setUsers(data.results);
        } catch {
            // silent on refresh
        }
    };

    if (isLoading || pageError) {
        return (
            <UserTableStatus
                isLoading={isLoading}
                pageError={pageError}
                loadingText="Loading users..."
            />
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
                            <SortableColumns
                                columns={USER_COLUMNS}
                                sortKey={sortKey}
                                direction={direction}
                                requestSort={requestSort}
                            />
                            <TableHead className={theadClass}>
                                Assign Role
                            </TableHead>
                            <TableHead className={theadClass} />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedUsers.length === 0 ? (
                            <EmptyTableRow
                                colSpan={6}
                                message={
                                    users.length === 0
                                        ? "No active users found."
                                        : "No users match your search or filters."
                                }
                            />
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
