/**
 * Small formatting helpers shared by course/university display components.
 * Kept separate from api.ts so components can import just formatting logic.
 */

/**
 * Format a tuition amount with its real currency (e.g. "£17,500"), instead of
 * assuming everything is priced in USD. Returns a friendly fallback when the
 * amount is missing (common for courses whose fee text couldn't be parsed).
 */
export function formatTuition(amount?: number | null, currency?: string | null): string {
    if (amount === null || amount === undefined || Number.isNaN(amount)) {
        return 'Contact university';
    }

    if (currency) {
        try {
            return new Intl.NumberFormat('en-GB', {
                style: 'currency',
                currency,
                currencyDisplay: 'narrowSymbol',
                maximumFractionDigits: 0,
            }).format(amount);
        } catch {
            // Unrecognized/invalid ISO currency code - fall through to plain text.
        }
    }

    return `${amount.toLocaleString()}${currency ? ` ${currency}` : ''}`;
}

/**
 * Format a compact tuition figure for tight spaces (course cards), e.g. "£17.5K".
 */
export function formatTuitionCompact(amount?: number | null, currency?: string | null): string {
    if (amount === null || amount === undefined || Number.isNaN(amount)) {
        return 'Contact university';
    }

    const symbol = getCurrencySymbol(currency);
    if (amount >= 1000) {
        return `${symbol}${(amount / 1000).toFixed(1)}K`;
    }
    return `${symbol}${amount.toLocaleString()}`;
}

function getCurrencySymbol(currency?: string | null): string {
    if (!currency) return '';
    try {
        const parts = new Intl.NumberFormat('en-GB', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).formatToParts(0);
        return parts.find((part) => part.type === 'currency')?.value ?? `${currency} `;
    } catch {
        return `${currency} `;
    }
}

/**
 * Format an English test score (IELTS/TOEFL/PTE), stripping trailing ".0" noise
 * for whole-number scores while keeping one decimal for fractional ones.
 */
export function formatScore(value?: number | null): string {
    if (value === null || value === undefined || Number.isNaN(value) || value <= 0) {
        return '';
    }
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
