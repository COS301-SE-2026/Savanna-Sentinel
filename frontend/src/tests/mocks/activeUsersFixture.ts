import { http, HttpResponse } from "msw";

// Shared by deleteAccountsHandlers and roleSwapHandlers, which both mock a
// paginated "active users" list backed by a DELETE /v1/users/:id endpoint.
export function createActiveUsersFixture(initialUsers: object[]) {
    const mockActiveUsers = {
        total: initialUsers.length,
        page: 1,
        page_size: 20,
        results: [...initialUsers],
    };

    function resetMockActiveUsers() {
        mockActiveUsers.results = [...initialUsers];
        mockActiveUsers.total = initialUsers.length;
    }

    function deleteUserHandler() {
        return http.delete("**/v1/users/:id", ({ params }) => {
            const { id } = params;
            if (id === "error-id") {
                return new HttpResponse(null, { status: 500 });
            }
            const user = mockActiveUsers.results.find(
                (u: { id: unknown }) => u.id === id,
            );
            mockActiveUsers.results = mockActiveUsers.results.filter(
                (u: { id: unknown }) => u.id !== id,
            );
            mockActiveUsers.total = mockActiveUsers.results.length;
            return HttpResponse.json(user);
        });
    }

    return { mockActiveUsers, resetMockActiveUsers, deleteUserHandler };
}
