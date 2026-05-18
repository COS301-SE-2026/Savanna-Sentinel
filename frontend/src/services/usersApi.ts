import { api } from './api';

export interface UpdateProfilePayload {
	first_name?: string;
	last_name?: string;
}

export interface UserProfile {
	id: string;
	username: string;
	email: string;
	first_name?: string;
	last_name?: string;
	role: string;
	is_active?: boolean;
	created_at?: string;
}

export const usersApi = {
	getMe: async (): Promise<UserProfile> => api.get<UserProfile>('/users/me').then((r) => r.data),

	updateProfile: async (payload: UpdateProfilePayload): Promise<UserProfile> =>
		api.patch<UserProfile>('/users/me', payload).then((r) => r.data),

	/**
	 * Change password. Backend should revoke existing refresh tokens on success.
	 * Expects body: { current_password, new_password }
	 */
	changePassword: async (current_password: string, new_password: string): Promise<void> =>
		api.patch('/users/me', { current_password, new_password }).then(() => undefined),
};
