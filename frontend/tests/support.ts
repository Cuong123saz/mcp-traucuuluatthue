import type { ReceivedProvision } from "../src/lib/provision";
import type {
    RelationItem,
    RelationsInput,
    RelationsOutcome,
    SearchInput,
    SearchOutcome,
    TaxLawApi
} from "../src/lib/taxLawApi";

/** Synthetic data on example.invalid, mirroring the backend seed shape. */
export function provision(overrides: Partial<Record<keyof ReceivedProvision, unknown>> = {}): ReceivedProvision {
    return {
        documentNumber: "DEMO-TAX-001",
        title: "Văn bản thuế minh họa - bản mới",
        versionId: "9007199254740993",
        articleKey: "1",
        heading: "Thuế minh họa",
        body: "Thuế áp dụng theo nội dung mới.\nDòng thứ hai.",
        sourceUrl: "https://example.invalid/tax/001/v2#article-1",
        effectiveFrom: "2026-01-01",
        effectiveTo: null,
        ...overrides
    } as ReceivedProvision;
}

export function page(input: SearchInput, items: ReceivedProvision[], hasMore: boolean | null): SearchOutcome {
    return {
        ok: true,
        value: {
            asOf: input.asOf,
            items,
            pagination: { limit: input.limit, offset: input.offset, hasMore },
            requestId: `req-${input.asOf}-${input.offset}`
        }
    };
}

interface Call {
    input: SearchInput;
    signal?: AbortSignal;
    resolve: (outcome: SearchOutcome) => void;
}

interface RelationsCall {
    input: RelationsInput;
    signal?: AbortSignal;
    resolve: (outcome: RelationsOutcome) => void;
}

/** A contract RelationItem on example.invalid. */
export function relationItem(overrides: Partial<Record<keyof RelationItem, unknown>> = {}): RelationItem {
    return {
        relationType: "amends",
        label: "Được sửa đổi, bổ sung bởi",
        documentNumber: "DEMO-TAX-002",
        title: "Văn bản sửa đổi minh họa",
        sourceUrl: "https://example.invalid/tax/002",
        effectiveFrom: "2025-07-01",
        effectiveTo: "2026-12-31",
        ...overrides
    } as RelationItem;
}

export function relationsOk(
    input: RelationsInput,
    groups: { incoming?: RelationItem[]; outgoing?: RelationItem[] } = {},
    requestId = `rel-${input.documentNumber}-${input.asOf}`
): RelationsOutcome {
    return {
        ok: true,
        value: {
            documentNumber: input.documentNumber,
            title: "Văn bản thuế minh họa - bản mới",
            asOf: input.asOf,
            incoming: groups.incoming ?? [],
            outgoing: groups.outgoing ?? [],
            requestId
        }
    };
}

/** API whose responses the test resolves by hand, in any order. */
export function manualApi() {
    const calls: Call[] = [];
    const relationCalls: RelationsCall[] = [];
    const api: TaxLawApi = {
        search(input, signal) {
            return new Promise<SearchOutcome>((resolve) => calls.push({ input, signal, resolve }));
        },
        relations(input, signal) {
            return new Promise<RelationsOutcome>((resolve) => relationCalls.push({ input, signal, resolve }));
        }
    };
    return {
        api,
        calls,
        relationCalls,
        lastRelations(): RelationsCall {
            const call = relationCalls[relationCalls.length - 1];
            if (!call) throw new Error("no relations call");
            return call;
        },
        last(): Call {
            const call = calls[calls.length - 1];
            if (!call) throw new Error("no search call");
            return call;
        }
    };
}

export const flush = () => new Promise<void>((r) => setTimeout(r, 0));
