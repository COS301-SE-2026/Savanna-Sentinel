import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useEffect, useState } from "react";
import { riskApi } from "@/services/riskApi";
import { isAxiosError } from "axios";

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
    const logout = useAuthStore((s) => s.logout);

    const [isChecking, setIsChecking] = useState(true);
    const [isUploaded, setIsUploaded] = useState<boolean | null>(null);

    useEffect(() => {
        if (!accessToken) {
            return;
        }

        let isMounted = true;

        const verifyUpload = async () => {
            try {
                const response = await riskApi.checkUploaded();
                if (isMounted) {
                    setIsUploaded(response.uploaded);
                    setIsChecking(false);
                }
            } catch(error: unknown) {
                if (isAxiosError(error) && error.response?.status === 401) {
                    logout();
                    return;
                }

                if (isMounted) {
                    setIsUploaded(false);
                    setIsChecking(false);
                }
            }
        };

        verifyUpload();
        return () => {
            isMounted = false;
        };
    }, [accessToken, logout]);

    if (!accessToken) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (isChecking) {
        return <div>Loading...</div>;
    }

    if (!isUploaded && location.pathname !== "/upload") {
        return <Navigate to="/upload" replace />;
    }
    if (isUploaded && location.pathname === "/upload") {
        return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
}
