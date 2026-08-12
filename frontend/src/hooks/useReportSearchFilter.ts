import { reportsApi } from "@/services/reportsApi";

export async function getSpeciesOptions(): Promise<string[]> {
    return (await reportsApi.getSpecies()).species;
}
