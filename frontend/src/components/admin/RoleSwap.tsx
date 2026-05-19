import { useEffect, useState } from "react";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow,} from "@/components/ui/table";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { usersApi, type UserResponse } from "@/services/usersApi";

const ASSIGNABLE_ROLES = [
  { value: "ranger", label: "Ranger" },
  { value: "analyst", label: "Analyst" },
  { value: "community_liaison", label: "Community Liaison" },
];

function formatRole(role: string) {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface UserRowProps {
  user: UserResponse;
  onRoleChanged: () => void;
}

function UserRow({ user, onRoleChanged }: UserRowProps) {
  const [selectedRole, setSelectedRole] = useState(user.role);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isDirty = selectedRole !== user.role;

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(false), 5000);
    return () => clearTimeout(t);
  }, [success]);

  const handleSave = async () => {
    setIsProcessing(true);
    setError(null);
    setSuccess(false);

    try {
      await usersApi.changeUserRole(user.id, selectedRole);
      setSuccess(true);
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
      <TableRow>
        <TableCell className="font-medium">{user.username}</TableCell>
        <TableCell>{`${user.first_name} ${user.last_name}`}</TableCell>
        <TableCell className="text-muted-foreground text-sm">{user.email}</TableCell>
        <TableCell>
          <span className="capitalize px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">
            {formatRole(user.role)}
          </span>
        </TableCell>
        <TableCell>
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSIGNABLE_ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <Button
            variant="default"
            size="sm"
            disabled={!isDirty || isProcessing}
            onClick={handleSave}
          >
            {isProcessing ? "Saving..." : "Save"}
          </Button>
        </TableCell>
      </TableRow>

      {(error || success) && (
        <TableRow>
          <TableCell
            colSpan={6}
            className={`text-xs py-1.5 px-4 italic ${
              error
                ? "text-destructive bg-destructive/5"
                : "text-spot-green bg-spot-green/10"
            }`}
          >
            {error ?? `Role updated to ${formatRole(selectedRole)}.`}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function RoleSwap() {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      const data = await usersApi.getActiveUsers();
      setUsers(data.results);
    } catch {
      // silent on refresh
    }
  };

  useEffect(() => {
    usersApi.getActiveUsers()
      .then((data) => { setUsers(data.results); })
      .catch(() => setPageError("Failed to load users."))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return <div className="p-6 md:p-10 text-sm text-muted-foreground">Loading users...</div>;
  }

  if (pageError) {
    return <div className="p-6 md:p-10 text-sm text-destructive">{pageError}</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-10 space-y-6">
      <div className="text-2xl font-bold tracking-tight text-primary">
        Role Management
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Current Role</TableHead>
              <TableHead>Assign Role</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No active users found.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <UserRow key={user.id} user={user} onRoleChanged={fetchUsers} />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
