import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authApi, type TokenResponse } from "../services/authApi";

export interface AuthUser {
    id: string;
    username: string;
    role: string;
}

export type LoginResult =
    | { mfaRequired: false }
    | { mfaRequired: true; mfaToken: string };

interface AuthState {
    accessToken: string | null;
    refreshToken: string | null;
    user: AuthUser | null;

    login: (username: string, password: string) => Promise<LoginResult>;
    verifyMfa: (mfaToken: string, code: string) => Promise<void>;
    resendMfa: (mfaToken: string) => Promise<void>;
    refreshSession: () => Promise<string>;
    logout: () => void;
    setUser: (user: AuthUser) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => {
            const applyTokens = (data: TokenResponse) => {
                set({
                    accessToken: data.access_token,
                    refreshToken: data.refresh_token,
                    user: {
                        id: data.user.id,
                        username: data.user.username,
                        role: data.user.role,
                    },
                });
            };

            return {
                accessToken: null,
                refreshToken: null,
                user: null,
                login: async (username: string, password: string) => {
                    const data = await authApi.login({ username, password });
                    if ("mfa_required" in data) {
                        return {
                            mfaRequired: true as const,
                            mfaToken: data.mfa_token,
                        };
                    }
                    applyTokens(data);
                    return { mfaRequired: false as const };
                },
                verifyMfa: async (mfaToken: string, code: string) => {
                    const data = await authApi.verifyMfa({
                        mfa_token: mfaToken,
                        code,
                    });
                    applyTokens(data);
                },

                resendMfa: async (mfaToken: string) => {
                    await authApi.resendMfa(mfaToken);
                },
                refreshSession: async () => {
                    const { refreshToken } = get();
                    if (!refreshToken) {
                        throw new Error("No refresh token available");
                    }
                    const data = await authApi.refresh(refreshToken);
                    applyTokens(data);
                    return data.access_token;
                },

                logout: () => {
                    const { refreshToken } = get();
                    if (refreshToken) {
                        authApi.logout(refreshToken).catch(() => {});
                    }
                    set({ accessToken: null, refreshToken: null, user: null });
                },

                setUser: (user: AuthUser) => set({ user }),
            };
        },
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
