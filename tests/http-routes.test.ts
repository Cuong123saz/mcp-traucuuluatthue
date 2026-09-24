import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/taxlaw/http/app.js";
import { TaxLawService } from "../src/taxlaw/service/tax-law-service.js";
import { InMemoryTaxLawRepository, ThrowingTaxLawRepository } from "./support/in-memory-repository.js";
import type { TaxLawRepository } from "../src/taxlaw/repository/tax-law-repository.js";

let app: FastifyInstance | undefined;

function makeApp(repository: TaxLawRepository = new InMemoryTaxLawRepository()) {
    app = buildApp({ service: new TaxLawService(repository) });
    return app;
}

afterEach(async () => {
    await app?.close();
    app = undefined;
});

describe("GET /health", () => {
    it("answers without touching the database", async () => {
        // The repository throws on every call, so a 200 proves nothing here
        // reached it.
        const response = await makeApp(new ThrowingTaxLawRepository(new Error("db must not be used"))).inject({
            method: "GET",
            url: "/health"
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.data).toEqual({ status: "ok" });
        expect(typeof body.requestId).toBe("string");
    });
});

describe("GET /search — success", () => {
    it("returns items, pagination and requestId in the contract envelope", async () => {
        const response = await makeApp().inject({ method: "GET", url: "/search?q=Thuế&asOf=2026-01-01" });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.data.asOf).toBe("2026-01-01");
        expect(body.pagination).toEqual({ limit: 20, offset: 0, hasMore: false });
        expect(typeof body.requestId).toBe("string");
        expect(body.data.items[0]).toMatchObject({
            documentNumber: "DEMO-TAX-001",
            versionId: "-102",
            sourceUrl: "https://example.invalid/tax/001/v2#article-1",
            effectiveFrom: "2026-01-01",
            effectiveTo: null
        });
    });

    it("keeps effectiveTo: null in the serialized JSON instead of dropping the key", async () => {
        const response = await makeApp().inject({ method: "GET", url: "/search?q=newonly&asOf=2026-01-01" });
        expect(response.body).toContain('"effectiveTo":null');
    });

    it("includes the last effective day of a bounded version", async () => {
        const response = await makeApp().inject({ method: "GET", url: "/search?q=oldonly&asOf=2025-12-31" });

        expect(response.statusCode).toBe(200);
        expect(response.json().data.items).toHaveLength(1);
        expect(response.json().data.items[0].effectiveTo).toBe("2025-12-31");
    });

    it("does not return draft or rejected content", async () => {
        const draft = await makeApp().inject({ method: "GET", url: "/search?q=draftonly&asOf=2026-01-01" });
        expect(draft.json().data.items).toEqual([]);
    });
});

describe("GET /search — empty", () => {
    it("answers 200 with an empty item list", async () => {
        const response = await makeApp().inject({ method: "GET", url: "/search?q=khongtontai&asOf=2026-01-01" });

        expect(response.statusCode).toBe(200);
        expect(response.json().data.items).toEqual([]);
        expect(response.json().pagination.hasMore).toBe(false);
    });
});

describe("GET /search — validation", () => {
    const badRequests = [
        ["missing q", "/search?asOf=2026-01-01"],
        ["blank q", "/search?q=%20%20&asOf=2026-01-01"],
        ["missing asOf", "/search?q=Thuế"],
        ["invalid calendar date", "/search?q=Thuế&asOf=2026-02-30"],
        ["timestamp instead of date", "/search?q=Thuế&asOf=2026-01-01T00:00:00Z"],
        ["limit out of range", "/search?q=Thuế&asOf=2026-01-01&limit=101"],
        ["decimal limit", "/search?q=Thuế&asOf=2026-01-01&limit=1.5"],
        ["negative offset", "/search?q=Thuế&asOf=2026-01-01&offset=-1"],
        ["unknown parameter", "/search?q=Thuế&asOf=2026-01-01&sort=relevance"],
        ["repeated parameter", "/search?q=Thuế&q=VAT&asOf=2026-01-01"]
    ] as const;

    it.each(badRequests)("rejects %s with 400 INVALID_ARGUMENT", async (_name, url) => {
        const response = await makeApp().inject({ method: "GET", url });

        expect(response.statusCode).toBe(400);
        expect(response.json().error.code).toBe("INVALID_ARGUMENT");
        expect(response.json()).not.toHaveProperty("data");
    });

    it("answers 404 in the error envelope for an unknown route", async () => {
        const response = await makeApp().inject({ method: "GET", url: "/nope" });

        expect(response.statusCode).toBe(404);
        expect(response.json().error.code).toBe("NOT_FOUND");
    });
});

describe("GET /search — error responses leak nothing", () => {
    it("hides SQL, bindings, stacks and credentials behind INTERNAL_ERROR", async () => {
        const leaky = Object.assign(
            new Error(
                "SELECT * FROM provisions WHERE source_url = 'https://secret.invalid' -- password=hunter2"
            ),
            { stack: "at PgTaxLawRepository.query (/app/src/taxlaw/repository/pg-tax-law-repository.ts:42)" }
        );

        const response = await makeApp(new ThrowingTaxLawRepository(leaky)).inject({
            method: "GET",
            url: "/search?q=Thuế&asOf=2026-01-01"
        });

        expect(response.statusCode).toBe(500);
        expect(response.json().error.code).toBe("INTERNAL_ERROR");

        const body = response.body;
        for (const secret of ["SELECT", "provisions", "password", "hunter2", "pg-tax-law-repository", "stack"]) {
            expect(body).not.toContain(secret);
        }
        expect(response.json().error).not.toHaveProperty("stack");
    });

    it("maps a DB connection failure to 503 DEPENDENCY_UNAVAILABLE", async () => {
        const { DomainError } = await import("../src/taxlaw/domain/errors.js");
        const response = await makeApp(
            new ThrowingTaxLawRepository(new DomainError("DEPENDENCY_UNAVAILABLE", "Không kết nối được nguồn dữ liệu."))
        ).inject({ method: "GET", url: "/search?q=Thuế&asOf=2026-01-01" });

        expect(response.statusCode).toBe(503);
        expect(response.json().error.code).toBe("DEPENDENCY_UNAVAILABLE");
    });

    it("maps a data integrity failure to 409", async () => {
        const { DomainError } = await import("../src/taxlaw/domain/errors.js");
        const response = await makeApp(
            new ThrowingTaxLawRepository(new DomainError("DATA_INTEGRITY_ERROR", "Dữ liệu không nhất quán."))
        ).inject({ method: "GET", url: "/search?q=Thuế&asOf=2026-01-01" });

        expect(response.statusCode).toBe(409);
        expect(response.json().error.code).toBe("DATA_INTEGRITY_ERROR");
    });
});

describe("routes outside the MVP", () => {
    it.each([
        "/documents/DEMO-TAX-001?asOf=2026-01-01",
        "/documents/DEMO-TAX-001/timeline",
        "/documents"
    ])("does not expose %s", async (url) => {
        const response = await makeApp().inject({ method: "GET", url });
        expect(response.statusCode).toBe(404);
    });
});
