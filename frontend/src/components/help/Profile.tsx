import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

export default function Profile() {
    const [password, setPassword] = useState("");
    const [msg, setMsg] = useState("");

    const handleCheckPassword = () => {
        if (password.length >= 8) {
            setMsg("The password you entered would be valid");
            return;
        }

        if (password.length == 0) {
            setMsg("Please enter a password before trying again");
            return;
        }
        
        setMsg(`The password you entered is not valid; Passwords must be at least 8 characters long. The Password you entered is ${password.length} characters long`);
    };

    return (
        <div className="space-y-5">
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl text-brand-primary">
                        Profile Page
                    </CardTitle>
                    <CardDescription className="text-base text-color-surface-deep">
                        Update your name details or change your password from this
                        page.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-5">
                    <div>
                        <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                            Your Profile Details
                        </CardTitle>
                        <p className="text-base">
                            In this section you can update your name and/or surname and then you would:
                        </p>
                        <ul className="text-base pl-6">
                            <li>Click the Save button which applies the changes to your profile,</li>
                            <li>Or click the Reset button which would discard your currently pending changes.</li>
                        </ul>
                    </div>

                    <div>
                        <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                            Changing your Password
                        </CardTitle>
                        <p className="text-base">
                            For each input field in order:
                        </p>
                        <ol className="text-base list-disc list-inside pl-6">
                            <li>Enter your current password</li>
                            <li>Enter a new password that does not match your current password</li>
                            <li>Confirm your new password by re-entering it</li>
                        </ol>
                    </div>

                    <div>
                        <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                            Password Rules
                        </CardTitle>
                        <div className="space-y-4">
                            <p className="text-base">
                                Password changes require all fields to be filled, the
                                new password to meet the length requirement of 8 characters 
                                and must not be equal to the current password, and the
                                confirmation field to match the new password.
                            </p>

                            <p className="text-base">
                                You can test if a password would be valid by using the input below
                            </p>

                            <div className="flex items-center gap-4 w-full pl-6">
                                <div className="flex-1 flex items-center gap-2">
                                    <Button onClick={handleCheckPassword}>
                                        Check Password
                                    </Button>

                                    <Input 
                                        className="flex-1"
                                        placeholder={"Enter a password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>

                                <p className="flex-1 text-base">
                                    {msg}
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Button>
                <Link to="/profile">
                    Click me to go to your profile
                </Link>
            </Button>
        </div>
    );
}