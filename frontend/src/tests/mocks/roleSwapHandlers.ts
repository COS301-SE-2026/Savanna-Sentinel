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
];

const { mockActiveUsers, resetMockActiveUsers, deleteUserHandler } =
    createActiveUsersFixture(initialActiveUsers);

export { resetMockActiveUsers };

export const roleSwapHandlers = [
    http.get("*/v1/users", () => {
        return HttpResponse.json(mockActiveUsers);
    }),

    http.patch("*/v1/users/:id/role", async ({ params, request }) => {
        const { id } = params;
        const body = (await request.json()) as { new_role: string };

        if (id === "error-id") {
            return new HttpResponse(null, { status: 404 });
        }

        const user = mockActiveUsers.results.find((u) => u.id === id);
        return HttpResponse.json({ ...user, role: body.new_role });
    }),

    deleteUserHandler(),
];
