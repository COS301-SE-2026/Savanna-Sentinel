import { http, HttpResponse } from "msw";

const BASE = "http://localhost:8000/v1";

interface StoredWorkspace {
    version: number;
    layers: unknown[];
    features: unknown[];
    memberships: unknown[];
}

interface SavePayload extends StoredWorkspace {
    base_version: number;
}

export const workspaceState: {
    current: StoredWorkspace;
    visibilityCalls: unknown[];
    saveCalls: SavePayload[];
    failSave: boolean;
} = {
    current: { version: 0, layers: [], features: [], memberships: [] },
    visibilityCalls: [],
    saveCalls: [],
    failSave: false,
};

export function resetWorkspaceMock() {
    workspaceState.current = {
        version: 0,
        layers: [],
        features: [],
        memberships: [],
    };
    workspaceState.visibilityCalls = [];
    workspaceState.saveCalls = [];
    workspaceState.failSave = false;
}

export const workspaceHandlers = [
    http.get(`${BASE}/workspace`, () =>
        HttpResponse.json(workspaceState.current),
    ),

    http.put(`${BASE}/workspace`, async ({ request }) => {
        const body = (await request.json()) as SavePayload;
        workspaceState.saveCalls.push(body);

        if (workspaceState.failSave) {
            return new HttpResponse(null, { status: 500 });
        }

        if (body.base_version !== workspaceState.current.version) {
            return HttpResponse.json(
                {
                    detail: {
                        message: "stale",
                        current_version: workspaceState.current.version,
                    },
                },
                { status: 409 },
            );
        }

        workspaceState.current = {
            version: workspaceState.current.version + 1,
            layers: body.layers,
            features: body.features,
            memberships: body.memberships,
        };
        return HttpResponse.json(workspaceState.current);
    }),

    http.put(`${BASE}/workspace/visibility`, async ({ request }) => {
        workspaceState.visibilityCalls.push(await request.json());
        return new HttpResponse(null, { status: 204 });
    }),
];
