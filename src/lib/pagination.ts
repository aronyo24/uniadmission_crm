/**
 * Shared pagination helpers for list pages (UniversityList, CourseList) that
 * paginate server-side and render a numbered pager with ellipsis for large
 * page counts.
 */

export type PaginationItem = number | 'ellipsis';

export function buildPaginationItems(currentPage: number, totalPages: number): PaginationItem[] {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const items: PaginationItem[] = [1];
    const leftSibling = Math.max(currentPage - 1, 2);
    const rightSibling = Math.min(currentPage + 1, totalPages - 1);

    if (leftSibling > 2) {
        items.push('ellipsis');
    }

    for (let page = leftSibling; page <= rightSibling; page += 1) {
        items.push(page);
    }

    if (rightSibling < totalPages - 1) {
        items.push('ellipsis');
    }

    items.push(totalPages);
    return items;
}
