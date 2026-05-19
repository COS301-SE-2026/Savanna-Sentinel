import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { Button } from "@/components/ui/button"
import { usersApi } from "@/services/usersApi";
import { useEffect, useState } from "react";

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
const AuthPage = () => {
    const [users, setUsers] = useState<UserResponse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [pageError, setPageError] = useState<string | null>(null);

    const fetchPendingUsers = async () => {
        setIsLoading(true);
        setPageError(null);

        try{
            const data = await usersApi.getPendingUsers();
            setUsers(data.results);
        }
        catch (error){
            console.error("Failed to fetch users:", error);
            setPageError("Failed to load pending registrations.");
        }
        finally{
            setIsLoading(false);
        }
    };

    useEffect(() => {
        Promise.resolve().then(() => {
            fetchPendingUsers();
        });
    }, []);

    if(isLoading){
        return <div className="p-6 md:p-10 text-sm text-muted-foreground">Loading pending users...</div>
    }
    if(pageError){
        return <div className="p-6 md:p-10 text-sm text-destructive">{pageError}</div>
    }

    return(
        <div className="max-w-7xl mx-auto p-6 md:p-10 space-y-6">
            <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                Pending Registrations
            </div>
            <div className="rounded-md border border-slate-200 dark:border-slate-800">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Username</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Role Claim</TableHead>
                            <TableHead>Created At</TableHead>
                            <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.length === 0 ?
                            (
                            <TableRow>
                                <TableCell colSpan={5}>No Pending Registrations found</TableCell>
                            </TableRow>
                            ) : 
                            (
                                users.map((user) => (
                                    <UserRow key={user.id} user={user} refreshList={fetchPendingUsers} />
                                ))
                            )
                        }
                    </TableBody>
                </Table>
            </div>
            
        </div>
    )
}

const UserRow = ({ user, refreshList}: UserRowProps) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [rowError, setRowError] = useState<string | null>(null);

    const handleAccept = async () => {
        setIsProcessing(true);
        setRowError(null);

        try{
            await usersApi.setUserStatus(user.id, true);
            refreshList(); //Refresh the list
        }
        catch (error: unknown){
            console.error("Failed to activate user:", error);

            const err = error as { response?: { status?: number } };
            if (err.response?.status === 401) {
                setRowError("Permission denied. Cannot modify admins");
            } 
            else {
                setRowError("Failed to accept user.");
            }
            setIsProcessing(false)
        }
    };

    const handleReject = async () => {
        setIsProcessing(true);
        setRowError(null);

        try{
            await usersApi.deleteUser(user.id);
            refreshList();
        }
        catch(error){
            console.error("Failed to reject user:", error);
            setRowError("Failed to reject user.");
            setIsProcessing(false);
        }
    };

    return(
        <>
            <TableRow>
                <TableCell className="font-medium">{user.username}</TableCell>
                <TableCell>{`${user.first_name} ${user.last_name}`}</TableCell>
                <TableCell>
                    <span className="capitalize px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                        {user.role}
                    </span></TableCell>
                <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-center">
                    <Button
                        variant="default"
                        onClick={handleAccept}
                        disabled={isProcessing}
                    >
                        Accept
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleReject}
                        disabled={isProcessing}
                    >
                        Reject
                    </Button>
                </TableCell>
            </TableRow>

            {rowError && (
                <TableRow>
                    <TableCell colSpan={5} className="text-sm text-red-500 bg-red-50/50 dark:bg-red-950/20 py-2 px-4 italic">
                        {rowError}
                    </TableCell>
                </TableRow>
            )}
        </>
        


    )
}

export default AuthPage