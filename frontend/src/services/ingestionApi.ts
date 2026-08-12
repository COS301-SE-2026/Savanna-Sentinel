import { api } from "./api";

export interface IngestionResponse {
    status: string;
    message: string;
}

export const ingestionApi = {
    uploadFile: async (
        records: Record<string, unknown>[],
        start_row: number,
        filename?: string,
    ): Promise<IngestionResponse> =>
        api
            .post<IngestionResponse>("ingestion/upload", {
                records: records,
                start_row: start_row,
                filename: filename,
            })
            .then((r) => r.data),
};
