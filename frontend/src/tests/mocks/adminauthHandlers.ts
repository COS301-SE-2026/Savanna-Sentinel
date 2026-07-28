import { http, HttpResponse } from "msw";

export const mockUsers = {
    results: [
        {
            id: "user-1",
            username: "ranger1",
            email: "ranger1@savanna.org",
            first_name: "John",
            last_name: "Doe",
            role: "ranger",
            is_active: false,
            created_at: "2026-05-10T12:00:00.000Z",
        },
        {
            id: "user-2",
            username: "analyst2",
            email: "analyst2@savanna.org",
            first_name: "Jane",
            last_name: "Smith",
            role: "analyst",
            is_active: false,
            created_at: "2026-05-12T14:30:00.000Z",
        },
    ],
};

export const authHandlers = [
    http.get("**/v1/users", () => {
        return HttpResponse.json(mockUsers);
    }),

    http.patch("**/v1/users/:id/status", ({ params }) => {
        const { id } = params;
        if (id === "admin-error-id") {
            return new HttpResponse(null, { status: 401 });
        }

        return HttpResponse.json({ message: "Status updated successfully" });
    }),

    http.delete("**/v1/admin/users/delete/:id", () => {
        return HttpResponse.json({ message: "User reject successfully" });
    }),
];
