import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import { registerTaxLawTools } from "../../src/taxlaw/mcp/tools.js";
import type { TaxLawService } from "../../src/taxlaw/service/tax-law-service.js";

/**
 * Minimal JSON-RPC peer over a linked in-memory transport. It speaks the wire
 * protocol rather than calling handlers directly, so the registered input
 * schemas are actually enforced in tests.
 */
export interface TestMcpClient {
    request(method: string, params?: unknown): Promise<any>;
    close(): Promise<void>;
}

export async function connectTaxLawMcp(service: TaxLawService): Promise<TestMcpClient> {
    const server = new McpServer({ name: "tra-cuu-luat-thue-test", version: "0.0.0" });
    registerTaxLawTools(server, { service });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const pending = new Map<number, { resolve: (v: any) => void; reject: (e: unknown) => void }>();
    let nextId = 1;

    clientTransport.onmessage = (message: any) => {
        if (typeof message?.id !== "number") {
            return;
        }
        const waiter = pending.get(message.id);
        if (!waiter) {
            return;
        }
        pending.delete(message.id);
        if (message.error) {
            waiter.reject(new JsonRpcError(message.error.code, message.error.message));
        } else {
            waiter.resolve(message.result);
        }
    };
    await clientTransport.start();

    const request = (method: string, params?: unknown) =>
        new Promise<any>((resolve, reject) => {
            const id = nextId++;
            pending.set(id, { resolve, reject });
            void clientTransport.send({ jsonrpc: "2.0", id, method, params: params ?? {} } as any).catch(reject);
        });

    await request("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "vitest", version: "0.0.0" }
    });
    await clientTransport.send({ jsonrpc: "2.0", method: "notifications/initialized" } as any);

    return {
        request,
        async close() {
            await clientTransport.close();
            await server.close();
        }
    };
}

export class JsonRpcError extends Error {
    constructor(
        readonly code: number,
        message: string
    ) {
        super(message);
        this.name = "JsonRpcError";
    }
}
