import { api } from "./api"

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
    getPendingUsers: (): Promise<PaginatedUsersResponse> => 
        api.get<PaginatedUsersResponse>("/users", {
            params: {
                is_active: false
            }
        }).then((r) => r.data),
        
    setUserStatus: (userId: string, isActive: boolean): Promise<UserResponse> => 
        api.patch<UserResponse>(`/users/${userId}/status`, { 
            is_active: isActive 
        }).then((r) => r.data),
}