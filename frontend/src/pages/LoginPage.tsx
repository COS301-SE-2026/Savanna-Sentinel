import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AxiosError } from "axios";
import { useAuthStore } from "@/store/authStore";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Validation schema
const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const labelClass = "text-white md:text-primary text-sm font-medium";
const inputClass =
  "w-full rounded-lg bg-[#d9d9d9] px-4 py-2.5 text-sm text-black placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-white/40 md:bg-card md:text-foreground md:placeholder:text-muted-foreground md:focus:ring-ring/40";

function BrandPanel() {
  return (
    <div className="hidden md:flex md:w-1/2 bg-brand-navy flex-col items-center justify-center gap-6 px-12">
      <img
        src="/icons/SavannaSentinelLogo.png"
        alt=""
        aria-hidden="true"
        className="w-64 h-auto"
      />
      <p className="text-white/50 text-xs tracking-[0.22em] uppercase text-center">
        Wildlife Conservation Monitoring
      </p>
    </div>
  );
}

export default function LoginPage()
{
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  async function onSubmit(values: LoginFormValues)
  {
    setServerError(null);

    try
    {
      await login(values.username, values.password);
      navigate("/dashboard");
    }
    catch(err)
    {
      const axiosErr = err as AxiosError<{ detail: string }>;

      if(axiosErr.response?.status === 401)
      {
        setServerError("Incorrect username or password. Please try again.");
      }
      else
      {
        setServerError("Something went wrong. Please try again later.");
      }
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">

      <BrandPanel />

      <div className="flex-1 flex flex-col items-center justify-center bg-brand-navy md:bg-background px-6 py-10">

        <img
          src="/icons/SavannaSentinelLogo.png"
          alt="Savana Sentinel Logo"
          className="w-60 h-auto mb-10 md:hidden"
        />

        <div className="w-full max-w-[320px]">

          <h1 className="text-center text-2xl font-light tracking-[0.18em] text-white md:text-primary mb-8">
            LOGIN
          </h1>

          {serverError && (
            <p
              role="alert"
              className="mb-4 rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-center text-xs text-red-300 md:text-destructive"
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
              <Label htmlFor="username" className={labelClass}>
                Username
              </Label>

              <Input
                id="username"
                type="text"
                placeholder="Username"
                autoComplete="username"
                autoFocus
                className={inputClass}
                {...register("username")}
              />

              {errors.username && (
                <p className="text-xs text-red-300 md:text-destructive">
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
                  className={`${inputClass} pr-10`}
                  {...register("password")}
                />

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black transition-colors md:text-muted-foreground md:hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </Button>
              </div>

              {errors.password && (
                <p className="text-xs text-red-300 md:text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="flex justify-center pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center justify-center gap-2 rounded-lg bg-[#a8b4c5] px-7 py-2.5 text-base text-gray-800 transition-all hover:bg-[#bcc7d6] disabled:cursor-not-allowed disabled:opacity-60 md:bg-primary md:text-primary-foreground md:hover:bg-primary/80"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Logging in...
                  </>
                ) : (
                  "Log In"
                )}
              </Button>
            </div>

          </form>

          <p className="mt-7 text-center text-xs text-white/80 md:text-muted-foreground">
            Don’t have an account?{" "}
            <Link
              to="/register"
              className="text-white hover:underline md:text-primary"
            >
              Register
            </Link>
          </p>

        </div>

      </div>

    </div>
  );
}