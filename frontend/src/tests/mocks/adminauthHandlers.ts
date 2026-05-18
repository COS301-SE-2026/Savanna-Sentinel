import {http, HttpResponse} from "msw"

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
    ]
}

export const authHandlers = [
    http.get("*/api/users/pending", () => {
        return HttpResponse.json(mockUsers)
    })
]