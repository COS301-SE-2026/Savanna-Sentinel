import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { AxiosError } from "axios";
import { notifyCritical } from "@/components/ui/toast";
import { useAuthStore } from "@/store/authStore";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandPanel } from "@/components/auth/BrandPanel";
import { PasswordVisibilityToggle } from "@/components/auth/PasswordVisibilityToggle";
import {
    labelClass,
    inputClass,
    errorClass,
    passwordToggleClass,
} from "@/components/auth/authFormStyles";

// Validation schema
const loginSchema = z.object({
    username: z.string().min(1, "Username is required"),
    password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
    const navigate = useNavigate();
    const login = useAuthStore((s) => s.login);

    const [showPassword, setShowPassword] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: { username: "", password: "" },
    });

    async function onSubmit(values: LoginFormValues) {
        try {
            await login(values.username, values.password);
            navigate("/dashboard");
        } catch (err) {
            const axiosErr = err as AxiosError<{ detail: string }>;

            if (axiosErr.response?.status === 401) {
                notifyCritical(
                    "Login failed",
                    "Incorrect username or password. Check your details and try again.",
                );
            } else {
                notifyCritical(
                    "Login failed",
                    "An error occurred. Try again later.",
                );
            }
        }
    }

    return (
        <div className="min-h-screen flex flex-col md:flex-row">
            <BrandPanel logoAlt="" logoAriaHidden />

            <div className="flex-1 flex flex-col items-center justify-center bg-color-surface-deep md:bg-color-surface-bg px-6 py-10">
                <img
                    src="/icons/SavannaSentinelLogo.png"
                    alt="Savanna Sentinel Logo"
                    className="w-60 h-auto mb-10 md:hidden"
                />

                <div className="w-full max-w-[320px]">
                    <h1 className="text-center text-2xl font-light tracking-[0.18em] text-color-text-inverse md:text-color-text-primary mb-8">
                        LOGIN
                    </h1>

                    <form
                        onSubmit={handleSubmit(onSubmit)}
                        noValidate
                        className="flex flex-col gap-5"
                    >
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="username" className={labelClass}>
                                Username
                            </Label>

                            <Input
                                id="username"
                                type="text"
                                placeholder="Username"
                                autoComplete="username"
                                autoFocus
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
                            <Label htmlFor="password" className={labelClass}>
                                Password
                            </Label>

                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Password"
                                    autoComplete="current-password"
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

                        <div className="flex justify-center pt-4">
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="min-h-11 px-5 py-3 rounded-lg"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2
                                            size={16}
                                            className="animate-spin"
                                        />
                                        Logging in...
                                    </>
                                ) : (
                                    "Log In"
                                )}
                            </Button>
                        </div>
                    </form>

                    <p className="mt-7 text-center text-xs text-color-text-inverse/80 md:text-color-text-secondary">
                        Don&rsquo;t have an account?{" "}
                        <Link
                            to="/register"
                            className="rounded-sm px-1 font-semibold text-color-text-inverse transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-color-text-inverse md:text-brand-primary md:hover:text-color-surface-deep md:focus-visible:outline-brand-primary"
                        >
                            Register
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
