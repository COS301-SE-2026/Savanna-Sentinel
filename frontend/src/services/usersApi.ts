import { api } from "./api";

export interface UpdateProfilePayload {
    first_name?: string;
    last_name?: string;
}

export interface UserResponse {
    id: string;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    is_active: boolean;
    created_at: string;
}

export interface PaginatedUsersResponse {
    total: number;
    page: number;
    page_size: number;
    results: UserResponse[];
}

export const usersApi = {
    getMe: async (): Promise<UserResponse> =>
        api.get<UserResponse>("/users/me").then((r) => r.data),

    updateProfile: async (
        payload: UpdateProfilePayload,
    ): Promise<UserResponse> =>
        api.patch<UserResponse>("/users/me", payload).then((r) => r.data),

    /**
     * Change password. Backend should revoke existing refresh tokens on success.
     * Expects body: { current_password, new_password }
     */
    changePassword: async (
        current_password: string,
        new_password: string,
    ): Promise<void> =>
        api
            .patch("/users/me", { current_password, new_password })
            .then(() => undefined),

    getPendingUsers: (): Promise<PaginatedUsersResponse> =>
        api
            .get<PaginatedUsersResponse>("/users", {
                params: {
                    is_active: false,
                },
            })
            .then((r) => r.data),

    setUserStatus: (userId: string, isActive: boolean): Promise<UserResponse> =>
        api
            .patch<UserResponse>(`/users/${userId}/status`, {
                is_active: isActive,
            })
            .then((r) => r.data),

    getActiveUsers: (page: number = 1, pageSize: number = 20): Promise<PaginatedUsersResponse> =>
        api
            .get<PaginatedUsersResponse>("/users", {
                params: {
                    is_active: true,
                    page,
                    page_size: pageSize,
                },
            })
            .then((r) => r.data),

    deleteUser: (user_id: string): Promise<UserResponse> =>
        api
            .delete<UserResponse>(`/admin/users/delete/${user_id}`)
            .then((r) => r.data),

    softDeleteUser: (user_id: string): Promise<UserResponse> =>
        api.delete<UserResponse>(`/users/${user_id}`).then((r) => r.data),

    changeUserRole: (userId: string, newRole: string): Promise<UserResponse> =>
        api
            .patch<UserResponse>(`/users/${userId}/role`, {
                new_role: newRole,
            })
            .then((r) => r.data),
};
