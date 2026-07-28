import type { UserResponse } from "@/services/usersApi";

export type StandardUserSortKey = "username" | "name" | "email" | "role";

export const standardUserSortAccessors: Record<
    StandardUserSortKey,
    (user: UserResponse) => string | number
> = {
    username: (user) => user.username.toLowerCase(),
    name: (user) => `${user.first_name} ${user.last_name}`.toLowerCase(),
    email: (user) => user.email.toLowerCase(),
    role: (user) => user.role.toLowerCase(),
};

export const STANDARD_USER_COLUMNS: {
    key: StandardUserSortKey;
    label: string;
}[] = [
    { key: "username", label: "Username" },
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "role", label: "Current Role" },
];
