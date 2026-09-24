import { describe, expect, it } from "vitest";
import { TaxLawService } from "../src/taxlaw/service/tax-law-service.js";
import { DomainError } from "../src/taxlaw/domain/errors.js";
import { InMemoryTaxLawRepository, StubTaxLawRepository } from "./support/in-memory-repository.js";
import { FIXTURE_ROWS } from "./support/fixture.js";

const ctx = { requestId: "test-request" };

function service() {
    return new TaxLawService(new InMemoryTaxLawRepository());
}

describe("searchTaxLaw — success", () => {
    it("returns provisions of the approved version in force on asOf, with full provenance", async () => {
        const result = await service().searchTaxLaw({ q: "Thuế", asOf: "2026-01-01" }, ctx);

        expect(result.asOf).toBe("2026-01-01");
        expect(result.items).toHaveLength(1);

        const item = result.items[0]!;
        expect(item).toEqual({
            documentNumber: "DEMO-TAX-001",
            title: "Văn bản thuế minh họa - bản mới",
            versionId: "-102",
            articleKey: "1",
            heading: "Thuế minh họa",
            body: "Thuế áp dụng theo nội dung mới. newonly",
            sourceUrl: "https://example.invalid/tax/001/v2#article-1",
            effectiveFrom: "2026-01-01",
            effectiveTo: null
        });
        // sourceUrl / effectiveFrom / effectiveTo / versionId are mandatory on
        // every item; effectiveTo is present and null, not absent.
        expect(Object.keys(item)).toContain("effectiveTo");
    });

    it("applies limit=20 / offset=0 defaults and reads one extra row to derive hasMore", async () => {
        const repository = new InMemoryTaxLawRepository();
        const result = await new TaxLawService(repository).searchTaxLaw({ q: "Thuế", asOf: "2025-06-15" }, ctx);

        expect(result.pagination).toEqual({ limit: 20, offset: 0, hasMore: false });
        expect(repository.lastSearchCall).toMatchObject({ readLimit: 21, offset: 0 });
    });

    it("reports hasMore=true without returning the probe row", async () => {
        const repository = new InMemoryTaxLawRepository();
        const result = await new TaxLawService(repository).searchTaxLaw(
            { q: "Thuế", asOf: "2025-06-15", limit: 1 },
            ctx
        );

        expect(result.items).toHaveLength(1);
        expect(result.pagination).toEqual({ limit: 1, offset: 0, hasMore: true });
        expect(repository.lastSearchCall?.readLimit).toBe(2);
    });

    it("keeps hasMore null at limit=100, where the SQL cannot be asked for row 101", async () => {
        const repository = new InMemoryTaxLawRepository();
        const result = await new TaxLawService(repository).searchTaxLaw(
            { q: "Thuế", asOf: "2025-06-15", limit: 100 },
            ctx
        );

        expect(repository.lastSearchCall?.readLimit).toBe(100);
        expect(result.pagination.hasMore).toBeNull();
    });
});

describe("searchTaxLaw — empty", () => {
    it("returns an empty page, not an error, when nothing matches", async () => {
        const result = await service().searchTaxLaw({ q: "khongtontai", asOf: "2026-01-01" }, ctx);

        expect(result.items).toEqual([]);
        expect(result.pagination).toEqual({ limit: 20, offset: 0, hasMore: false });
        expect(result.asOf).toBe("2026-01-01");
    });

    it("returns an empty page for an offset past the end", async () => {
        const result = await service().searchTaxLaw({ q: "Thuế", asOf: "2026-01-01", offset: 500 }, ctx);
        expect(result.items).toEqual([]);
    });
});

describe("searchTaxLaw — invalid input", () => {
    const cases: [string, Record<string, unknown>, string][] = [
        ["missing q", { asOf: "2026-01-01" }, "q"],
        ["blank q", { q: "   ", asOf: "2026-01-01" }, "q"],
        ["q over 300 chars", { q: "a".repeat(301), asOf: "2026-01-01" }, "q"],
        ["missing asOf", { q: "Thuế" }, "asOf"],
        ["empty asOf", { q: "Thuế", asOf: "" }, "asOf"],
        ["asOf wrong format", { q: "Thuế", asOf: "01/01/2026" }, "asOf"],
        ["asOf not a real day", { q: "Thuế", asOf: "2026-02-30" }, "asOf"],
        ["asOf is a timestamp", { q: "Thuế", asOf: "2026-01-01T00:00:00Z" }, "asOf"],
        ["limit 0", { q: "Thuế", asOf: "2026-01-01", limit: 0 }, "limit"],
        ["limit 101", { q: "Thuế", asOf: "2026-01-01", limit: 101 }, "limit"],
        ["limit decimal", { q: "Thuế", asOf: "2026-01-01", limit: 1.5 }, "limit"],
        ["limit non-numeric string", { q: "Thuế", asOf: "2026-01-01", limit: "abc" }, "limit"],
        ["negative offset", { q: "Thuế", asOf: "2026-01-01", offset: -1 }, "offset"]
    ];

    it.each(cases)("rejects %s with INVALID_ARGUMENT", async (_name, input, field) => {
        const error = await service()
            .searchTaxLaw(input, ctx)
            .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(DomainError);
        expect((error as DomainError).code).toBe("INVALID_ARGUMENT");
        expect((error as DomainError).details?.some((d) => d.field === field)).toBe(true);
    });

    it("never defaults a missing asOf to today", async () => {
        const repository = new InMemoryTaxLawRepository();
        await new TaxLawService(repository).searchTaxLaw({ q: "Thuế" }, ctx).catch(() => undefined);
        expect(repository.lastSearchCall).toBeUndefined();
    });
});

describe("searchTaxLaw — approved filter and version integrity", () => {
    it("never returns draft or rejected content", async () => {
        for (const [q, asOf] of [
            ["draftonly", "2026-01-01"],
            ["rejectedonly", "2025-06-15"]
        ] as const) {
            const result = await service().searchTaxLaw({ q, asOf }, ctx);
            expect(result.items).toEqual([]);
        }
    });

    it("returns one version per date and never mixes v1 and v2 content", async () => {
        const old = await service().searchTaxLaw({ q: "Thuế", asOf: "2025-06-15" }, ctx);
        expect(old.items.map((item) => item.versionId)).toEqual(["-101", "-101"]);
        expect(old.items.every((item) => item.sourceUrl.includes("/v1#"))).toBe(true);

        const current = await service().searchTaxLaw({ q: "Thuế", asOf: "2026-01-01" }, ctx);
        expect(current.items.every((item) => item.versionId === "-102")).toBe(true);
        expect(current.items.every((item) => item.sourceUrl.includes("/v2#"))).toBe(true);

        // Article 3 exists only in v1 and must not leak into the v2 snapshot.
        const removed = await service().searchTaxLaw({ q: "removedonly", asOf: "2026-01-01" }, ctx);
        expect(removed.items).toEqual([]);
    });
});

describe("searchTaxLaw — effectiveTo boundary", () => {
    it("includes the last day of a bounded version and excludes the next day", async () => {
        const lastDay = await service().searchTaxLaw({ q: "oldonly", asOf: "2025-12-31" }, ctx);
        expect(lastDay.items).toHaveLength(1);
        expect(lastDay.items[0]!.effectiveTo).toBe("2025-12-31");

        const dayAfter = await service().searchTaxLaw({ q: "oldonly", asOf: "2026-01-01" }, ctx);
        expect(dayAfter.items).toEqual([]);
    });

    it("includes the first day and excludes the day before", async () => {
        expect((await service().searchTaxLaw({ q: "oldonly", asOf: "2025-01-01" }, ctx)).items).toHaveLength(1);
        expect((await service().searchTaxLaw({ q: "oldonly", asOf: "2024-12-31" }, ctx)).items).toEqual([]);
    });

    it("matches far-future dates when effectiveTo is null", async () => {
        const result = await service().searchTaxLaw({ q: "newonly", asOf: "2199-12-31" }, ctx);
        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.effectiveTo).toBeNull();
    });
});

describe("searchTaxLaw — provenance invariants", () => {
    it("refuses to serialize a row without a source URL", async () => {
        const broken = { ...FIXTURE_ROWS[3]!, sourceUrl: "" };
        const error = await new TaxLawService(new StubTaxLawRepository([broken]))
            .searchTaxLaw({ q: "Thuế", asOf: "2026-01-01" }, ctx)
            .catch((e: unknown) => e);

        expect((error as DomainError).code).toBe("DATA_INTEGRITY_ERROR");
    });

    it("refuses a row whose interval does not cover asOf", async () => {
        const expiredVersionRow = { ...FIXTURE_ROWS[0]! };
        const error = await new TaxLawService(new StubTaxLawRepository([expiredVersionRow]))
            .searchTaxLaw({ q: "Thuế", asOf: "2026-06-01" }, ctx)
            .catch((e: unknown) => e);

        expect((error as DomainError).code).toBe("DATA_INTEGRITY_ERROR");
    });
});
