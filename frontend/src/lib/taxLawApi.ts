import type { ReceivedProvision } from "./provision";
import { inspectProvision, provisionKey } from "./provision";

/**
 * REST adapter for GET /search (api-contract.md v0.2). The browser talks HTTP
 * only; MCP stays with AI clients / Inspector (conflict C-07). There is no
 * detail call here on purpose: the REST detail envelope is not settled
 * (conflict C-06), so the detail panel renders the search result itself.
 */

export interface SearchInput {
    readonly q: string;
    readonly asOf: string;
    readonly limit: number;
    readonly offset: number;
}

export interface Pagination {
    limit: number;
    offset: number;
    hasMore: boolean | null;
}

export interface SearchResponse {
    asOf: string;
    items: ReceivedProvision[];
    pagination: Pagination;
    requestId: string;
}

export const DOMAIN_ERROR_CODES = [
    "INVALID_ARGUMENT",
    "NOT_FOUND",
    "DATA_INTEGRITY_ERROR",
    "DEPENDENCY_UNAVAILABLE",
    "INTERNAL_ERROR"
] as const;
export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

/**
 * `domain`: the server answered with a contract error envelope.
 * `network`: no usable HTTP response (offline, DNS, timeout, non-JSON body).
 * `protocol`: JSON arrived but does not match the contract. This is a client
 * side integration error; it is never relabelled as a server domain code.
 * `data`: the success envelope is structurally readable but a provision is
 * missing/has invalid provenance. It is a client-side data error, not a
 * DATA_INTEGRITY_ERROR allegedly returned by the server.
 * `aborted`: superseded by a newer request; not shown to the user.
 */
export type ApiError =
    | { kind: "domain"; code: DomainErrorCode; requestId?: string }
    | { kind: "network" }
    | { kind: "protocol"; requestId?: string }
    | { kind: "data"; requestId?: string }
    | { kind: "aborted" };

export type SearchOutcome = { ok: true; value: SearchResponse } | { ok: false; error: ApiError };

export interface TaxLawApi {
    search(input: SearchInput, signal?: AbortSignal): Promise<SearchOutcome>;
}

export interface TaxLawApiOptions {
    baseUrl: string;
    timeoutMs?: number;
    fetch?: typeof fetch;
}

/** Only the four contract parameters, in a fixed order; never a state spread. */
export function buildSearchUrl(baseUrl: string, input: SearchInput): string {
    const params = new URLSearchParams();
    params.set("q", input.q);
    params.set("asOf", input.asOf);
    params.set("limit", String(input.limit));
    params.set("offset", String(input.offset));
    return `${baseUrl.replace(/\/+$/, "")}/search?${params.toString()}`;
}

export function createTaxLawApi(options: TaxLawApiOptions): TaxLawApi {
    const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    const timeoutMs = options.timeoutMs ?? 10_000;

    return {
        async search(input, signal) {
            const controller = new AbortController();
            let timedOut = false;
            const timer = setTimeout(() => {
                timedOut = true;
                controller.abort();
            }, timeoutMs);
            const onAbort = () => controller.abort();
            signal?.addEventListener("abort", onAbort);

            try {
                let response: Response;
                try {
                    response = await doFetch(buildSearchUrl(options.baseUrl, input), {
                        method: "GET",
                        headers: { Accept: "application/json" },
                        signal: controller.signal
                    });
                } catch {
                    return fail(!timedOut && signal?.aborted ? { kind: "aborted" } : { kind: "network" });
                }

                let body: unknown;
                try {
                    body = await response.json();
                } catch {
                    if (!timedOut && signal?.aborted) return fail({ kind: "aborted" });
                    return fail({ kind: "network" });
                }
                return response.ok ? parseSearchSuccess(body, input) : parseErrorBody(body);
            } finally {
                clearTimeout(timer);
                signal?.removeEventListener("abort", onAbort);
            }
        }
    };
}

function fail(error: ApiError): SearchOutcome {
    return { ok: false, error };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRequestId(body: unknown): string | undefined {
    return isRecord(body) && typeof body.requestId === "string" && body.requestId !== ""
        ? body.requestId
        : undefined;
}

export function parseErrorBody(body: unknown): SearchOutcome {
    const requestId = readRequestId(body);
    const code = isRecord(body) && isRecord(body.error) ? body.error.code : undefined;
    if (typeof code === "string" && (DOMAIN_ERROR_CODES as readonly string[]).includes(code)) {
        return fail({ kind: "domain", code: code as DomainErrorCode, requestId });
    }
    return fail({ kind: "protocol", requestId });
}

const TEXT_FIELDS = ["documentNumber", "title", "articleKey", "heading", "body"] as const;
const IDENTITY_FIELDS = ["documentNumber", "articleKey"] as const;

/**
 * Checks the success envelope against the request that produced it. Anything
 * that would make the page lie (wrong date, wrong page, hasMore guessed,
 * unidentifiable items) is rejected as a protocol error. A readable item with
 * missing/invalid source, effective interval, or versionId is rejected as a
 * data error before the store can replace its last valid snapshot.
 */
export function parseSearchSuccess(body: unknown, input: SearchInput): SearchOutcome {
    const requestId = readRequestId(body);
    const protocol = fail({ kind: "protocol", requestId });
    if (!isRecord(body) || !requestId || !isRecord(body.data) || !isRecord(body.pagination)) return protocol;

    const { data, pagination } = body;
    if (data.asOf !== input.asOf || !Array.isArray(data.items)) return protocol;
    if (pagination.limit !== input.limit || pagination.offset !== input.offset) return protocol;

    const hasMore = pagination.hasMore;
    const hasMoreValid =
        hasMore === true || hasMore === false || (hasMore === null && input.limit === 100);
    if (!hasMoreValid) return protocol;
    if (data.items.length > input.limit) return protocol;

    const seen = new Set<string>();
    const items: ReceivedProvision[] = [];
    for (const raw of data.items) {
        if (!isRecord(raw)) return protocol;
        if (TEXT_FIELDS.some((f) => typeof raw[f] !== "string")) return protocol;
        if (IDENTITY_FIELDS.some((f) => raw[f] === "")) return protocol;
        const item = { ...raw } as unknown as ReceivedProvision;
        if (typeof raw.versionId !== "string" || raw.versionId === "") {
            return fail({ kind: "data", requestId });
        }
        if (inspectProvision(item, input.asOf).hasDataError) {
            return fail({ kind: "data", requestId });
        }
        const key = provisionKey(item);
        if (seen.has(key)) return protocol;
        seen.add(key);
        items.push(Object.freeze(item));
    }

    return {
        ok: true,
        value: {
            asOf: data.asOf,
            items,
            pagination: { limit: input.limit, offset: input.offset, hasMore: hasMore as boolean | null },
            requestId
        }
    };
}
