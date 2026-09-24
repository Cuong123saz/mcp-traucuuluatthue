import type { DateString } from "./date.js";

/**
 * DTOs from api-contract.md. bigint IDs are strings so JavaScript cannot lose
 * precision. effectiveTo === null means "no end date"; the field is always
 * present, because a missing field is not the same as null (conflict C-08).
 */
export interface ProvisionResult {
    documentNumber: string;
    title: string;
    versionId: string;
    articleKey: string;
    heading: string;
    body: string;
    sourceUrl: string;
    effectiveFrom: DateString;
    effectiveTo: DateString | null;
}

/**
 * `hasMore` is boolean | null. null appears only at limit=100, where the search
 * SQL cannot be asked for a 101st row (conflict C-04); it means "unknown",
 * never "no more pages".
 */
export interface Pagination {
    limit: number;
    offset: number;
    hasMore: boolean | null;
}

export interface SearchResult {
    asOf: DateString;
    items: ProvisionResult[];
    pagination: Pagination;
}

/** Per-call context: correlation id plus cancellation/deadline propagation. */
export interface RequestContext {
    requestId: string;
    signal?: AbortSignal;
}

export const PAGINATION_DEFAULTS = {
    limit: 20,
    offset: 0,
    minLimit: 1,
    /** Upper bound of the search SQL's own CHECK; do not widen without DB. */
    maxLimit: 100
} as const;

export const STRING_LIMITS = {
    qMin: 1,
    qMax: 300,
    identifierMin: 1,
    identifierMax: 100
} as const;
