import { http, HttpResponse } from "msw";

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

export const mockActiveUsers = {
    total: initialActiveUsers.length,
    page: 1,
    page_size: 20,
    results: [...initialActiveUsers],
};

// DELETE mutates mockActiveUsers.results so a refetch reflects the removal;
// call this in afterEach to undo that for the next test.
export function resetMockActiveUsers() {
    mockActiveUsers.results = [...initialActiveUsers];
    mockActiveUsers.total = initialActiveUsers.length;
}

export const deleteAccountsHandlers = [
    http.get("**/v1/users", () => {
        return HttpResponse.json(mockActiveUsers);
    }),

    http.delete("**/v1/users/:id", ({ params }) => {
        const { id } = params;
        if (id === "error-id") {
            return new HttpResponse(null, { status: 500 });
        }
        const user = mockActiveUsers.results.find((u) => u.id === id);
        mockActiveUsers.results = mockActiveUsers.results.filter(
            (u) => u.id !== id,
        );
        mockActiveUsers.total = mockActiveUsers.results.length;
        return HttpResponse.json(user);
    }),
];
