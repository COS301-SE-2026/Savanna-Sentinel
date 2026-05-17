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

interface UserData{
    "username": string,
    "role": string,
    "created": string
}
interface UserCardProps {
    data: UserData;
}

const AuthPage = () => {
    const testArray : UserData[]= [
        {
            "username": "Test 1",
            "role": "Ranger",
            "created": "2026-05-15",
        },
        {
            "username": "12-390124889134yu13984eoi13je0iko13qwjdnoqiujkewf qneikpfcnuoe3jfniqwsdfjiakosfeuiowfjakfosiaedkfhiawekfoelasdfiokaldsfasifdoklamsdfc",
            "role": "Ranger",
            "created": "2026-05-15",
        },
    ]

    return(
        <div className="">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Role Claim</TableHead>
                        <TableHead>Created At</TableHead>
                        <TableHead>Accept/Reject</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {testArray.map((e, index) => {
                        return(
                            <User key={index} data={e} />
                        )
                    })}
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
            //Delete the account
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