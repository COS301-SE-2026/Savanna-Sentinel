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
    }

    return(
        <TableRow>
            <TableCell>{data.username}</TableCell>
            <TableCell>{data.role}</TableCell>
            <TableCell>{data.created}</TableCell>
            <TableCell>
                <Button>Accept</Button>
                <Button>Reject</Button>
            </TableCell>
        </TableRow>
    )
}

export default AuthPage