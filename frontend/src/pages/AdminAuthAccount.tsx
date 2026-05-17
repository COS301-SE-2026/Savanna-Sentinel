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

    useEffect(() => {
        fetchPendingUsers();
    }, []);

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

    if(isLoading){
        return <div className="">Loading pending users...</div>
    }
    if(pageError){
        return <div className="">{pageError}</div>
    }

    return(
        <div className="">
            <div className="">
                Pending Registrations
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Role Claim</TableHead>
                        <TableHead>Created At</TableHead>
                        <TableHead>Actions</TableHead>
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
        catch (error: any){
            console.error("Failed to activate user:", error);

            if(error.response?.status == 401){
                setRowError("Permission denied. Cannot modify admins");
            }
            else{
                setRowError("Failed to accept user");
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
                <TableCell>{user.username}</TableCell>
                <TableCell>{`${user.first_name} ${user.last_name}`}</TableCell>
                <TableCell>{user.role}</TableCell>
                <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                <TableCell>
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
                    <TableCell colSpan={5} className="text-sm text-red-500 bg-red-50/50 py-2">
                        {rowError}
                    </TableCell>
                </TableRow>
            )}
        </>
        


    )
}

export default AuthPage