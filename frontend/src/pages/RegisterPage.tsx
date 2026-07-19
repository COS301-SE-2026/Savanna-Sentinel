import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { AxiosError } from "axios";
import { notifyCritical } from "@/components/ui/toast";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { authApi } from "@/services/authApi";
import { BrandPanel } from "@/components/auth/BrandPanel";
import { PasswordVisibilityToggle } from "@/components/auth/PasswordVisibilityToggle";
import {
    labelClass,
    inputClass,
    errorClass,
    passwordToggleClass,
} from "@/components/auth/authFormStyles";

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

const RegisterPage = () => {
    const [showPassword, setShowPassword] = useState(false);
    const [isSuccessful, setSuccessful] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<RegisterFormValues>({
        resolver: zodResolver(registerSchema),
    });

    async function onSubmit(values: RegisterFormValues) {
        try {
            await authApi.register(values);
            setSuccessful(true);
        } catch (err) {
            const axiosErr = err as AxiosError<{ detail: string }>;

            if (axiosErr.response?.status === 409) {
                notifyCritical(
                    "Registration failed",
                    "Email or username is already in use.",
                );
            } else {
                notifyCritical(
                    "Registration failed",
                    "An error occurred. Try again later.",
                );
            }
        }
    }

    if (isSuccessful) {
        return (
            <div className="min-h-screen flex flex-col md:flex-row">
                <BrandPanel logoAlt="Savanna Sentinel Logo" />
                <div className="flex-1 flex flex-col items-center justify-center bg-color-surface-deep md:bg-color-surface-bg px-6 py-10">
                    <img
                        src="/icons/SavannaSentinelLogo.png"
                        alt="Savanna Sentinel Logo"
                        className="w-60 h-auto mb-10 md:hidden"
                    />
                    <div className="w-full max-w-[320px] text-center">
                        <h1 className="text-2xl font-light tracking-[0.18em] text-color-text-inverse md:text-color-text-primary mb-4">
                            REQUEST SENT
                        </h1>
                        <p className="text-sm text-color-text-inverse/70 md:text-color-text-secondary mb-8">
                            Your account is pending admin activation. You will
                            be able to log in once approved.
                        </p>
                        <Link
                            to="/login"
                            className="text-sm text-color-text-inverse md:text-brand-primary hover:underline"
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
            <BrandPanel logoAlt="Savanna Sentinel Logo" />

            <div className="flex-1 flex flex-col items-center justify-center bg-color-surface-deep md:bg-color-surface-bg px-6 py-10">
                <img
                    src="/icons/SavannaSentinelLogo.png"
                    alt="Savanna Sentinel Logo"
                    className="w-60 h-auto mb-10 md:hidden"
                />

                <div className="w-full max-w-[320px]">
                    <h1 className="text-center text-2xl font-light tracking-[0.18em] text-color-text-inverse md:text-color-text-primary mb-8">
                        REGISTER
                    </h1>

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
                                className={cn(
                                    inputClass,
                                    errors.first_name &&
                                        "border-status-critical",
                                )}
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
                                className={cn(
                                    inputClass,
                                    errors.last_name &&
                                        "border-status-critical",
                                )}
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
                                className={cn(
                                    inputClass,
                                    errors.username && "border-status-critical",
                                )}
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
                                className={cn(
                                    inputClass,
                                    errors.email && "border-status-critical",
                                )}
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
                                    className={cn(
                                        inputClass,
                                        "pr-12",
                                        errors.password &&
                                            "border-status-critical",
                                    )}
                                    {...register("password")}
                                />
                                <PasswordVisibilityToggle
                                    isVisible={showPassword}
                                    onToggle={() => setShowPassword((v) => !v)}
                                    className={passwordToggleClass}
                                />
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
                                id="requested_role"
                                defaultValue=""
                                className={cn(
                                    inputClass,
                                    errors.requested_role &&
                                        "border-status-critical",
                                )}
                                iconClassName="text-color-text-inverse/70 md:text-color-text-secondary"
                                {...register("requested_role")}
                            >
                                <option value="" disabled>
                                    Select a role
                                </option>
                                <option value="ranger">Ranger</option>
                                <option value="analyst">Analyst</option>
                                <option value="community_liaison">
                                    Community Liaison
                                </option>
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
                                className="px-7 py-2.5 rounded-lg text-base"
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

                    <p className="mt-7 text-center text-xs text-color-text-inverse/80 md:text-color-text-secondary">
                        Already have an account?{" "}
                        <Link
                            to="/login"
                            className="hover:underline text-color-text-inverse md:text-brand-primary"
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
