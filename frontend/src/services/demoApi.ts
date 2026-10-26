import { api } from "./api";

export const demoApi = {
    reset: async (): Promise<void> => {
        await api.post("/demo/reset");
    },
    insertKlaserieWorkspace: async (): Promise<void> => {
        await api.post("/demo/workspace/klaserie");
    },
};
