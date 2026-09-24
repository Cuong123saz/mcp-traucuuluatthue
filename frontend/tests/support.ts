import type { ReceivedProvision } from "../src/lib/provision";
import type { SearchInput, SearchOutcome, TaxLawApi } from "../src/lib/taxLawApi";

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

/** API whose responses the test resolves by hand, in any order. */
export function manualApi() {
    const calls: Call[] = [];
    const api: TaxLawApi = {
        search(input, signal) {
            return new Promise<SearchOutcome>((resolve) => calls.push({ input, signal, resolve }));
        }
    };
    return {
        api,
        calls,
        last(): Call {
            const call = calls[calls.length - 1];
            if (!call) throw new Error("no search call");
            return call;
        }
    };
}

export const flush = () => new Promise<void>((r) => setTimeout(r, 0));
