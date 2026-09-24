import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type pg from "pg";
import { createPool } from "../src/taxlaw/db/pool.js";
import { PgTaxLawRepository } from "../src/taxlaw/repository/pg-tax-law-repository.js";
import { TaxLawService } from "../src/taxlaw/service/tax-law-service.js";
import { DomainError } from "../src/taxlaw/domain/errors.js";

/**
 * Runs the real query artifacts against a real PostgreSQL 15+ instance.
 *
 * These tests are the only ones that prove the SQL itself; the in-memory
 * repository used elsewhere only approximates it. They are skipped unless
 * TEST_DATABASE_URL points at a DISPOSABLE database, because they drop and
 * recreate the public schema:
 *
 *   TEST_DATABASE_URL=postgres://user:pass@localhost:5432/taxlaw_test npm run test:integration
 */
const connectionString = process.env.TEST_DATABASE_URL;
const ctx = { requestId: "integration-test" };

describe.skipIf(!connectionString)("PostgreSQL integration", () => {
    let pool: pg.Pool;
    let service: TaxLawService;

    beforeAll(async () => {
        pool = createPool({
            connectionString: connectionString!,
            statementTimeoutMs: 5000,
            connectionTimeoutMs: 5000,
            maxClients: 4
        });
        service = new TaxLawService(new PgTaxLawRepository(pool));

        const schema = readFileSync(new URL("../artifacts/db/schema.sql", import.meta.url), "utf8");
        const seed = readFileSync(new URL("../artifacts/db/seed.sql", import.meta.url), "utf8");

        await pool.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
        await pool.query(schema);
        await pool.query(seed);
    }, 60_000);

    afterAll(async () => {
        await pool?.end();
    });

    it("search returns approved provisions in force on asOf", async () => {
        const result = await service.searchTaxLaw({ q: "Thuế", asOf: "2026-01-01" }, ctx);

        expect(result.items.length).toBeGreaterThan(0);
        expect(result.items.every((item) => item.versionId === "-102")).toBe(true);
        expect(result.items.every((item) => item.sourceUrl.includes("/v2#"))).toBe(true);
    });

    it("search returns an empty page when nothing matches", async () => {
        const result = await service.searchTaxLaw({ q: "khongtontaitrongdulieu", asOf: "2026-01-01" }, ctx);
        expect(result.items).toEqual([]);
    });

    it("search hides draft and rejected versions", async () => {
        expect((await service.searchTaxLaw({ q: "draftonly", asOf: "2026-01-01" }, ctx)).items).toEqual([]);
        expect((await service.searchTaxLaw({ q: "rejectedonly", asOf: "2025-06-15" }, ctx)).items).toEqual([]);
    });

    it("search binds q so SQL markers stay literal search terms", async () => {
        const result = await service.searchTaxLaw({ q: "'; DROP TABLE provisions; --", asOf: "2026-01-01" }, ctx);
        expect(Array.isArray(result.items)).toBe(true);

        const stillThere = await pool.query("SELECT count(*)::int AS n FROM provisions");
        expect(stillThere.rows[0].n).toBeGreaterThan(0);
    });

    it("get provision returns the version whose interval contains asOf", async () => {
        const provision = await service.getTaxProvision(
            { documentNumber: "DEMO-TAX-001", articleKey: "1", asOf: "2026-01-01" },
            ctx
        );

        expect(provision.versionId).toBe("-102");
        expect(provision.effectiveFrom).toBe("2026-01-01");
        expect(provision.effectiveTo).toBeNull();
        expect(provision.sourceUrl).toBe("https://example.invalid/tax/001/v2#article-1");
    });

    it("treats effectiveTo as inclusive", async () => {
        const lastDay = await service.getTaxProvision(
            { documentNumber: "DEMO-TAX-001", articleKey: "1", asOf: "2025-12-31" },
            ctx
        );
        expect(lastDay.versionId).toBe("-101");
        expect(lastDay.effectiveTo).toBe("2025-12-31");

        const nextDay = await service.getTaxProvision(
            { documentNumber: "DEMO-TAX-001", articleKey: "1", asOf: "2026-01-01" },
            ctx
        );
        expect(nextDay.versionId).toBe("-102");
    });

    it("returns NOT_FOUND for an article missing from the version in force", async () => {
        const error = await service
            .getTaxProvision({ documentNumber: "DEMO-TAX-001", articleKey: "3", asOf: "2026-01-01" }, ctx)
            .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(DomainError);
        expect((error as DomainError).code).toBe("NOT_FOUND");
    });

    it("reads date columns as plain YYYY-MM-DD strings, without timezone shifting", async () => {
        const result = await pool.query("SELECT effective_from FROM document_versions WHERE id = -101");
        expect(result.rows[0].effective_from).toBe("2025-01-01");
    });
});
