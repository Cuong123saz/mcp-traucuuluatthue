import type { CopyKey } from "./copy";
import type { ApiError } from "./taxLawApi";

export interface ErrorPresentation {
    titleKey: CopyKey;
    bodyKey: CopyKey;
    retryable: boolean;
    requestId?: string;
}

/**
 * Maps a GET /relations failure to ui-copy §10.1 keys and retry policy
 * (component-guidelines.md §10a error table). Copy vars ({documentNumber},
 * {asOf}) are filled by the component.
 *
 * `protocol` (JSON that does not match the contract) uses generic copy and
 * may be retried, like search. `data` (a 200 item without a valid source or
 * with an interval not containing asOf) uses the data-integrity copy and is
 * not retryable: retrying would return the same data.
 */
export function presentRelationsError(error: Exclude<ApiError, { kind: "aborted" }>): ErrorPresentation {
    const generic = { titleKey: "relations.error.generic.title", bodyKey: "relations.error.generic.body" } as const;
    const integrity = {
        titleKey: "relations.error.dataIntegrity.title",
        bodyKey: "relations.error.dataIntegrity.body"
    } as const;
    switch (error.kind) {
        case "network":
            return { ...generic, retryable: true };
        case "protocol":
            return { ...generic, retryable: true, requestId: error.requestId };
        case "data":
            return { ...integrity, retryable: false, requestId: error.requestId };
        case "domain":
            switch (error.code) {
                case "NOT_FOUND":
                    return {
                        titleKey: "relations.error.notFound.title",
                        bodyKey: "relations.error.notFound.body",
                        retryable: false,
                        requestId: error.requestId
                    };
                case "DATA_INTEGRITY_ERROR":
                    return { ...integrity, retryable: false, requestId: error.requestId };
                case "INVALID_ARGUMENT":
                    return { ...generic, retryable: false, requestId: error.requestId };
                case "DEPENDENCY_UNAVAILABLE":
                case "INTERNAL_ERROR":
                    return { ...generic, retryable: true, requestId: error.requestId };
            }
    }
}

/**
 * Maps a search failure to ui-copy keys and retry policy
 * (component-guidelines.md §13, integration-notes.md §5). The server's
 * error.message / error.details are never shown.
 *
 * NOT_FOUND is not a defined outcome of GET /search; the backend only returns
 * it for an unknown route (e.g. a wrong VITE_TAXLAW_API_BASE_URL). It is shown
 * with the generic error copy, not the detail "không có điều khoản" copy.
 */
export function presentSearchError(error: Exclude<ApiError, { kind: "aborted" }>): ErrorPresentation {
    switch (error.kind) {
        case "network":
            return { titleKey: "error.network.title", bodyKey: "error.network.body", retryable: true };
        case "protocol":
            return {
                titleKey: "error.internal.title",
                bodyKey: "error.internal.body",
                retryable: true,
                requestId: error.requestId
            };
        case "data":
            return {
                titleKey: "error.dataIntegrity.title",
                bodyKey: "error.dataIntegrity.body",
                retryable: false,
                requestId: error.requestId
            };
        case "domain":
            switch (error.code) {
                case "INVALID_ARGUMENT":
                    return {
                        titleKey: "error.invalidArgument.title",
                        bodyKey: "error.invalidArgument.body",
                        retryable: false,
                        requestId: error.requestId
                    };
                case "DATA_INTEGRITY_ERROR":
                    return {
                        titleKey: "error.dataIntegrity.title",
                        bodyKey: "error.dataIntegrity.body",
                        retryable: false,
                        requestId: error.requestId
                    };
                case "DEPENDENCY_UNAVAILABLE":
                    return {
                        titleKey: "error.dependencyUnavailable.title",
                        bodyKey: "error.dependencyUnavailable.body",
                        retryable: true,
                        requestId: error.requestId
                    };
                case "NOT_FOUND":
                case "INTERNAL_ERROR":
                    return {
                        titleKey: "error.internal.title",
                        bodyKey: "error.internal.body",
                        retryable: true,
                        requestId: error.requestId
                    };
            }
    }
}
