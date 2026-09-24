import type { RequestContext } from "../domain/dto.js";
import type { DateString } from "../domain/date.js";

/**
 * Raw row shape produced by both query artifacts. Values are exactly what the
 * driver returned: bigint columns arrive as strings, date columns as
 * `YYYY-MM-DD` strings (see db/pool.ts). Mapping to DTOs and every business
 * rule belong to the Service, not here.
 */
export interface ProvisionRow {
    documentId: string;
    documentVersionId: string;
    provisionId: string;
    documentNumber: string;
    title: string;
    articleKey: string;
    heading: string;
    body: string;
    sourceUrl: string;
    effectiveFrom: DateString;
    effectiveTo: DateString | null;
}

export interface SearchTaxLawAtInput {
    q: string;
    asOf: DateString;
    /**
     * The LIMIT actually bound into SQL, which is NOT the client's page size:
     * the Service asks for one extra row to derive `hasMore` and trims the
     * result itself (conflict C-04 — "phân biệt limit SQL với limit trả
     * client"). The search SQL caps this at 100.
     */
    readLimit: number;
    offset: number;
}

export interface FindProvisionAtInput {
    documentNumber: string;
    articleKey: string;
    asOf: DateString;
}

export interface FindRelationsAtInput {
    documentNumber: string;
    asOf: DateString;
}

/**
 * Raw row from query-get-document-relations.sql. Zero rows means the document
 * does not exist; a row with `direction === null` means it exists but has no
 * relation in force at asOf.
 */
export interface RelationRow {
    documentNumber: string;
    documentTitle: string;
    direction: "outgoing" | "incoming" | null;
    relationType: string | null;
    otherDocumentNumber: string | null;
    otherTitle: string | null;
    sourceUrl: string | null;
    effectiveFrom: DateString | null;
    effectiveTo: DateString | null;
}

/**
 * Only the MVP reads plus document relations are declared. findDocumentAt / listProvisionsAt /
 * listApprovedVersions / listDocumentsAt from service-contract.md are out of
 * MVP scope (conflicts C-01/C-02/C-03) and deliberately absent rather than
 * stubbed.
 */
export interface TaxLawRepository {
    searchTaxLawAt(input: SearchTaxLawAtInput, ctx: RequestContext): Promise<ProvisionRow[]>;
    /**
     * Returns every matching row instead of `ProvisionRow | null`: the Service
     * must be able to see a duplicate and raise DATA_INTEGRITY_ERROR. Hiding it
     * behind `LIMIT 1` is explicitly forbidden by service-contract.md.
     */
    findProvisionAt(input: FindProvisionAtInput, ctx: RequestContext): Promise<ProvisionRow[]>;
    findRelationsAt(input: FindRelationsAtInput, ctx: RequestContext): Promise<RelationRow[]>;
}
