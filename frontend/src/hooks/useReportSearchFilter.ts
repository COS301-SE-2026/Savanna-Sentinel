import { reportsApi } from "@/services/reportsApi";

export async function getSpeciesOptions(): Promise<string[]> {
    return (await reportsApi.getSpecies()).species;
}
export async function getUsernameOptions(): Promise<string[]> {
    return (await reportsApi.getUsernames()).usernames;
}
