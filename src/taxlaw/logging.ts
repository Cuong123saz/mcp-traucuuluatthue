/**
 * Allowlist logger. service-contract.md forbids logging query strings, law
 * text, raw MCP arguments, SQL/bindings and credentials — so this module
 * accepts only the fields below and there is no escape hatch for arbitrary
 * payloads. Output goes to stderr, keeping stdout free for MCP stdio framing.
 */
export interface LogEntry {
    requestId: string;
    /** Route path or MCP tool name — never the caller's argument values. */
    operation: string;
    durationMs: number;
    outcome: "ok" | "error";
    errorCode?: string;
    resultCount?: number;
}

export interface Logger {
    log(entry: LogEntry): void;
}

export function createStderrLogger(): Logger {
    return {
        log(entry) {
            const safe: LogEntry = {
                requestId: entry.requestId,
                operation: entry.operation,
                durationMs: entry.durationMs,
                outcome: entry.outcome
            };
            if (entry.errorCode !== undefined) {
                safe.errorCode = entry.errorCode;
            }
            if (entry.resultCount !== undefined) {
                safe.resultCount = entry.resultCount;
            }
            process.stderr.write(`${JSON.stringify(safe)}\n`);
        }
    };
}

export function createSilentLogger(): Logger {
    return { log() {} };
}
