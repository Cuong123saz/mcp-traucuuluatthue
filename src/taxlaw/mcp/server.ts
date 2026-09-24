/**
 * Composition root for the MCP stdio transport. Mirrors http/server.ts: the
 * same Service is built on the same repository, so both transports answer with
 * the same business payload.
 */
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createPool, readPoolConfigFromEnv } from "../db/pool.js";
import { PgTaxLawRepository } from "../repository/pg-tax-law-repository.js";
import { TaxLawService } from "../service/tax-law-service.js";
import { createStderrLogger } from "../logging.js";
import { registerTaxLawTools } from "./tools.js";

function buildService(): TaxLawService {
    try {
        return new TaxLawService(new PgTaxLawRepository(createPool(readPoolConfigFromEnv())));
    } catch (error) {
        // Misconfiguration is an operator problem: report it plainly instead of
        // dumping a stack into the client's stdio session.
        process.stderr.write(
            `tax-law MCP server cannot start: ${error instanceof Error ? error.message : "unknown error"}\n`
        );
        process.exit(1);
    }
}

const service = buildService();
const logger = createStderrLogger();

function createServer(): McpServer {
    const server = new McpServer({ name: "tra-cuu-luat-thue", version: "0.1.0" });
    return registerTaxLawTools(server, { service, logger });
}

void serveStdio(createServer);

// stdout belongs to the MCP framing; diagnostics go to stderr.
process.stderr.write("tax-law MCP server running on stdio\n");
