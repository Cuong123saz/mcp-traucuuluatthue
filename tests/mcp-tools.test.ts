import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { TaxLawService } from "../src/taxlaw/service/tax-law-service.js";
import { DomainError } from "../src/taxlaw/domain/errors.js";
import { buildApp } from "../src/taxlaw/http/app.js";
import { InMemoryTaxLawRepository, ThrowingTaxLawRepository } from "./support/in-memory-repository.js";
import type { TaxLawRepository } from "../src/taxlaw/repository/tax-law-repository.js";
import { connectTaxLawMcp, type TestMcpClient } from "./support/mcp-harness.js";

let client: TestMcpClient | undefined;

async function connect(repository: TaxLawRepository = new InMemoryTaxLawRepository()) {
    client = await connectTaxLawMcp(new TaxLawService(repository));
    return client;
}

function payloadOf(result: any) {
    return result.structuredContent;
}

afterEach(async () => {
    await client?.close();
    client = undefined;
});

describe("tool registration", () => {
    it("exposes exactly the two MVP tools plus get_document_relations", async () => {
        const { tools } = await (await connect()).request("tools/list");
        expect(tools.map((tool: any) => tool.name).sort()).toEqual([
            "get_document_relations",
            "get_tax_provision",
            "search_tax_law"
        ]);
    });

    it("declares required fields and additionalProperties: false", async () => {
        const { tools } = await (await connect()).request("tools/list");
        const byName = Object.fromEntries(tools.map((tool: any) => [tool.name, tool]));

        expect(byName.search_tax_law.inputSchema.required.sort()).toEqual(["asOf", "q"]);
        expect(byName.search_tax_law.inputSchema.additionalProperties).toBe(false);
        expect(byName.search_tax_law.inputSchema.properties.limit.type).toBe("integer");

        expect(byName.get_tax_provision.inputSchema.required.sort()).toEqual([
            "articleKey",
            "asOf",
            "documentNumber"
        ]);
        expect(byName.get_tax_provision.inputSchema.additionalProperties).toBe(false);
    });
});

describe("search_tax_law", () => {
    it("returns a success envelope whose text and structuredContent agree", async () => {
        const result = await (await connect()).request("tools/call", {
            name: "search_tax_law",
            arguments: { q: "Thuế", asOf: "2026-01-01" }
        });

        expect(result.isError).toBe(false);
        const structured = payloadOf(result);
        expect(structured.data.asOf).toBe("2026-01-01");
        expect(structured.data.items[0]).toMatchObject({
            documentNumber: "DEMO-TAX-001",
            versionId: "-102",
            sourceUrl: "https://example.invalid/tax/001/v2#article-1",
            effectiveFrom: "2026-01-01",
            effectiveTo: null
        });
        expect(structured.data.pagination).toEqual({ limit: 20, offset: 0, hasMore: false });
        expect(typeof structured.requestId).toBe("string");

        expect(JSON.parse(result.content[0].text)).toEqual(structured);
    });

    it("returns an empty item list rather than an error when nothing matches", async () => {
        const result = await (await connect()).request("tools/call", {
            name: "search_tax_law",
            arguments: { q: "khongtontai", asOf: "2026-01-01" }
        });

        expect(result.isError).toBe(false);
        expect(payloadOf(result).data.items).toEqual([]);
    });

    it("returns INVALID_ARGUMENT for a date that is not a real calendar day", async () => {
        const result = await (await connect()).request("tools/call", {
            name: "search_tax_law",
            arguments: { q: "Thuế", asOf: "2026-02-30" }
        });

        expect(result.isError).toBe(true);
        expect(payloadOf(result).error.code).toBe("INVALID_ARGUMENT");
        expect(payloadOf(result)).not.toHaveProperty("data");
    });

    it("rejects a missing asOf instead of defaulting to today", async () => {
        // asOf is required in the tool schema, so the SDK refuses the call
        // before the handler runs. That is a schema rejection, not a business
        // error dressed up as one — what matters is that nothing succeeds with
        // a server-chosen date.
        const connected = await connect();
        const result = await connected.request("tools/call", {
            name: "search_tax_law",
            arguments: { q: "Thuế" }
        });

        expect(result.isError).toBe(true);
        expect(result.structuredContent?.data).toBeUndefined();
        expect(JSON.stringify(result)).not.toContain("versionId");
    });

    it("rejects unknown arguments (additionalProperties: false)", async () => {
        const result = await (await connect()).request("tools/call", {
            name: "search_tax_law",
            arguments: { q: "Thuế", asOf: "2026-01-01", sort: "relevance" }
        });

        expect(result.isError).toBe(true);
        expect(result.structuredContent?.data).toBeUndefined();
    });

    it("rejects a non-integer limit", async () => {
        const result = await (await connect()).request("tools/call", {
            name: "search_tax_law",
            arguments: { q: "Thuế", asOf: "2026-01-01", limit: 1.5 }
        });

        expect(result.isError).toBe(true);
        expect(result.structuredContent?.data).toBeUndefined();
    });

    it("keeps hasMore null at limit=100", async () => {
        const result = await (await connect()).request("tools/call", {
            name: "search_tax_law",
            arguments: { q: "Thuế", asOf: "2026-01-01", limit: 100 }
        });

        expect(payloadOf(result).data.pagination.hasMore).toBeNull();
    });

    it("does not surface draft or rejected content", async () => {
        const result = await (await connect()).request("tools/call", {
            name: "search_tax_law",
            arguments: { q: "draftonly", asOf: "2026-01-01" }
        });

        expect(payloadOf(result).data.items).toEqual([]);
    });

    it("treats law text that looks like instructions as plain data", async () => {
        const result = await (await connect()).request("tools/call", {
            name: "search_tax_law",
            arguments: { q: "Thuế", asOf: "2026-01-01" }
        });

        // The tool never fetches sourceUrl and never calls another tool; the
        // body is echoed verbatim.
        expect(payloadOf(result).data.items[0].body).toBe("Thuế áp dụng theo nội dung mới. newonly");
    });
});

describe("get_tax_provision", () => {
    it("returns one ProvisionResult directly in data", async () => {
        const result = await (await connect()).request("tools/call", {
            name: "get_tax_provision",
            arguments: { documentNumber: "DEMO-TAX-001", articleKey: "1", asOf: "2026-01-01" }
        });

        expect(result.isError).toBe(false);
        expect(payloadOf(result).data).toEqual({
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

    it("returns NOT_FOUND with no partial data and no fallback version", async () => {
        const result = await (await connect()).request("tools/call", {
            name: "get_tax_provision",
            arguments: { documentNumber: "DEMO-TAX-001", articleKey: "3", asOf: "2026-01-01" }
        });

        expect(result.isError).toBe(true);
        expect(payloadOf(result).error.code).toBe("NOT_FOUND");
        expect(payloadOf(result)).not.toHaveProperty("data");
        expect(result.content[0].text).not.toContain("removedonly");
    });

    it("selects the version whose interval includes asOf, end date inclusive", async () => {
        const connected = await connect();

        const lastDay = await connected.request("tools/call", {
            name: "get_tax_provision",
            arguments: { documentNumber: "DEMO-TAX-001", articleKey: "1", asOf: "2025-12-31" }
        });
        expect(payloadOf(lastDay).data.versionId).toBe("-101");
        expect(payloadOf(lastDay).data.effectiveTo).toBe("2025-12-31");

        const nextDay = await connected.request("tools/call", {
            name: "get_tax_provision",
            arguments: { documentNumber: "DEMO-TAX-001", articleKey: "1", asOf: "2026-01-01" }
        });
        expect(payloadOf(nextDay).data.versionId).toBe("-102");
    });

    it("does not expose a rejected version", async () => {
        const result = await (await connect()).request("tools/call", {
            name: "get_tax_provision",
            arguments: { documentNumber: "DEMO-TAX-002", articleKey: "1", asOf: "2025-06-15" }
        });

        expect(payloadOf(result).error.code).toBe("NOT_FOUND");
        expect(result.content[0].text).not.toContain("rejectedonly");
    });
});

describe("MCP error envelope leaks nothing", () => {
    it("reduces a driver error carrying SQL and credentials to INTERNAL_ERROR", async () => {
        const leaky = Object.assign(new Error("SELECT body FROM provisions -- password=hunter2"), {
            stack: "at PgTaxLawRepository.query (/app/src/taxlaw/repository/pg-tax-law-repository.ts:42)"
        });

        const result = await (await connect(new ThrowingTaxLawRepository(leaky))).request("tools/call", {
            name: "search_tax_law",
            arguments: { q: "Thuế", asOf: "2026-01-01" }
        });

        expect(result.isError).toBe(true);
        expect(payloadOf(result).error.code).toBe("INTERNAL_ERROR");

        const serialized = JSON.stringify(result);
        for (const secret of ["SELECT", "password", "hunter2", "pg-tax-law-repository"]) {
            expect(serialized).not.toContain(secret);
        }
    });

    it("keeps the shared domain code for a dependency failure", async () => {
        const result = await (
            await connect(new ThrowingTaxLawRepository(new DomainError("DEPENDENCY_UNAVAILABLE", "DB down")))
        ).request("tools/call", { name: "search_tax_law", arguments: { q: "Thuế", asOf: "2026-01-01" } });

        expect(payloadOf(result).error.code).toBe("DEPENDENCY_UNAVAILABLE");
    });
});

describe("REST and MCP share one Service", () => {
    it("produces the same business payload for the same search input", async () => {
        const app = buildApp({ service: new TaxLawService(new InMemoryTaxLawRepository()) });
        try {
            const rest = (await app.inject({ method: "GET", url: "/search?q=Thuế&asOf=2026-01-01" })).json();
            const mcp = payloadOf(
                await (await connect()).request("tools/call", {
                    name: "search_tax_law",
                    arguments: { q: "Thuế", asOf: "2026-01-01" }
                })
            );

            expect(mcp.data.items).toEqual(rest.data.items);
            expect(mcp.data.asOf).toEqual(rest.data.asOf);
            expect(mcp.data.pagination).toEqual(rest.pagination);
        } finally {
            await app.close();
        }
    });
});

describe("MCP handler architecture", () => {
    it("contains no SQL and imports no database client or repository implementation", () => {
        const source = readFileSync(new URL("../src/taxlaw/mcp/tools.ts", import.meta.url), "utf8");
        const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]!);

        expect(imports).not.toContain("pg");
        expect(imports.some((specifier) => specifier.includes("repository/"))).toBe(false);
        expect(imports.some((specifier) => specifier.includes("db/pool"))).toBe(false);

        const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
        for (const sqlToken of ["SELECT ", "INSERT ", "UPDATE ", "DELETE ", " FROM ", " JOIN "]) {
            expect(code).not.toContain(sqlToken);
        }
    });
});
