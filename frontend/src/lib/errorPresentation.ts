import type { CopyKey } from "./copy";
import type { ApiError } from "./taxLawApi";

export interface ErrorPresentation {
    titleKey: CopyKey;
    bodyKey: CopyKey;
    retryable: boolean;
    requestId?: string;
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
