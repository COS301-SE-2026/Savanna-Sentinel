import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authApi } from "../services/authApi";

export interface AuthUser {
    id: string;
    username: string;
    role: string;
}

interface AuthState {
    accessToken: string | null;
    refreshToken: string | null;
    user: AuthUser | null;

    login: (username: string, password: string) => Promise<void>;
    refreshSession: () => Promise<string>;
    logout: () => void;
    setUser: (user: AuthUser) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            accessToken: null,
            refreshToken: null,
            user: null,

            /**
             * Calls the login endpoint and stores the returned tokens.
             * JWT NOTE: access_token and refresh_token come from the backend
             * JWT implementation. Field names here must match the backend response
             * exactly. See authApi.ts to TokenResponse interface.
             */
            login: async (username: string, password: string) => {
                const data = await authApi.login({ username, password });
                set({
                    accessToken: data.access_token,
                    refreshToken: data.refresh_token,
                    user: {
                        id: data.user.id,
                        username: data.user.username,
                        role: data.user.role,
                    },
                });
            },

            /**
             * Exchanges the stored refresh token for a new access token
             * JWT NOTE: Calls POST /v1/auth/refresh. Backend must return
             * a new access_token (and optionally a rotated refresh_token)
             * Returns the new access token so the HTTP interceptor can retry
             * the failed request automatically
             */
            refreshSession: async () => {
                const { refreshToken } = get();
                if (!refreshToken) {
                    throw new Error("No refresh token available");
                }
                const data = await authApi.refresh(refreshToken);
                set({
                    accessToken: data.access_token,
                    refreshToken: data.refresh_token,
                    user: {
                        id: data.user.id,
                        username: data.user.username,
                        role: data.user.role,
                    },
                });
                return data.access_token;
            },

            /**
             * Clears all auth state and notifies the backend to revoke the token.
             * JWT NOTE: Calls POST /v1/auth/logout with { refresh_token }.
             * Backend should invalidate / blacklist the refresh token so it
             * cannot be reused after logout.
             */
            logout: () => {
                const { refreshToken } = get();
                if (refreshToken) {
                    authApi.logout(refreshToken).catch(() => {});
                }
                set({ accessToken: null, refreshToken: null, user: null });
            },

            setUser: (user: AuthUser) => set({ user }),
        }),
        {
            name: "auth-storage",
            partialize: (state) => ({
                accessToken: state.accessToken,
                refreshToken: state.refreshToken,
                user: state.user,
            }),
        },
    ),
);
