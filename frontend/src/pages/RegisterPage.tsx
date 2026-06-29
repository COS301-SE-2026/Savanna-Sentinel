import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AxiosError } from "axios";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { authApi } from "@/services/authApi";

const registerSchema = z.object({
    first_name: z.string().min(1, "First name is required"),
    last_name: z.string().min(1, "Last name is required"),
    username: z.string().min(1, "Username is required"),
    email: z.string().email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    requested_role: z.enum(["ranger", "analyst", "community_liaison"], {
        error: "Please select a role",
    }),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

const labelClass = "text-white md:text-primary text-sm font-medium";
const inputClass =
    "bg-input md:bg-card text-foreground placeholder:text-muted-foreground border-0 md:border md:border-border focus-visible:ring-2 focus-visible:ring-white/40 md:focus-visible:ring-ring/40";
const errorClass = "text-xs text-red-300 md:text-destructive";

function BrandPanel() {
    return (
        <div className="hidden md:flex md:w-1/2 bg-brand-navy flex-col items-center justify-center gap-6 px-12">
            <img
                src="/icons/SavannaSentinelLogo.png"
                alt="Savanna Sentinel Logo"
                className="w-64 h-auto"
            />
            <p className="text-white/50 text-xs tracking-[0.22em] uppercase text-center">
                Wildlife Conservation Monitoring
            </p>
        </div>
    );
}

const RegisterPage = () => {
    const [showPassword, setShowPassword] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);
    const [isSuccessful, setSuccessful] = useState(false);

    const {
        register,
        handleSubmit,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<RegisterFormValues>({
        resolver: zodResolver(registerSchema),
    });

    async function onSubmit(values: RegisterFormValues) {
        setServerError(null);
        try {
            await authApi.register(values);
            setSuccessful(true);
        } catch (err) {
            const axiosErr = err as AxiosError<{ detail: string }>;
            setServerError(
                axiosErr.response?.status === 409
                    ? "Email or username is already in use."
                    : "Something went wrong. Please try again later.",
            );
        }
    }

    if (isSuccessful) {
        return (
            <div className="min-h-screen flex flex-col md:flex-row">
                <BrandPanel />
                <div className="flex-1 flex flex-col items-center justify-center bg-brand-navy md:bg-background px-6 py-10">
                    <img
                        src="/icons/SavannaSentinelLogo.png"
                        alt="Savanna Sentinel Logo"
                        className="w-60 h-auto mb-10 md:hidden"
                    />
                    <div className="w-full max-w-[320px] text-center">
                        <h1 className="text-2xl font-light tracking-[0.18em] text-white md:text-primary mb-4">
                            REQUEST SENT
                        </h1>
                        <p className="text-sm text-white/70 md:text-muted-foreground mb-8">
                            Your account is pending admin activation. You will
                            be able to log in once approved.
                        </p>
                        <Link
                            to="/login"
                            className="text-sm text-white md:text-primary hover:underline"
                        >
                            Back to Login
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col md:flex-row">
            <BrandPanel />

            {}
            <div className="flex-1 flex flex-col items-center justify-center bg-brand-navy md:bg-background px-6 py-10">
                {}
                <img
                    src="/icons/SavannaSentinelLogo.png"
                    alt="Savanna Sentinel Logo"
                    className="w-60 h-auto mb-10 md:hidden"
                />

                <div className="w-full max-w-[320px]">
                    <h1 className="text-center text-2xl font-light tracking-[0.18em] text-white md:text-primary mb-8">
                        REGISTER
                    </h1>

                    {serverError && (
                        <p
                            role="alert"
                            className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-center text-xs text-red-300 md:text-destructive"
                        >
                            {serverError}
                        </p>
                    )}

                    <form
                        onSubmit={handleSubmit(onSubmit)}
                        noValidate
                        className="flex flex-col gap-5"
                    >
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="first_name" className={labelClass}>
                                First Name
                            </Label>
                            <Input
                                id="first_name"
                                type="text"
                                placeholder="First name"
                                autoComplete="given-name"
                                autoFocus
                                className={inputClass}
                                {...register("first_name")}
                            />
                            {errors.first_name && (
                                <p className={errorClass}>
                                    {errors.first_name.message}
                                </p>
                            )}
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="last_name" className={labelClass}>
                                Last Name
                            </Label>
                            <Input
                                id="last_name"
                                type="text"
                                placeholder="Last name"
                                autoComplete="family-name"
                                className={inputClass}
                                {...register("last_name")}
                            />
                            {errors.last_name && (
                                <p className={errorClass}>
                                    {errors.last_name.message}
                                </p>
                            )}
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="username" className={labelClass}>
                                Username
                            </Label>
                            <Input
                                id="username"
                                type="text"
                                placeholder="Username"
                                autoComplete="username"
                                className={inputClass}
                                {...register("username")}
                            />
                            {errors.username && (
                                <p className={errorClass}>
                                    {errors.username.message}
                                </p>
                            )}
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="email" className={labelClass}>
                                Email
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="Email address"
                                autoComplete="email"
                                className={inputClass}
                                {...register("email")}
                            />
                            {errors.email && (
                                <p className={errorClass}>
                                    {errors.email.message}
                                </p>
                            )}
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="password" className={labelClass}>
                                Password
                            </Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Password (min. 8 characters)"
                                    autoComplete="new-password"
                                    className={`${inputClass} pr-10`}
                                    {...register("password")}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={
                                        showPassword
                                            ? "Hide password"
                                            : "Show password"
                                    }
                                    onClick={() => setShowPassword((v) => !v)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground hover:bg-transparent"
                                >
                                    {showPassword ? (
                                        <EyeOff size={17} />
                                    ) : (
                                        <Eye size={17} />
                                    )}
                                </Button>
                            </div>
                            {errors.password && (
                                <p className={errorClass}>
                                    {errors.password.message}
                                </p>
                            )}
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label
                                htmlFor="requested_role"
                                className={labelClass}
                            >
                                Role
                            </Label>
                            <Select
                                onValueChange={(val) =>
                                    setValue(
                                        "requested_role",
                                        val as RegisterFormValues["requested_role"],
                                        { shouldValidate: true },
                                    )
                                }
                            >
                                <SelectTrigger
                                    id="requested_role"
                                    className="bg-input md:bg-card text-foreground border-0 md:border md:border-border focus:ring-2 focus:ring-white/40 md:focus:ring-ring/40 data-[placeholder]:text-muted-foreground"
                                >
                                    <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ranger">
                                        Ranger
                                    </SelectItem>
                                    <SelectItem value="analyst">
                                        Analyst
                                    </SelectItem>
                                    <SelectItem value="community_liaison">
                                        Community Liaison
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            {errors.requested_role && (
                                <p className={errorClass}>
                                    {errors.requested_role.message}
                                </p>
                            )}
                        </div>

                        <div className="flex justify-center pt-4">
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="bg-brand-light-blue md:bg-primary text-foreground md:text-primary-foreground hover:bg-brand-light-blue/80 md:hover:bg-primary/80 px-7 py-2.5 rounded-lg text-base transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2
                                            size={16}
                                            className="animate-spin"
                                        />
                                        Registering...
                                    </>
                                ) : (
                                    "Register"
                                )}
                            </Button>
                        </div>
                    </form>

                    <p className="mt-7 text-center text-xs text-white/80 md:text-muted-foreground">
                        Already have an account?{" "}
                        <Link
                            to="/login"
                            className="hover:underline text-white md:text-primary"
                        >
                            Log in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RegisterPage;
