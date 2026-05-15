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
            Test Content
            {testArray.map((e, index) => {
                return(
                    <User key={index} data={e}/>
                )
            })}

        </div>
    )
}

const User = ({ data }: UserCardProps) => {
    return(
        <div className="user">
            {data.username} {data.created} {data.role}
            
        </div>
    )
}

export default AuthPage