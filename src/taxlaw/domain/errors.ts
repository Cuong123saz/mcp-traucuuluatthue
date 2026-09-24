/**
 * Domain error codes shared by REST and MCP (api-contract.md "Lỗi",
 * service-contract.md "Error handling"). Transport adapters map these to
 * HTTP status / MCP error envelope; they never invent new codes.
 */
export type DomainErrorCode =
    | "INVALID_ARGUMENT"
    | "NOT_FOUND"
    | "DATA_INTEGRITY_ERROR"
    | "DEPENDENCY_UNAVAILABLE"
    | "INTERNAL_ERROR";

/** Structured, client-safe detail. Never carries SQL, bindings or stack. */
export interface DomainErrorDetail {
    field?: string;
    issue: string;
}

export class DomainError extends Error {
    readonly code: DomainErrorCode;
    readonly details?: DomainErrorDetail[];

    constructor(code: DomainErrorCode, message: string, details?: DomainErrorDetail[]) {
        super(message);
        this.name = "DomainError";
        this.code = code;
        if (details && details.length > 0) {
            this.details = details;
        }
    }
}

export function invalidArgument(message: string, details?: DomainErrorDetail[]): DomainError {
    return new DomainError("INVALID_ARGUMENT", message, details);
}

export function notFound(message: string): DomainError {
    return new DomainError("NOT_FOUND", message);
}

export function dataIntegrityError(message: string): DomainError {
    return new DomainError("DATA_INTEGRITY_ERROR", message);
}

export function dependencyUnavailable(message: string): DomainError {
    return new DomainError("DEPENDENCY_UNAVAILABLE", message);
}

export function internalError(message: string): DomainError {
    return new DomainError("INTERNAL_ERROR", message);
}

export function isDomainError(value: unknown): value is DomainError {
    return value instanceof DomainError;
}

/**
 * Last line of defence before serialization: anything that is not already a
 * DomainError becomes an opaque INTERNAL_ERROR, so driver messages, SQL text
 * and stacks can never reach a response body.
 */
export function toDomainError(value: unknown): DomainError {
    if (isDomainError(value)) {
        return value;
    }
    return internalError("Đã xảy ra lỗi không mong muốn.");
}

export const HTTP_STATUS_BY_CODE: Record<DomainErrorCode, number> = {
    INVALID_ARGUMENT: 400,
    NOT_FOUND: 404,
    DATA_INTEGRITY_ERROR: 409,
    DEPENDENCY_UNAVAILABLE: 503,
    INTERNAL_ERROR: 500
};
