import { isCalendarDate } from "./calendarDate";
import { inspectSourceUrl, type SourceUrlState } from "./sourceUrl";

/** ProvisionResult exactly as api-contract.md v0.2 defines it. */
export interface ProvisionResult {
    documentNumber: string;
    title: string;
    versionId: string;
    articleKey: string;
    heading: string;
    body: string;
    sourceUrl: string;
    effectiveFrom: string;
    effectiveTo: string | null;
}

/**
 * Shape used while validating an untrusted item. The REST adapter rejects
 * missing/invalid provenance before a response reaches the store. Optional
 * fields remain here so the validator and defensive components can inspect a
 * malformed value without inventing a source or effective date (C-08).
 */
export type ReceivedProvision = Omit<ProvisionResult, "sourceUrl" | "effectiveFrom" | "effectiveTo"> & {
    sourceUrl?: unknown;
    effectiveFrom?: unknown;
    effectiveTo?: unknown;
};

export type EffectiveState =
    | { kind: "applicable" | "mismatch"; from: string; to: string | null }
    | { kind: "missing" };

/**
 * effectiveTo === null is a valid open end; an absent effectiveTo is not the
 * same thing and counts as missing. The interval is inclusive on both ends,
 * and YYYY-MM-DD strings compare correctly with < and >.
 */
export function inspectEffective(p: ReceivedProvision, asOf: string): EffectiveState {
    const from = p.effectiveFrom;
    if (!isCalendarDate(from) || !("effectiveTo" in p)) return { kind: "missing" };
    const to = p.effectiveTo;
    if (to !== null && !isCalendarDate(to)) return { kind: "missing" };
    if (to !== null && to < from) return { kind: "missing" };
    const applicable = from <= asOf && (to === null || asOf <= to);
    return { kind: applicable ? "applicable" : "mismatch", from, to };
}

export interface ProvisionIntegrity {
    source: SourceUrlState;
    effective: EffectiveState;
    /** Missing/invalid source or interval: a data error, not a valid result. */
    hasDataError: boolean;
}

export function inspectProvision(p: ReceivedProvision, asOf: string): ProvisionIntegrity {
    const source = inspectSourceUrl(p.sourceUrl);
    const effective = inspectEffective(p, asOf);
    return {
        source,
        effective,
        hasDataError: source.kind !== "ok" || effective.kind !== "applicable"
    };
}

/** versionId:articleKey is unique: one provision per articleKey per version. */
export function provisionKey(p: Pick<ProvisionResult, "versionId" | "articleKey">): string {
    return `${p.versionId}:${p.articleKey}`;
}

/** DA-06 heuristic: looks like a document number, e.g. 13/2008/QH12. Hint only. */
export function looksLikeDocumentNumber(q: string): boolean {
    const s = q.trim();
    return s.includes("/") && /\d/.test(s) && /\p{L}/u.test(s);
}
