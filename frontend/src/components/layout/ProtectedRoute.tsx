import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

/**
 * Wraps any route that requires authentication.
 * Redirects unauthenticated users to /login, preserving
 * their intended destination in router state.
 *
 * JWT NOTE: Currently checks that an access token string exists.
 * Optionally, once the backend is live, decode the JWT client side and
 * check the 'exp' claim to detect expiry before a network round trip.
 * The server still rejects expired tokens this is a UX optimisation only.
 */
export default function ProtectedRoute() {
    const accessToken = useAuthStore((s) => s.accessToken);
    const location = useLocation();

    if (!accessToken) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <Outlet />;
}
