import axios from "axios";

import { api } from "./api";

export interface UploadUrlRequest {
    file_name: string;
    content_type: string;
}

export interface UploadUrlResponse {
    upload_url: string;
    object_url: string;
    expires_in: number;
}

export const mediaApi = {
    requestUploadUrl: async (
        payload: UploadUrlRequest,
    ): Promise<UploadUrlResponse> =>
        api
            .post<UploadUrlResponse>("/media/upload-url", payload)
            .then((r) => r.data),

    putFile: async (uploadUrl: string, file: File): Promise<void> => {
        await axios.put(uploadUrl, file, {
            headers: { "Content-Type": file.type },
        });
    },

    uploadPhoto: async (file: File): Promise<string> => {
        const { upload_url: uploadUrl, object_url: objectUrl } =
            await mediaApi.requestUploadUrl({
                file_name: file.name,
                content_type: file.type,
            });
        await mediaApi.putFile(uploadUrl, file);
        return objectUrl;
    },
};
