import type { DomainError } from "../domain/errors.js";

/**
 * Wire envelopes from api-contract.md. Keeping them in one module guarantees
 * that an error response can only ever carry {code, message, details} — there
 * is no code path that can attach a driver message, SQL text or a stack.
 */

export interface SuccessEnvelope<TData> {
    data: TData;
    requestId: string;
}

export interface PaginatedEnvelope<TData> extends SuccessEnvelope<TData> {
    pagination: { limit: number; offset: number; hasMore: boolean | null };
}

export interface ErrorEnvelope {
    error: {
        code: string;
        message: string;
        details?: { field?: string; issue: string }[];
    };
    requestId: string;
}

export function successEnvelope<TData>(data: TData, requestId: string): SuccessEnvelope<TData> {
    return { data, requestId };
}

export function errorEnvelope(error: DomainError, requestId: string): ErrorEnvelope {
    const envelope: ErrorEnvelope = {
        error: { code: error.code, message: error.message },
        requestId
    };
    if (error.details) {
        envelope.error.details = error.details;
    }
    return envelope;
}
