import { isCalendarDate } from "./calendarDate";
import type { ReceivedProvision } from "./provision";
import { inspectProvision, provisionKey } from "./provision";
import { inspectSourceUrl } from "./sourceUrl";

/**
 * REST adapter for GET /search and GET /relations (api-contract.md v0.2). The
 * browser talks HTTP only; MCP stays with AI clients / Inspector (conflict
 * C-07). There is no provision detail call here on purpose: the REST detail
 * envelope is not settled (conflict C-06), so the detail panel renders the
 * search result itself.
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
 * `data`: the success envelope is structurally readable but an item is
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

export type ApiFailure = { ok: false; error: ApiError };
export type ApiOutcome<T> = { ok: true; value: T } | ApiFailure;
export type SearchOutcome = ApiOutcome<SearchResponse>;

export const RELATION_TYPES = ["amends", "repeals", "guides", "consolidates"] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

/** RelationItem exactly as api-contract.md `GET /relations` defines it. */
export interface RelationItem {
    readonly relationType: RelationType;
    readonly label: string;
    readonly documentNumber: string;
    readonly title: string;
    readonly sourceUrl: string;
    readonly effectiveFrom: string;
    readonly effectiveTo: string | null;
}

export interface RelationsInput {
    readonly documentNumber: string;
    readonly asOf: string;
}

export interface RelationsResponse {
    readonly documentNumber: string;
    readonly title: string;
    readonly asOf: string;
    readonly outgoing: readonly RelationItem[];
    readonly incoming: readonly RelationItem[];
    readonly requestId: string;
}

export type RelationsOutcome = ApiOutcome<RelationsResponse>;

export interface TaxLawApi {
    search(input: SearchInput, signal?: AbortSignal): Promise<SearchOutcome>;
    relations(input: RelationsInput, signal?: AbortSignal): Promise<RelationsOutcome>;
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

/** Exactly documentNumber and asOf; the contract rejects any other parameter. */
export function buildRelationsUrl(baseUrl: string, input: RelationsInput): string {
    const params = new URLSearchParams();
    params.set("documentNumber", input.documentNumber);
    params.set("asOf", input.asOf);
    return `${baseUrl.replace(/\/+$/, "")}/relations?${params.toString()}`;
}

type JsonResult = { ok: true; httpOk: boolean; body: unknown } | ApiFailure;

export function createTaxLawApi(options: TaxLawApiOptions): TaxLawApi {
    const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    const timeoutMs = options.timeoutMs ?? 10_000;

    /**
     * GET + JSON with a client timeout. A caller abort is reported as
     * `aborted`; a timeout, rejected fetch or non-JSON body as `network`.
     * The envelope is checked by the route-specific parser.
     */
    async function getJson(url: string, signal: AbortSignal | undefined): Promise<JsonResult> {
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
                response = await doFetch(url, {
                    method: "GET",
                    headers: { Accept: "application/json" },
                    signal: controller.signal
                });
            } catch {
                return fail(!timedOut && signal?.aborted ? { kind: "aborted" } : { kind: "network" });
            }

            try {
                const body: unknown = await response.json();
                return { ok: true, httpOk: response.ok, body };
            } catch {
                if (!timedOut && signal?.aborted) return fail({ kind: "aborted" });
                return fail({ kind: "network" });
            }
        } finally {
            clearTimeout(timer);
            signal?.removeEventListener("abort", onAbort);
        }
    }

    return {
        async search(input, signal) {
            const result = await getJson(buildSearchUrl(options.baseUrl, input), signal);
            if (!result.ok) return result;
            return result.httpOk ? parseSearchSuccess(result.body, input) : parseErrorBody(result.body);
        },

        async relations(input, signal) {
            const result = await getJson(buildRelationsUrl(options.baseUrl, input), signal);
            if (!result.ok) return result;
            return result.httpOk ? parseRelationsSuccess(result.body, input) : parseErrorBody(result.body);
        }
    };
}

function fail(error: ApiError): ApiFailure {
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

export function parseErrorBody(body: unknown): ApiFailure {
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

/**
 * Validates one RelationItem. Unreadable structure (unknown relationType,
 * missing identity or label) is a protocol error. A readable item with a
 * missing/invalid sourceUrl, or an effective interval that is malformed or
 * does not contain asOf, is a data error: the contract only returns relations
 * in effect at asOf (both ends inclusive), each with a source.
 */
function checkRelationItem(raw: unknown, asOf: string): RelationItem | "protocol" | "data" {
    if (!isRecord(raw)) return "protocol";
    const { relationType, label, documentNumber, title, sourceUrl } = raw;
    if (typeof relationType !== "string" || !(RELATION_TYPES as readonly string[]).includes(relationType)) {
        return "protocol";
    }
    if (typeof label !== "string" || label.trim() === "") return "protocol";
    if (typeof documentNumber !== "string" || documentNumber === "") return "protocol";
    if (typeof title !== "string") return "protocol";

    if (typeof sourceUrl !== "string" || inspectSourceUrl(sourceUrl).kind !== "ok") return "data";
    const from = raw.effectiveFrom;
    if (!isCalendarDate(from) || !("effectiveTo" in raw)) return "data";
    const to = raw.effectiveTo;
    if (to !== null && !isCalendarDate(to)) return "data";
    if (to !== null && to < from) return "data";
    if (!(from <= asOf && (to === null || asOf <= to))) return "data";

    return Object.freeze({
        relationType: relationType as RelationType,
        label,
        documentNumber,
        title,
        sourceUrl,
        effectiveFrom: from,
        effectiveTo: to
    });
}

/**
 * Checks a GET /relations success envelope against the request that produced
 * it (same documentNumber and asOf). One invalid item rejects the whole
 * response: the caller shows an error, never a silently shortened list.
 */
export function parseRelationsSuccess(body: unknown, input: RelationsInput): RelationsOutcome {
    const requestId = readRequestId(body);
    const protocol = fail({ kind: "protocol", requestId });
    if (!isRecord(body) || !requestId || !isRecord(body.data)) return protocol;

    const { data } = body;
    if (data.documentNumber !== input.documentNumber || data.asOf !== input.asOf) return protocol;
    if (typeof data.title !== "string") return protocol;
    if (!Array.isArray(data.outgoing) || !Array.isArray(data.incoming)) return protocol;

    const outgoing: RelationItem[] = [];
    const incoming: RelationItem[] = [];
    let dataError = false;
    for (const [rawList, target] of [
        [data.outgoing as unknown[], outgoing],
        [data.incoming as unknown[], incoming]
    ] as const) {
        for (const raw of rawList) {
            const item = checkRelationItem(raw, input.asOf);
            if (item === "protocol") return protocol;
            if (item === "data") dataError = true;
            else target.push(item);
        }
    }
    if (dataError) return fail({ kind: "data", requestId });

    return {
        ok: true,
        value: Object.freeze({
            documentNumber: data.documentNumber,
            title: data.title,
            asOf: data.asOf,
            outgoing: Object.freeze(outgoing),
            incoming: Object.freeze(incoming),
            requestId
        })
    };
}
