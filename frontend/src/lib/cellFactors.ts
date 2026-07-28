export interface CellFactor {
    label: string;
    pct: number;
}

function hashString(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = (hash * 31 + value.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
}

/**
 * random stub for now
 */
export function getCellFactors(cellId: string): CellFactor[] {
    const pct = 45 + (hashString(cellId) % 45);
    return [{ label: "Randomly given", pct }];
}
