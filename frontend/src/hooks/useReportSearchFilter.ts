import { reportsApi } from "@/services/reportsApi";
import { tipoffsApi } from "@/services/tipoffsApi";

export async function getSpeciesOptions(): Promise<string[]> {
    return (await reportsApi.getSpecies()).species;
}
export async function getUsernameOptions(): Promise<string[]> {
    return (await reportsApi.getUsernames()).usernames;
}

export async function getTipoffSpeciesOptions(): Promise<string[]> {
    return (await tipoffsApi.getSpecies()).species;
}
export async function getTipoffUsernameOptions(): Promise<string[]> {
    return (await tipoffsApi.getUsernames()).usernames;
}
