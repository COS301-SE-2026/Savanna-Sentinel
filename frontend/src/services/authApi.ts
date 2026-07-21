import { api } from "./api";

export interface LoginPayload {
    username: string;
    password: string;
}

/**
 * JWT NOTE: This interface must match the JSON body returned by
 * POST /v1/auth/login and POST /v1/auth/refresh on the backend
 * Field names must be exactly: access_token, refresh_token, token_type, expires_in, user
 */
export interface TokenResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    user: {
        id: string;
        username: string;
        role: string;
    };
}

export interface MfaChallengeResponse {
    mfa_required: true;
    mfa_token: string;
    expires_in: number;
}

export interface MfaVerifyPayload {
    mfa_token: string;
    code: string;
}

export interface RegisterPayload {
    username: string;
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    requested_role: "ranger" | "analyst" | "community_liaison";
}

export interface UserResponse {
    id: string;
    username: string;
    email: string;
    role: string;
    is_active: boolean;
    created_at: string;
}

export const authApi = {
    register: (payload: RegisterPayload): Promise<UserResponse> =>
        api.post<UserResponse>("/auth/register", payload).then((r) => r.data),

    /**
     * POST /v1/auth/login
     * JWT NOTE: Backend must return TokenResponse on success
     * On ANY failure (wrong password, unknown username, inactive account)
     * Admin accounts get MfaChallengeResponse.
     */
    login: (
        payload: LoginPayload,
    ): Promise<TokenResponse | MfaChallengeResponse> =>
        api
            .post<TokenResponse | MfaChallengeResponse>("/auth/login", payload)
            .then((r) => r.data),

    verifyMfa: (payload: MfaVerifyPayload): Promise<TokenResponse> =>
        api
            .post<TokenResponse>("/auth/mfa/verify", payload)
            .then((r) => r.data),
    resendMfa: (mfa_token: string): Promise<void> =>
        api.post("/auth/mfa/resend", { mfa_token }).then(() => undefined),

    /**
     * POST /v1/auth/refresh
     * JWT NOTE: Receives { refresh_token }, returns new TokenResponse
     * Must return 401 if token is invalid or has been revoked
     */
    refresh: (refresh_token: string): Promise<TokenResponse> =>
        api
            .post<TokenResponse>("/auth/refresh", { refresh_token })
            .then((r) => r.data),

    /**
     * POST /v1/auth/logout
     * JWT NOTE: Backend should revoke / blacklist the refresh token
     * Returns 204 No Content
     */
    logout: (refresh_token: string): Promise<void> =>
        api.post("/auth/logout", { refresh_token }).then(() => undefined),
};
