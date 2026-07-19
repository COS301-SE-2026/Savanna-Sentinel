import { useState } from "react";
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
import { cn } from "@/lib/utils";
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
import {
    theadClass,
    cellClass,
    rowClass,
} from "@/components/admin/userTableStyles";

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

const excludeAdmins = (results: UserResponse[]) =>
    results.filter((u) => u.role !== "admin");

export const DeleteAccounts = () => {
    const {
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
        users,
    } = useManagedUsers(usersApi.getActiveUsers, sortAccessors, {
        transform: excludeAdmins,
    });

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
                            <SortableColumns
                                columns={USER_COLUMNS}
                                sortKey={sortKey}
                                direction={direction}
                                requestSort={requestSort}
                            />
                            <TableHead className={theadClass}>
                                Actions
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedUsers.length === 0 ? (
                            <EmptyTableRow
                                colSpan={5}
                                message={
                                    users.length === 0
                                        ? "No active users found."
                                        : "No users match your search or filters."
                                }
                            />
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
