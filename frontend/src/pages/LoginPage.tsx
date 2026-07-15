import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AxiosError } from "axios";
import { notifyCritical } from "@/components/ui/toast";
import { useAuthStore } from "@/store/authStore";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Validation schema
const loginSchema = z.object({
    username: z.string().min(1, "Username is required"),
    password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const labelClass = "text-color-text-inverse md:text-color-text-primary";
const inputClass =
    "bg-color-surface-deep/40 text-color-text-inverse placeholder:text-color-text-inverse/50 border-color-text-inverse/20 focus:border-color-text-inverse focus-visible:outline-color-text-inverse md:bg-color-surface-raised md:text-color-text-primary md:placeholder:text-color-input-border md:border-color-input-border md:focus:border-brand-primary md:focus-visible:outline-brand-primary";
const errorClass = "text-xs text-color-text-inverse md:text-status-critical-text";

function BrandPanel() {
    return (
        <div className="hidden md:flex md:w-1/2 bg-color-surface-deep flex-col items-center justify-center gap-6 px-12">
            <img
                src="/icons/SavannaSentinelLogo.png"
                alt=""
                aria-hidden="true"
                className="w-64 h-auto"
            />
            <p className="text-color-text-inverse/50 text-xs tracking-[0.22em] uppercase text-center">
                Wildlife Conservation Monitoring
            </p>
        </div>
    );
}

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
                    "Something went wrong. Please try again later.",
                );
            }
        }
    }

    return (
        <div className="min-h-screen flex flex-col md:flex-row">
            <BrandPanel />

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
                                        errors.password && "border-status-critical",
                                    )}
                                    {...register("password")}
                                />

                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label={
                                        showPassword
                                            ? "Hide password"
                                            : "Show password"
                                    }
                                    onClick={() => setShowPassword((v) => !v)}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 text-color-text-inverse opacity-80 hover:bg-color-text-inverse/10 hover:opacity-100 md:text-color-text-primary md:opacity-65 md:hover:bg-color-surface-bg md:hover:opacity-100"
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
