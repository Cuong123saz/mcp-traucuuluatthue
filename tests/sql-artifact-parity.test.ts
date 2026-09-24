import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GET_TAX_PROVISION_SQL, SEARCH_TAX_LAW_SQL } from "../src/taxlaw/repository/sql.js";

/**
 * The Repository must run the DB team's queries, not a private variant of
 * them. These tests fail as soon as the inlined copy drifts from the artifact,
 * and also guard the layering rule that SQL lives only in the repository.
 */

function readArtifact(name: string): string {
    return readFileSync(new URL(`../artifacts/db/${name}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

describe("SQL matches the DB artifacts", () => {
    it("search SQL is copied verbatim from query-search-tax-law.sql", () => {
        expect(SEARCH_TAX_LAW_SQL.replace(/\r\n/g, "\n")).toBe(readArtifact("query-search-tax-law.sql"));
    });

    it("get-provision SQL is copied verbatim from query-get-tax-provision.sql", () => {
        expect(GET_TAX_PROVISION_SQL.replace(/\r\n/g, "\n")).toBe(readArtifact("query-get-tax-provision.sql"));
    });

    it("binds every value as a parameter", () => {
        expect(SEARCH_TAX_LAW_SQL).toContain("$1::text");
        expect(SEARCH_TAX_LAW_SQL).toContain("LIMIT $3::integer OFFSET $4::integer");
        expect(GET_TAX_PROVISION_SQL).toContain("$1::text");
        expect(GET_TAX_PROVISION_SQL).toContain("$3::date");
    });
});

describe("SQL stays inside the repository layer", () => {
    const layerFiles = [
        "../src/taxlaw/service/tax-law-service.ts",
        "../src/taxlaw/service/validation.ts",
        "../src/taxlaw/http/app.ts",
        "../src/taxlaw/mcp/tools.ts"
    ];

    it.each(layerFiles)("%s contains no SQL", (relative) => {
        const source = readFileSync(new URL(relative, import.meta.url), "utf8").replace(
            /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
            ""
        );

        for (const token of ["SELECT ", "INSERT ", "UPDATE ", "DELETE ", " FROM ", " JOIN ", "plainto_tsquery"]) {
            expect(source).not.toContain(token);
        }
    });

    it("neither the service nor a transport imports the database client", () => {
        for (const relative of layerFiles) {
            const source = readFileSync(new URL(relative, import.meta.url), "utf8");
            const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]!);
            expect(imports).not.toContain("pg");
            expect(imports.some((specifier) => specifier.includes("db/pool"))).toBe(false);
        }
    });
});
