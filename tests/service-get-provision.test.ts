import { describe, expect, it } from "vitest";
import { TaxLawService } from "../src/taxlaw/service/tax-law-service.js";
import { DomainError } from "../src/taxlaw/domain/errors.js";
import { InMemoryTaxLawRepository, StubTaxLawRepository } from "./support/in-memory-repository.js";
import { FIXTURE_ROWS } from "./support/fixture.js";

const ctx = { requestId: "test-request" };

function service() {
    return new TaxLawService(new InMemoryTaxLawRepository());
}

describe("getTaxProvision — success", () => {
    it("returns the provision from the approved version in force on asOf", async () => {
        const result = await service().getTaxProvision(
            { documentNumber: "DEMO-TAX-001", articleKey: "1", asOf: "2026-01-01" },
            ctx
        );

        expect(result).toEqual({
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
    });

    it("returns the older version for a date inside the older interval", async () => {
        const result = await service().getTaxProvision(
            { documentNumber: "DEMO-TAX-001", articleKey: "1", asOf: "2025-06-15" },
            ctx
        );

        expect(result.versionId).toBe("-101");
        expect(result.body).toContain("oldonly");
        expect(result.sourceUrl).toBe("https://example.invalid/tax/001/v1#article-1");
        expect(result.effectiveTo).toBe("2025-12-31");
    });

    it("trims identifiers before looking them up", async () => {
        const result = await service().getTaxProvision(
            { documentNumber: "  DEMO-TAX-001  ", articleKey: " 1 ", asOf: "2026-01-01" },
            ctx
        );
        expect(result.versionId).toBe("-102");
    });
});

describe("getTaxProvision — not found", () => {
    const cases: [string, { documentNumber: string; articleKey: string; asOf: string }][] = [
        ["unknown document number", { documentNumber: "DEMO-TAX-999", articleKey: "1", asOf: "2026-01-01" }],
        ["unknown article key", { documentNumber: "DEMO-TAX-001", articleKey: "99", asOf: "2026-01-01" }],
        ["date before any approved version", { documentNumber: "DEMO-TAX-001", articleKey: "1", asOf: "2024-01-01" }],
        [
            "article removed in the version in force",
            { documentNumber: "DEMO-TAX-001", articleKey: "3", asOf: "2026-01-01" }
        ]
    ];

    it.each(cases)("maps %s to NOT_FOUND without falling back", async (_name, input) => {
        const error = await service()
            .getTaxProvision(input, ctx)
            .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(DomainError);
        expect((error as DomainError).code).toBe("NOT_FOUND");
        // A NOT_FOUND carries no data at all — no fallback date, no other
        // version, no partial payload.
        expect(Object.keys(error as object)).not.toContain("data");
    });
});

describe("getTaxProvision — invalid input", () => {
    const cases: [string, Record<string, unknown>, string][] = [
        ["missing documentNumber", { articleKey: "1", asOf: "2026-01-01" }, "documentNumber"],
        ["blank documentNumber", { documentNumber: " ", articleKey: "1", asOf: "2026-01-01" }, "documentNumber"],
        ["missing articleKey", { documentNumber: "DEMO-TAX-001", asOf: "2026-01-01" }, "articleKey"],
        ["missing asOf", { documentNumber: "DEMO-TAX-001", articleKey: "1" }, "asOf"],
        [
            "invalid calendar date",
            { documentNumber: "DEMO-TAX-001", articleKey: "1", asOf: "2026-02-30" },
            "asOf"
        ],
        [
            "identifier over 100 chars",
            { documentNumber: "x".repeat(101), articleKey: "1", asOf: "2026-01-01" },
            "documentNumber"
        ]
    ];

    it.each(cases)("rejects %s with INVALID_ARGUMENT", async (_name, input, field) => {
        const error = await service()
            .getTaxProvision(input, ctx)
            .catch((e: unknown) => e);

        expect((error as DomainError).code).toBe("INVALID_ARGUMENT");
        expect((error as DomainError).details?.some((d) => d.field === field)).toBe(true);
    });
});

describe("getTaxProvision — approved filter", () => {
    it("does not expose a draft version even on a date it would cover", async () => {
        // Version -103 is a draft covering 2026-01-01 onwards with article 1.
        // The answer must come from the approved version -102 instead.
        const result = await service().getTaxProvision(
            { documentNumber: "DEMO-TAX-001", articleKey: "1", asOf: "2026-05-01" },
            ctx
        );

        expect(result.versionId).toBe("-102");
        expect(result.body).not.toContain("draftonly");
    });

    it("does not expose a rejected version", async () => {
        const error = await service()
            .getTaxProvision({ documentNumber: "DEMO-TAX-002", articleKey: "1", asOf: "2025-06-15" }, ctx)
            .catch((e: unknown) => e);

        expect((error as DomainError).code).toBe("NOT_FOUND");
    });
});

describe("getTaxProvision — effectiveTo boundary", () => {
    it("treats the last effective day as in force (inclusive end)", async () => {
        const lastDay = await service().getTaxProvision(
            { documentNumber: "DEMO-TAX-001", articleKey: "1", asOf: "2025-12-31" },
            ctx
        );

        expect(lastDay.versionId).toBe("-101");
        expect(lastDay.effectiveTo).toBe("2025-12-31");
    });

    it("switches to the next version on the following day", async () => {
        const nextDay = await service().getTaxProvision(
            { documentNumber: "DEMO-TAX-001", articleKey: "1", asOf: "2026-01-01" },
            ctx
        );

        expect(nextDay.versionId).toBe("-102");
        expect(nextDay.effectiveFrom).toBe("2026-01-01");
    });

    it("treats the first effective day as in force (inclusive start)", async () => {
        const firstDay = await service().getTaxProvision(
            { documentNumber: "DEMO-TAX-001", articleKey: "1", asOf: "2025-01-01" },
            ctx
        );
        expect(firstDay.versionId).toBe("-101");
    });

    it("stays in force indefinitely when effectiveTo is null", async () => {
        const farFuture = await service().getTaxProvision(
            { documentNumber: "DEMO-TAX-001", articleKey: "1", asOf: "2199-12-31" },
            ctx
        );
        expect(farFuture.versionId).toBe("-102");
        expect(farFuture.effectiveTo).toBeNull();
    });
});

describe("getTaxProvision — integrity", () => {
    it("reports overlapping approved versions instead of picking one", async () => {
        const duplicated = [FIXTURE_ROWS[3]!, { ...FIXTURE_ROWS[3]!, documentVersionId: "-999" }];
        const error = await new TaxLawService(new StubTaxLawRepository(duplicated))
            .getTaxProvision({ documentNumber: "DEMO-TAX-001", articleKey: "1", asOf: "2026-01-01" }, ctx)
            .catch((e: unknown) => e);

        expect((error as DomainError).code).toBe("DATA_INTEGRITY_ERROR");
    });

    it("refuses a row with a missing effective interval rather than inventing one", async () => {
        const broken = { ...FIXTURE_ROWS[3]!, effectiveFrom: "" };
        const error = await new TaxLawService(new StubTaxLawRepository([broken as never]))
            .getTaxProvision({ documentNumber: "DEMO-TAX-001", articleKey: "1", asOf: "2026-01-01" }, ctx)
            .catch((e: unknown) => e);

        expect((error as DomainError).code).toBe("DATA_INTEGRITY_ERROR");
    });
});
