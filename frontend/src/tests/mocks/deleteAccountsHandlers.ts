import { http, HttpResponse } from "msw";
import { createActiveUsersFixture } from "./activeUsersFixture";

const initialActiveUsers = [
    {
        id: "user-1",
        username: "ranger1",
        email: "ranger1@savanna.org",
        first_name: "John",
        last_name: "Doe",
        role: "ranger",
        is_active: true,
        created_at: "2026-05-10T12:00:00.000Z",
    },
    {
        id: "user-2",
        username: "analyst2",
        email: "analyst2@savanna.org",
        first_name: "Jane",
        last_name: "Smith",
        role: "analyst",
        is_active: true,
        created_at: "2026-05-12T14:30:00.000Z",
    },
    {
        id: "user-3",
        username: "admin1",
        email: "admin1@savanna.org",
        first_name: "Ada",
        last_name: "Min",
        role: "admin",
        is_active: true,
        created_at: "2026-05-01T09:00:00.000Z",
    },
];

const { mockActiveUsers, resetMockActiveUsers, deleteUserHandler } =
    createActiveUsersFixture(initialActiveUsers);

export { mockActiveUsers, resetMockActiveUsers };

export const deleteAccountsHandlers = [
    http.get("**/v1/users", () => {
        return HttpResponse.json(mockActiveUsers);
    }),

    deleteUserHandler(),
];
