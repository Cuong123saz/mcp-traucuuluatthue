import type pg from "pg";
import { dependencyUnavailable, dataIntegrityError, internalError, isDomainError } from "../domain/errors.js";
import type { RequestContext } from "../domain/dto.js";
import { toDateString } from "../domain/date.js";
import { GET_DOCUMENT_RELATIONS_SQL, GET_TAX_PROVISION_SQL, SEARCH_TAX_LAW_SQL } from "./sql.js";
import type {
    FindProvisionAtInput,
    FindRelationsAtInput,
    ProvisionRow,
    RelationRow,
    SearchTaxLawAtInput,
    TaxLawRepository
} from "./tax-law-repository.js";

/**
 * PostgreSQL implementation. It owns SQL text, parameter binding, connection
 * lifecycle and driver-error translation — and nothing else. No business rule
 * (approval, version choice, pagination arithmetic, provenance checks) lives
 * here; those are the Service's.
 *
 * Both MVP reads are single statements, so PostgreSQL already evaluates each
 * one against one consistent snapshot; an explicit REPEATABLE READ READ ONLY
 * transaction becomes necessary only when a use case issues more than one read
 * (the out-of-MVP document detail / timeline / list cases).
 */
export class PgTaxLawRepository implements TaxLawRepository {
    constructor(private readonly pool: pg.Pool) {}

    async searchTaxLawAt(input: SearchTaxLawAtInput, ctx: RequestContext): Promise<ProvisionRow[]> {
        return this.query(SEARCH_TAX_LAW_SQL, [input.q, input.asOf, input.readLimit, input.offset], ctx, mapProvisionRow);
    }

    async findProvisionAt(input: FindProvisionAtInput, ctx: RequestContext): Promise<ProvisionRow[]> {
        return this.query(GET_TAX_PROVISION_SQL, [input.documentNumber, input.articleKey, input.asOf], ctx, mapProvisionRow);
    }

    async findRelationsAt(input: FindRelationsAtInput, ctx: RequestContext): Promise<RelationRow[]> {
        return this.query(GET_DOCUMENT_RELATIONS_SQL, [input.documentNumber, input.asOf], ctx, mapRelationRow);
    }

    private async query<T>(
        sql: string,
        values: unknown[],
        ctx: RequestContext,
        map: (raw: Record<string, unknown>) => T
    ): Promise<T[]> {
        if (ctx.signal?.aborted) {
            throw dependencyUnavailable("Yêu cầu đã bị hủy trước khi truy vấn dữ liệu.");
        }

        const client = await this.connect();
        let destroyed = false;
        const onAbort = () => {
            destroyed = true;
            // Destroy rather than return to the pool: a connection abandoned
            // mid-statement must never be reused by another request.
            client.release(new Error("request aborted"));
        };
        ctx.signal?.addEventListener("abort", onAbort, { once: true });

        try {
            const result = await client.query({ text: sql, values });
            return result.rows.map(map);
        } catch (error) {
            throw translateDriverError(error);
        } finally {
            ctx.signal?.removeEventListener("abort", onAbort);
            if (!destroyed) {
                client.release();
            }
        }
    }

    private async connect(): Promise<pg.PoolClient> {
        try {
            return await this.pool.connect();
        } catch (error) {
            throw translateDriverError(error);
        }
    }
}

/**
 * Normalizes driver values only. Missing/unparseable values become null here so
 * the Service can reject them as DATA_INTEGRITY_ERROR instead of the row
 * quietly carrying a Date object or undefined into the response.
 */
function mapProvisionRow(raw: Record<string, unknown>): ProvisionRow {
    return {
        documentId: toIdString(raw.documentId),
        documentVersionId: toIdString(raw.documentVersionId),
        provisionId: toIdString(raw.provisionId),
        documentNumber: toTextOrEmpty(raw.documentNumber),
        title: toTextOrEmpty(raw.title),
        articleKey: toTextOrEmpty(raw.articleKey),
        heading: toTextOrEmpty(raw.heading),
        body: toTextOrEmpty(raw.body),
        sourceUrl: toTextOrEmpty(raw.sourceUrl),
        // Cast is safe: an unparseable value becomes null and the Service
        // rejects the row before it can be serialized.
        effectiveFrom: toDateString(raw.effectiveFrom) as string,
        effectiveTo: toDateString(raw.effectiveTo)
    };
}

function mapRelationRow(raw: Record<string, unknown>): RelationRow {
    const direction = raw.direction === "outgoing" || raw.direction === "incoming" ? raw.direction : null;
    return {
        documentNumber: toTextOrEmpty(raw.documentNumber),
        documentTitle: toTextOrEmpty(raw.documentTitle),
        direction,
        relationType: toTextOrNull(raw.relationType),
        otherDocumentNumber: toTextOrNull(raw.otherDocumentNumber),
        otherTitle: toTextOrNull(raw.otherTitle),
        sourceUrl: toTextOrNull(raw.sourceUrl),
        effectiveFrom: toDateString(raw.effectiveFrom),
        effectiveTo: toDateString(raw.effectiveTo)
    };
}

function toTextOrNull(value: unknown): string | null {
    return typeof value === "string" ? value : null;
}

/** bigint columns arrive as strings from node-postgres; keep them as strings. */
function toIdString(value: unknown): string {
    if (typeof value === "string") {
        return value;
    }
    if (typeof value === "number" || typeof value === "bigint") {
        return String(value);
    }
    return "";
}

function toTextOrEmpty(value: unknown): string {
    return typeof value === "string" ? value : "";
}

/**
 * Turns driver failures into domain errors at the boundary. The original
 * message, SQL text and bindings are dropped here, so nothing downstream can
 * accidentally serialize them (api-contract.md "Lỗi").
 */
function translateDriverError(error: unknown): Error {
    if (isDomainError(error)) {
        return error;
    }

    const code = readPgCode(error);

    // 23P01 exclusion_violation: overlapping approved versions. Surface it as
    // an integrity error instead of silently picking one version.
    if (code === "23P01") {
        return dataIntegrityError("Dữ liệu phiên bản văn bản không nhất quán.");
    }

    // 57014 query_canceled, 57P01..57P03 shutdown/crash, 08xxx connection.
    if (
        code === "57014" ||
        code === "57P01" ||
        code === "57P02" ||
        code === "57P03" ||
        (typeof code === "string" && code.startsWith("08")) ||
        isConnectionFailure(error)
    ) {
        return dependencyUnavailable("Không kết nối được nguồn dữ liệu.");
    }

    return internalError("Đã xảy ra lỗi không mong muốn.");
}

function readPgCode(error: unknown): string | undefined {
    if (typeof error === "object" && error !== null && "code" in error) {
        const code = (error as { code: unknown }).code;
        return typeof code === "string" ? code : undefined;
    }
    return undefined;
}

function isConnectionFailure(error: unknown): boolean {
    const code = readPgCode(error);
    if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "ENOTFOUND" || code === "EHOSTUNREACH") {
        return true;
    }
    if (typeof error === "object" && error !== null && "message" in error) {
        const message = (error as { message: unknown }).message;
        return typeof message === "string" && /timeout|terminated|connection/i.test(message);
    }
    return false;
}
