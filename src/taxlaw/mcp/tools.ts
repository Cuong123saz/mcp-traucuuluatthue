import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { randomUUID } from "node:crypto";
import { toDomainError } from "../domain/errors.js";
import type { RequestContext } from "../domain/dto.js";
import type { TaxLawService } from "../service/tax-law-service.js";
import { createSilentLogger, type Logger } from "../logging.js";

/**
 * MCP adapter: validate -> TaxLawService -> serialize. This module must not
 * import a database client, the repository, or any SQL, and must not restate
 * date/approval/version/pagination rules — it shares the exact Service the
 * Fastify routes use (mcp-tools.md).
 *
 * Registered: the two MVP tools plus get_document_relations.
 * get_document_timeline and list_tax_documents are out of MVP scope
 * (conflict-log A-11) and are not declared, not even behind a flag.
 */

/**
 * Shape validation only. Whether `2026-02-30` is a real day, and every other
 * domain rule, is decided by the Service so the caller gets a business
 * INVALID_ARGUMENT envelope rather than a protocol-level schema failure.
 */
const dateSchema = z
    .string()
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/, "Ngày phải có dạng YYYY-MM-DD");

const searchInputSchema = z.strictObject({
    q: z.string().min(1).max(300),
    asOf: dateSchema,
    // Optional here on purpose: the Service applies limit=20 / offset=0 so the
    // defaults cannot differ between transports or depend on the SDK filling
    // them in.
    limit: z.int().min(1).max(100).optional(),
    offset: z.int().min(0).optional()
});

const relationsInputSchema = z.strictObject({
    documentNumber: z.string().min(1).max(100),
    asOf: dateSchema
});

const provisionInputSchema = z.strictObject({
    documentNumber: z.string().min(1).max(100),
    articleKey: z.string().min(1).max(100),
    asOf: dateSchema
});

export interface RegisterOptions {
    service: TaxLawService;
    logger?: Logger;
}

export function registerTaxLawTools(server: McpServer, options: RegisterOptions): McpServer {
    const logger = options.logger ?? createSilentLogger();

    server.registerTool(
        "search_tax_law",
        {
            title: "Search tax law",
            description:
                "Full-text search over approved tax-law provisions in force on a given date. " +
                "asOf is required and is never defaulted to today.",
            inputSchema: searchInputSchema,
            annotations: { readOnlyHint: true, openWorldHint: false }
        },
        async (input) =>
            run(logger, "search_tax_law", async (ctx) => {
                const result = await options.service.searchTaxLaw(input, ctx);
                return {
                    payload: { asOf: result.asOf, items: result.items, pagination: result.pagination },
                    resultCount: result.items.length
                };
            })
    );

    server.registerTool(
        "get_tax_provision",
        {
            title: "Get tax provision",
            description:
                "Fetch exactly one provision by documentNumber + articleKey from the approved version " +
                "in force on asOf. No fallback to another version or another date.",
            inputSchema: provisionInputSchema,
            annotations: { readOnlyHint: true, openWorldHint: false }
        },
        async (input) =>
            run(logger, "get_tax_provision", async (ctx) => {
                const result = await options.service.getTaxProvision(input, ctx);
                return { payload: result, resultCount: 1 };
            })
    );

    server.registerTool(
        "get_document_relations",
        {
            title: "Get document relations",
            description:
                "List how a tax document relates to other documents on asOf: which documents it amends, " +
                "repeals/replaces, guides or consolidates (outgoing), and which documents amend, repeal/replace, " +
                "guide or consolidate it (incoming). Use it to check whether a document has been replaced or " +
                "amended before relying on it. Only relations in force on asOf are returned.",
            inputSchema: relationsInputSchema,
            annotations: { readOnlyHint: true, openWorldHint: false }
        },
        async (input) =>
            run(logger, "get_document_relations", async (ctx) => {
                const result = await options.service.getDocumentRelations(input, ctx);
                return { payload: result, resultCount: result.outgoing.length + result.incoming.length };
            })
    );

    return server;
}

interface ToolOutcome {
    payload: unknown;
    resultCount: number;
}

/**
 * Shared envelope builder. Success carries structuredContent and the identical
 * JSON as text; failure carries isError with the shared domain code and no
 * partial data (mcp-tools.md "Envelope").
 */
async function run(logger: Logger, tool: string, work: (ctx: RequestContext) => Promise<ToolOutcome>) {
    const requestId = randomUUID();
    const ctx: RequestContext = { requestId };
    const startedAt = Date.now();

    try {
        const { payload, resultCount } = await work(ctx);
        logger.log({
            requestId,
            operation: tool,
            durationMs: Date.now() - startedAt,
            outcome: "ok",
            resultCount
        });
        const structuredContent = { data: payload, requestId };
        return {
            isError: false,
            structuredContent,
            content: [{ type: "text" as const, text: JSON.stringify(structuredContent) }]
        };
    } catch (raw) {
        const error = toDomainError(raw);
        logger.log({
            requestId,
            operation: tool,
            durationMs: Date.now() - startedAt,
            outcome: "error",
            errorCode: error.code
        });
        const structuredContent = {
            error: {
                code: error.code,
                message: error.message,
                ...(error.details ? { details: error.details } : {})
            },
            requestId
        };
        return {
            isError: true,
            structuredContent,
            content: [{ type: "text" as const, text: JSON.stringify(structuredContent) }]
        };
    }
}
