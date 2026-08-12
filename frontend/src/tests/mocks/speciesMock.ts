import { http, HttpResponse } from "msw";

export const handlers = [
    http.get("*/v1/reports/species", () => {
        return HttpResponse.json({
            species: ["Buffalo", "Elephant", "Rhino"],
        });
    }),
    http.get("*/v1/reports/users", () => {
        return HttpResponse.json({
            species: ["John Doe"],
        });
    }),
];
