import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AxiosError } from "axios";
import { useAuthStore } from "@/store/authStore";

// Validation schema
const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

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
    <div className="h-screen overflow-hidden bg-brand-navy flex flex-col items-center px-6 pt-10">

      {/* Logo */}
      <img
        src="/icons/SavannaSentinelLogo.png"
        alt="Savana Sentinel Logo"
        className="w-60 h-auto mb-12"
      />

      {/* Login Section */}
      <div className="w-full max-w-[320px]">

        {/* Title */}
        <h1 className="text-center text-2xl font-light tracking-[0.18em] text-white mb-10">
          LOGIN
        </h1>

        {/* Server Error */}
        {serverError && (
          <p
            role="alert"
            className="
              mb-4 rounded-lg border border-red-400/40
              bg-red-400/10 px-3 py-2 text-center
              text-xs text-red-300
            "
          >
            {serverError}
          </p>
        )}

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-5"
        >

          {/* Username */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="username"
              className="text-white text-sm font-medium"
            >
              Username
            </label>

            <input
              id="username"
              type="text"
              placeholder="Username"
              autoComplete="username"
              autoFocus
              className="
                w-full rounded-lg bg-[#d9d9d9]
                px-4 py-2.5
                text-sm text-black
                placeholder:text-gray-600
                focus:outline-none focus:ring-2 focus:ring-white/40
              "
              {...register("username")}
            />

            {errors.username && (
              <p className="text-xs text-red-300">
                {errors.username.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="password"
              className="text-white text-sm font-medium"
            >
              Password
            </label>

            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                autoComplete="current-password"
                className="
                  w-full rounded-lg bg-[#d9d9d9]
                  px-4 py-2.5 pr-10
                  text-sm text-black
                  placeholder:text-gray-600
                  focus:outline-none focus:ring-2 focus:ring-white/40
                "
                {...register("password")}
              />

              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((v) => !v)}
                className="
                  absolute right-3 top-1/2 -translate-y-1/2
                  text-gray-600 hover:text-black transition-colors
                "
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            {errors.password && (
              <p className="text-xs text-red-300">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Login Button */}
          <div className="flex justify-center pt-5">
            <button
              type="submit"
              disabled={isSubmitting}
              className="
                flex items-center justify-center gap-2
                rounded-lg bg-[#a8b4c5]
                px-7 py-2.5
                text-base text-gray-800
                hover:bg-[#bcc7d6]
                transition-all
                disabled:opacity-60 disabled:cursor-not-allowed
              "
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Logging in...
                </>
              ) : (
                "Log In"
              )}
            </button>
          </div>

        </form>

        {/* Register */}
        <p className="mt-7 text-center text-xs text-white/80">
          Don’t have an account?{" "}
          <Link
            to="/register"
            className="hover:underline text-white"
          >
            Register
          </Link>
        </p>

      </div>

      {/* Space for future bottom content */}
      <div className="flex-1" />

    </div>
  );
}