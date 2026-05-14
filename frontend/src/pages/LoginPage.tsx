import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AxiosError } from "axios";
import { useAuthStore } from "@/store/authStore";

//Validation schema

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// Component

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
      /*
       * JWT NOTE: login() calls POST /v1/auth/login with
       * { username, password }. On success the backend returns
       * access_token + refresh_token which are stored in localStorage
       * If your endpoint uses "email" instead of "username", update
       * LoginPayload in authApi.ts to match
       */
      await login(values.username, values.password);
      navigate("/dashboard");
    }
    catch(err)
    {
      const axiosErr = err as AxiosError<{ detail: string }>;
      if(axiosErr.response?.status === 401)
      {
        /*
         * JWT NOTE: Backend returns a generic 401 for ALL failures
         * We mirror that here — one vague message, no enumeration.
         */
        setServerError("Incorrect username or password. Please try again.");
      }
      else
      {
        setServerError("Something went wrong. Please try again later.");
      }
    }
  }

  return (
    <div className="min-h-screen bg-brand-navy flex items-center justify-center px-4 py-10">

      <div className="w-full max-w-sm flex flex-col items-center gap-8">

        {/* Logo */}
        {/*
          Served from frontend/public/icons/SavannaSentinelLogo.png
          No import needed — Vite serves public/ at the root URL
        */}
        <img
          src="/icons/SavannaSentinelLogo.png"
          alt="Savana Sentinel Logo"
          className="w-64 h-auto"
        />

        <div className="w-full bg-brand-dark-blue rounded-2xl px-7 py-8 flex flex-col gap-5">

          {/* Title */}
          <h1 className="text-center text-2xl font-bold tracking-widest text-primary-foreground">
            LOGIN
          </h1>

          {/* Server error banner */}
          {serverError && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive"
            >
              {serverError}
            </p>
          )}

          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="flex flex-col gap-4"
          >
            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="username"
                className="text-sm font-medium text-primary-foreground/90"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                placeholder="Username"
                autoComplete="username"
                autoFocus
                className={`
                  w-full rounded-lg bg-input px-3.5 py-2.5
                  text-sm text-secondary-foreground placeholder:text-muted-foreground
                  border border-transparent
                  focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent
                  transition-shadow
                `}
                {...register("username")}
              />
              {errors.username && (
                <p className="text-xs text-destructive">{errors.username.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-sm font-medium text-primary-foreground/90"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  autoComplete="current-password"
                  className={`
                    w-full rounded-lg bg-input px-3.5 py-2.5 pr-10
                    text-sm text-secondary-foreground placeholder:text-muted-foreground
                    border border-transparent
                    focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent
                    transition-shadow
                  `}
                  {...register("password")}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            {/* Log In button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`
                w-full mt-1 flex items-center justify-center gap-2
                rounded-lg bg-secondary text-secondary-foreground
                px-4 py-3 text-sm font-semibold tracking-wide
                hover:bg-secondary/90 focus:outline-none focus:ring-2 focus:ring-ring
                transition-all
                disabled:opacity-60 disabled:cursor-not-allowed
              `}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Logging in…
                </>
              ) : (
                "Log In"
              )}
            </button>
          </form>

          {/* Register link */}
          <p className="text-center text-xs text-primary-foreground/60">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="font-semibold text-primary-foreground/90 underline underline-offset-2 hover:text-primary-foreground transition-colors"
            >
              Register
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}