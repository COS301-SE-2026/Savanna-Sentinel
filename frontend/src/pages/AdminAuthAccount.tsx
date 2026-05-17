import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { Button } from "@/components/ui/button"

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

const User = ({ data }: UserCardProps) => {
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