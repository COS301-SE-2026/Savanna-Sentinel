import axios from "axios";
import type { AxiosInstance, AxiosError } from "axios";
import { useAuthStore } from "@/store/authStore";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/v1";

export const api: AxiosInstance = axios.create({
    baseURL: BASE_URL,
    headers: { "Content-Type": "application/json" },
});

// Request interceptor
// JWT NOTE: This is where the access token is attached to every request as
// Authorization: Bearer <token>. The token is sourced from the auth store
// (originally from the backend login response). Do not change the header name
api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

// Response interceptor (auto refresh on 401)
// JWT NOTE: When any request receives a 401, this interceptor silently
// refreshes the session using the stored refresh token before retrying
// Your protected endpoints must return 401 (not 403) when a token is missing
// or expired, otherwise this auto-refresh logic will not trigger
let isRefreshing = false;
let waitingQueue: ((token: string) => void)[] = [];

api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as typeof error.config & {
            _retry?: boolean;
        };

        const requestUrl = originalRequest?.url ?? "";
        const isAuthRequest =
            requestUrl.startsWith("/auth/login") ||
            requestUrl.startsWith("/auth/refresh");

        if (
            error.response?.status === 401 &&
            !originalRequest._retry &&
            !isAuthRequest
        ) {
            if (isRefreshing) {
                return new Promise((resolve) => {
                    waitingQueue.push((newToken: string) => {
                        originalRequest.headers!.Authorization = `Bearer ${newToken}`;
                        resolve(api(originalRequest));
                    });
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const newToken = await useAuthStore.getState().refreshSession();
                waitingQueue.forEach((cb) => cb(newToken));
                waitingQueue = [];
                originalRequest.headers!.Authorization = `Bearer ${newToken}`;
                return api(originalRequest);
            } catch {
                useAuthStore.getState().logout();
                return Promise.reject(error);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    },
);
