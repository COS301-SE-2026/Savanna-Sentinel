import { api } from "./api";

export interface GridCellProperties {
    cell_id: string;
    row: number;
    col: number;
}

export interface GridCellFeature {
    type: "Feature";
    properties: GridCellProperties;
    geometry: {
        type: "Polygon";
        coordinates: number[][][];
    };
}

export interface ParkGridResponse {
    type: "FeatureCollection";
    features: GridCellFeature[];
}

export const riskApi = {
    getParkGrid: async (
        parkId: string = "reserve",
    ): Promise<ParkGridResponse> =>
        api
            .get<ParkGridResponse>("/risk/grid", {
                params: { park_id: parkId },
            })
            .then((r) => r.data),
};
