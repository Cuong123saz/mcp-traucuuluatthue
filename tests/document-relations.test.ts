import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { TaxLawService } from "../src/taxlaw/service/tax-law-service.js";
import { DomainError } from "../src/taxlaw/domain/errors.js";
import { buildApp } from "../src/taxlaw/http/app.js";
import type { RelationRow } from "../src/taxlaw/repository/tax-law-repository.js";
import { InMemoryTaxLawRepository } from "./support/in-memory-repository.js";
import { connectTaxLawMcp, type TestMcpClient } from "./support/mcp-harness.js";

const ctx = { requestId: "test-request" };

const OLD = "954/2020/UBTVQH14";
const NEW = "110/2025/UBTVQH15";
const OLD_TITLE = "Nghị quyết giảm trừ gia cảnh cũ";
const NEW_TITLE = "Nghị quyết giảm trừ gia cảnh mới";
const URL_NEW = "https://example.invalid/nq-110";

/** Rows shaped exactly as query-get-document-relations.sql returns them. */
const ROWS: RelationRow[] = [
    {
        documentNumber: NEW, documentTitle: NEW_TITLE, direction: "outgoing", relationType: "repeals",
        otherDocumentNumber: OLD, otherTitle: OLD_TITLE, sourceUrl: URL_NEW,
        effectiveFrom: "2026-01-01", effectiveTo: null
    },
    {
        documentNumber: OLD, documentTitle: OLD_TITLE, direction: "incoming", relationType: "repeals",
        otherDocumentNumber: NEW, otherTitle: NEW_TITLE, sourceUrl: URL_NEW,
        effectiveFrom: "2026-01-01", effectiveTo: null
    },
    {
        documentNumber: "NO-RELATIONS", documentTitle: "Văn bản độc lập", direction: null, relationType: null,
        otherDocumentNumber: null, otherTitle: null, sourceUrl: null, effectiveFrom: null, effectiveTo: null
    }
];

function service(rows: RelationRow[] = ROWS) {
    return new TaxLawService(new InMemoryTaxLawRepository(undefined, rows));
}

describe("getDocumentRelations", () => {
    it("labels an outgoing repeal from the replacing document's side", async () => {
        const result = await service().getDocumentRelations({ documentNumber: NEW, asOf: "2026-06-01" }, ctx);

        expect(result).toEqual({
            documentNumber: NEW,
            title: NEW_TITLE,
            asOf: "2026-06-01",
            outgoing: [
                {
                    relationType: "repeals",
                    label: "Bãi bỏ / thay thế",
                    documentNumber: OLD,
                    title: OLD_TITLE,
                    sourceUrl: URL_NEW,
                    effectiveFrom: "2026-01-01",
                    effectiveTo: null
                }
            ],
            incoming: []
        });
    });

    it("labels the same relation as incoming on the replaced document", async () => {
        const result = await service().getDocumentRelations({ documentNumber: OLD, asOf: "2026-06-01" }, ctx);

        expect(result.outgoing).toEqual([]);
        expect(result.incoming).toHaveLength(1);
        expect(result.incoming[0]).toMatchObject({ label: "Bị bãi bỏ / thay thế bởi", documentNumber: NEW });
    });

    it("returns empty lists for a document without relations", async () => {
        const result = await service().getDocumentRelations({ documentNumber: "NO-RELATIONS", asOf: "2026-06-01" }, ctx);

        expect(result.outgoing).toEqual([]);
        expect(result.incoming).toEqual([]);
    });

    it("is NOT_FOUND when the document does not exist", async () => {
        await expect(
            service().getDocumentRelations({ documentNumber: "MISSING", asOf: "2026-06-01" }, ctx)
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("requires asOf and a document number", async () => {
        const error = await service()
            .getDocumentRelations({ documentNumber: " ", asOf: undefined }, ctx)
            .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(DomainError);
        expect((error as DomainError).code).toBe("INVALID_ARGUMENT");
        expect((error as DomainError).details?.map((d) => d.field).sort()).toEqual(["asOf", "documentNumber"]);
    });

    it("refuses a relation row without a source URL", async () => {
        const broken = [{ ...ROWS[0]!, sourceUrl: null }];

        await expect(
            service(broken).getDocumentRelations({ documentNumber: NEW, asOf: "2026-06-01" }, ctx)
        ).rejects.toMatchObject({ code: "DATA_INTEGRITY_ERROR" });
    });

    it("refuses a relation row that is not in force on asOf", async () => {
        await expect(
            service().getDocumentRelations({ documentNumber: NEW, asOf: "2025-06-01" }, ctx)
        ).rejects.toMatchObject({ code: "DATA_INTEGRITY_ERROR" });
    });
});

describe("transports", () => {
    let app: FastifyInstance | undefined;
    let client: TestMcpClient | undefined;

    afterEach(async () => {
        await app?.close();
        await client?.close();
        app = undefined;
        client = undefined;
    });

    it("GET /relations and the MCP tool return the same payload", async () => {
        app = buildApp({ service: service() });
        const response = await app.inject({
            method: "GET",
            url: `/relations?documentNumber=${encodeURIComponent(NEW)}&asOf=2026-06-01`
        });
        expect(response.statusCode).toBe(200);

        client = await connectTaxLawMcp(service());
        const result = await client.request("tools/call", {
            name: "get_document_relations",
            arguments: { documentNumber: NEW, asOf: "2026-06-01" }
        });
        expect(result.isError).toBe(false);

        expect(result.structuredContent.data).toEqual(response.json().data);
    });

    it("GET /relations rejects unknown parameters", async () => {
        app = buildApp({ service: service() });
        const response = await app.inject({ method: "GET", url: `/relations?documentNumber=X&asOf=2026-06-01&x=1` });

        expect(response.statusCode).toBe(400);
        expect(response.json().error.code).toBe("INVALID_ARGUMENT");
    });
});
