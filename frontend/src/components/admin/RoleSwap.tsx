import { useEffect, useState } from "react";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow,} from "@/components/ui/table";
import { usersApi, type UserResponse } from "@/services/usersApi";

export default function RoleSwap() {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const fetchUsers = async (showLoader = false) => {
    if (showLoader) setIsLoading(true);
    setPageError(null);
    try {
      const data = await usersApi.getActiveUsers();
      setUsers(data.results);
    } catch {
      setPageError("Failed to load users.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(true);
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
                <TableRow key={user.id}>
                  <TableCell colSpan={6}>{user.username}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
