export type PaginationItem = number | "ellipsis";

export function getPaginationItems(
    currentPage: number,
    totalPages: number,
): PaginationItem[] {
    if (totalPages <= 0) return [];

    let start = currentPage - 1;
    let end = currentPage + 1;

    if (start < 1) {
        end += 1 - start;
        start = 1;
    }
    if (end > totalPages) {
        start -= end - totalPages;
        end = totalPages;
    }
    start = Math.max(1, start);
    end = Math.min(totalPages, end);

    const pageSet = new Set<number>([1, totalPages]);
    for (let page = start; page <= end; page++) {
        pageSet.add(page);
    }

    const sorted = Array.from(pageSet).sort((a, b) => a - b);

    const items: PaginationItem[] = [];
    for (let i = 0; i < sorted.length; i++) {
        if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
            items.push("ellipsis");
        }
        items.push(sorted[i]);
    }
    return items;
}
