import { dataIntegrityError, notFound } from "../domain/errors.js";
import { isCalendarDate, type DateString } from "../domain/date.js";
import {
    PAGINATION_DEFAULTS,
    type DocumentRelationsResult,
    type ProvisionResult,
    type RelationItem,
    type RelationType,
    type RequestContext,
    type SearchResult
} from "../domain/dto.js";
import type { ProvisionRow, RelationRow, TaxLawRepository } from "../repository/tax-law-repository.js";
import {
    validateProvisionInput,
    validateRelationsInput,
    validateSearchInput,
    type RawProvisionInput,
    type RawRelationsInput,
    type RawSearchInput
} from "./validation.js";

/**
 * The single place business rules live. Fastify routes and MCP handlers both
 * call this, so approval filtering, asOf handling, pagination arithmetic,
 * provenance checks and error codes cannot diverge between transports
 * (mcp-tools.md: "Dùng đúng Service chung với Fastify").
 */
export class TaxLawService {
    constructor(private readonly repository: TaxLawRepository) {}

    async searchTaxLaw(raw: RawSearchInput, ctx: RequestContext): Promise<SearchResult> {
        const input = validateSearchInput(raw);

        // Read one extra row to learn whether a next page exists. At limit=100
        // the search SQL's own CHECK ($3 BETWEEN 1 AND 100) makes that
        // impossible, so hasMore stays null — "unknown", not "no more"
        // (conflict C-04 / assumption A-02).
        const canProbeNextPage = input.limit < PAGINATION_DEFAULTS.maxLimit;
        const readLimit = canProbeNextPage ? input.limit + 1 : input.limit;

        const rows = await this.repository.searchTaxLawAt(
            { q: input.q, asOf: input.asOf, readLimit, offset: input.offset },
            ctx
        );

        const hasMore = canProbeNextPage ? rows.length > input.limit : null;
        const pageRows = rows.slice(0, input.limit);
        const items = pageRows.map((row) => this.toProvisionResult(row, input.asOf));

        return {
            asOf: input.asOf,
            items,
            pagination: { limit: input.limit, offset: input.offset, hasMore }
        };
    }

    async getTaxProvision(raw: RawProvisionInput, ctx: RequestContext): Promise<ProvisionResult> {
        const input = validateProvisionInput(raw);

        const rows = await this.repository.findProvisionAt(
            { documentNumber: input.documentNumber, articleKey: input.articleKey, asOf: input.asOf },
            ctx
        );

        // No approved version contains asOf, or the article does not exist in
        // that version. Never fall back to another version or another date.
        if (rows.length === 0) {
            throw notFound("Không tìm thấy điều khoản áp dụng tại ngày yêu cầu.");
        }

        // The EXCLUDE constraint should make this impossible. If it happens,
        // report it instead of picking a row.
        if (rows.length > 1) {
            throw dataIntegrityError("Tìm thấy nhiều phiên bản được duyệt cho cùng một ngày.");
        }

        return this.toProvisionResult(rows[0]!, input.asOf);
    }

    /**
     * Quan hệ còn hiệu lực tại asOf của một văn bản, theo cả hai chiều.
     * Văn bản không tồn tại là NOT_FOUND; tồn tại mà không có quan hệ thì trả
     * hai danh sách rỗng.
     */
    async getDocumentRelations(raw: RawRelationsInput, ctx: RequestContext): Promise<DocumentRelationsResult> {
        const input = validateRelationsInput(raw);
        const rows = await this.repository.findRelationsAt(input, ctx);

        if (rows.length === 0) {
            throw notFound("Không tìm thấy văn bản.");
        }

        const first = rows[0]!;
        assertNonBlank(first.documentNumber, "documentNumber");
        assertNonBlank(first.documentTitle, "title");

        const outgoing: RelationItem[] = [];
        const incoming: RelationItem[] = [];
        for (const row of rows) {
            if (row.direction === null) {
                continue;
            }
            const item = toRelationItem(row, input.asOf);
            (row.direction === "outgoing" ? outgoing : incoming).push(item);
        }

        return {
            documentNumber: first.documentNumber,
            title: first.documentTitle,
            asOf: input.asOf,
            outgoing,
            incoming
        };
    }

    /**
     * Maps a row to the wire DTO and enforces the provenance invariants. A row
     * without a source URL or a usable effective interval is a data defect: it
     * must surface as an error, never as a valid-looking success item
     * (conflict C-08).
     */
    private toProvisionResult(row: ProvisionRow, asOf: DateString): ProvisionResult {
        assertNonBlank(row.documentNumber, "documentNumber");
        assertNonBlank(row.title, "title");
        assertNonBlank(row.documentVersionId, "versionId");
        assertNonBlank(row.articleKey, "articleKey");
        assertNonBlank(row.heading, "heading");
        assertNonBlank(row.body, "body");
        assertSourceUrl(row.sourceUrl);
        assertInterval(row, asOf);

        return {
            documentNumber: row.documentNumber,
            // Title of the selected version, not of the document.
            title: row.title,
            versionId: row.documentVersionId,
            articleKey: row.articleKey,
            heading: row.heading,
            body: row.body,
            // Source of the provision itself; a document- or version-level URL
            // must never be substituted here.
            sourceUrl: row.sourceUrl,
            effectiveFrom: row.effectiveFrom,
            // Always present. null means "no end date"; it is not the same as
            // an absent field.
            effectiveTo: row.effectiveTo
        };
    }
}

const RELATION_LABELS: Record<RelationType, { outgoing: string; incoming: string }> = {
    amends: { outgoing: "Sửa đổi, bổ sung", incoming: "Được sửa đổi, bổ sung bởi" },
    repeals: { outgoing: "Bãi bỏ / thay thế", incoming: "Bị bãi bỏ / thay thế bởi" },
    guides: { outgoing: "Hướng dẫn thi hành", incoming: "Được hướng dẫn bởi" },
    consolidates: { outgoing: "Hợp nhất", incoming: "Được hợp nhất bởi" }
};

function toRelationItem(row: RelationRow, asOf: DateString): RelationItem {
    const type = row.relationType as RelationType | null;
    if (type === null || !(type in RELATION_LABELS)) {
        throw dataIntegrityError("Dữ liệu sai loại quan hệ văn bản.");
    }
    assertNonBlank(row.otherDocumentNumber ?? "", "relation.documentNumber");
    assertNonBlank(row.otherTitle ?? "", "relation.title");
    assertSourceUrl(row.sourceUrl ?? "");
    const effectiveFrom = row.effectiveFrom ?? "";
    if (!isCalendarDate(effectiveFrom) || effectiveFrom > asOf) {
        throw dataIntegrityError("Quan hệ văn bản trả về không có hiệu lực tại ngày yêu cầu.");
    }
    if (row.effectiveTo !== null && (!isCalendarDate(row.effectiveTo) || asOf > row.effectiveTo)) {
        throw dataIntegrityError("Quan hệ văn bản trả về không có hiệu lực tại ngày yêu cầu.");
    }

    return {
        relationType: type,
        label: RELATION_LABELS[type][row.direction === "outgoing" ? "outgoing" : "incoming"],
        documentNumber: row.otherDocumentNumber!,
        title: row.otherTitle!,
        sourceUrl: row.sourceUrl!,
        effectiveFrom,
        effectiveTo: row.effectiveTo
    };
}

function assertNonBlank(value: string, field: string): void {
    if (typeof value !== "string" || value.trim() === "") {
        throw dataIntegrityError(`Dữ liệu thiếu trường bắt buộc: ${field}.`);
    }
}

function assertSourceUrl(value: string): void {
    if (typeof value !== "string" || !/^https?:\/\/[^\s]+$/.test(value)) {
        throw dataIntegrityError("Dữ liệu thiếu hoặc sai nguồn dẫn chiếu.");
    }
}

/**
 * Guard, not a second selection mechanism: SQL containment over the generated
 * daterange decides which version is returned. This only refuses to serialize a
 * row whose interval does not actually cover asOf, so a repository bug cannot
 * present the wrong version as a valid answer. Both ends are inclusive, so
 * asOf === effectiveTo is a match; YYYY-MM-DD compares lexicographically in
 * calendar order.
 */
function assertInterval(row: ProvisionRow, asOf: DateString): void {
    if (!isCalendarDate(row.effectiveFrom)) {
        throw dataIntegrityError("Dữ liệu thiếu hoặc sai ngày bắt đầu hiệu lực.");
    }
    if (row.effectiveTo !== null && !isCalendarDate(row.effectiveTo)) {
        throw dataIntegrityError("Dữ liệu sai ngày kết thúc hiệu lực.");
    }
    if (row.effectiveFrom > asOf) {
        throw dataIntegrityError("Phiên bản trả về không có hiệu lực tại ngày yêu cầu.");
    }
    if (row.effectiveTo !== null && asOf > row.effectiveTo) {
        throw dataIntegrityError("Phiên bản trả về không có hiệu lực tại ngày yêu cầu.");
    }
}
