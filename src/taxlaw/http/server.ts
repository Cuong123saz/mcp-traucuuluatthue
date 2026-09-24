/**
 * Composition root for the REST transport: build pool -> repository ->
 * service -> app, then listen. This is the only place the concrete PostgreSQL
 * repository is wired to the HTTP layer.
 */
import { createPool, readPoolConfigFromEnv } from "../db/pool.js";
import { PgTaxLawRepository } from "../repository/pg-tax-law-repository.js";
import { TaxLawService } from "../service/tax-law-service.js";
import { createStderrLogger } from "../logging.js";
import { buildApp } from "./app.js";

async function main(): Promise<void> {
    const pool = createPool(readPoolConfigFromEnv());
    const service = new TaxLawService(new PgTaxLawRepository(pool));
    const app = buildApp({ service, logger: createStderrLogger() });

    const port = Number(process.env.PORT ?? 3000);
    const host = process.env.HOST ?? "127.0.0.1";

    const shutdown = async () => {
        await app.close();
        await pool.end();
        process.exit(0);
    };
    process.on("SIGINT", () => void shutdown());
    process.on("SIGTERM", () => void shutdown());

    await app.listen({ port, host });
    process.stderr.write(`tax-law REST API listening on http://${host}:${port}\n`);
}

main().catch((error: unknown) => {
    // Startup failures are the operator's problem, not a response body, so the
    // real message is allowed here on stderr.
    process.stderr.write(`failed to start REST API: ${error instanceof Error ? error.message : "unknown"}\n`);
    process.exit(1);
});
