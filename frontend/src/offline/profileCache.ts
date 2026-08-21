import { usersApi, type UserResponse } from "@/services/usersApi";
import { cacheKeys, readCache, writeCache } from "@/offline/db";

interface ProfileNames {
    firstName: string;
    lastName: string;
}

export interface ProfileResult extends ProfileNames {
    profile: UserResponse | null;
    isFromCache: boolean;
}

export async function loadProfile(
    userId: string | null,
): Promise<ProfileResult> {
    const key = cacheKeys.profile();

    try {
        const profile = await usersApi.getMe();
        const names: ProfileNames = {
            firstName: profile.first_name ?? "",
            lastName: profile.last_name ?? "",
        };

        if (userId) {
            await writeCache(key, userId, names).catch(() => {});
        }

        return { ...names, profile, isFromCache: false };
    } catch (networkError) {
        if (!userId) throw networkError;

        const cached = await readCache<ProfileNames>(key, userId).catch(
            () => null,
        );
        if (!cached) throw networkError;

        return {
            firstName: cached.payload.firstName,
            lastName: cached.payload.lastName,
            profile: null,
            isFromCache: true,
        };
    }
}
