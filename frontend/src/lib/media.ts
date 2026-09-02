import { mediaApi } from "@/services/mediaApi";
import type { PhotoAttachment } from "@/types/reports";

export const PLACEHOLDER_PHOTO_TYPE = "image/placeholder";

export async function resolvePhotoUrls(
    photos: PhotoAttachment[],
): Promise<string[]> {
    const urls: string[] = [];
    for (const photo of photos) {
        if (photo.file.type === PLACEHOLDER_PHOTO_TYPE) {
            urls.push(photo.previewUrl);
            continue;
        }
        urls.push(await mediaApi.uploadPhoto(photo.file));
    }
    return urls;
}
