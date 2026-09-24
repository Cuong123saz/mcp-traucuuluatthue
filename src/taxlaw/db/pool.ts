import pg from "pg";

const { Pool, types } = pg;

/**
 * Read `date` (OID 1082) as the raw `YYYY-MM-DD` text instead of a JS Date.
 * node-postgres would otherwise build a Date in the process timezone, which
 * can shift effectiveFrom/effectiveTo by a day — exactly the UTC conversion
 * conflict-log A-08 forbids for business dates.
 */
const DATE_OID = 1082;
types.setTypeParser(DATE_OID, (value: string) => value);

export interface PoolConfig {
    connectionString: string;
    /** Server-side statement timeout, ms. service-contract.md suggests 5s. */
    statementTimeoutMs: number;
    connectionTimeoutMs: number;
    maxClients: number;
}

export function readPoolConfigFromEnv(env: NodeJS.ProcessEnv = process.env): PoolConfig {
    const connectionString = env.DATABASE_URL;
    if (!connectionString || connectionString.trim() === "") {
        throw new Error("DATABASE_URL is required to start the backend.");
    }
    return {
        connectionString,
        statementTimeoutMs: readPositiveInt(env.DB_STATEMENT_TIMEOUT_MS, 5000),
        connectionTimeoutMs: readPositiveInt(env.DB_CONNECTION_TIMEOUT_MS, 5000),
        maxClients: readPositiveInt(env.DB_POOL_MAX, 10)
    };
}

function readPositiveInt(raw: string | undefined, fallback: number): number {
    if (raw === undefined || raw.trim() === "") {
        return fallback;
    }
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error("Invalid numeric environment value.");
    }
    return parsed;
}

export function createPool(config: PoolConfig): pg.Pool {
    return new Pool({
        connectionString: config.connectionString,
        statement_timeout: config.statementTimeoutMs,
        query_timeout: config.statementTimeoutMs,
        connectionTimeoutMillis: config.connectionTimeoutMs,
        max: config.maxClients,
        application_name: "tra-cuu-luat-thue"
    });
}
