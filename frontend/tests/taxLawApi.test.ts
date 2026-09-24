import { describe, expect, it, vi } from "vitest";
import { buildSearchUrl, createTaxLawApi, parseSearchSuccess } from "../src/lib/taxLawApi";
import { provision } from "./support";

const input = { q: "thuế  minh họa", asOf: "2026-09-24", limit: 20, offset: 0 };

function envelope(overrides: Record<string, unknown> = {}) {
    return {
        data: { asOf: "2026-09-24", items: [provision()] },
        pagination: { limit: 20, offset: 0, hasMore: false },
        requestId: "req-1",
        ...overrides
    };
}

function jsonResponse(status: number, body: unknown) {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("buildSearchUrl", () => {
    it("sends exactly q, asOf, limit, offset without altering q", () => {
        const url = buildSearchUrl("/api/", input);
        expect(url.startsWith("/api/search?")).toBe(true);
        const params = new URLSearchParams(url.split("?")[1]);
        expect([...params.keys()]).toEqual(["q", "asOf", "limit", "offset"]);
        expect(params.get("q")).toBe("thuế  minh họa");
        expect(params.get("asOf")).toBe("2026-09-24");
        expect(params.get("limit")).toBe("20");
        expect(params.get("offset")).toBe("0");
    });
});

describe("parseSearchSuccess", () => {
    it("accepts a contract envelope and keeps versionId as a string", () => {
        const out = parseSearchSuccess(envelope(), input);
        expect(out.ok).toBe(true);
        if (out.ok) {
            expect(out.value.items[0]?.versionId).toBe("9007199254740993");
            expect(out.value.pagination.hasMore).toBe(false);
            expect(out.value.requestId).toBe("req-1");
        }
    });

    it("rejects a response for a different asOf", () => {
        const out = parseSearchSuccess(envelope({ data: { asOf: "2026-09-23", items: [] } }), input);
        expect(out).toEqual({ ok: false, error: { kind: "protocol", requestId: "req-1" } });
    });

    it("rejects pagination that does not match the request", () => {
        const out = parseSearchSuccess(envelope({ pagination: { limit: 20, offset: 20, hasMore: false } }), input);
        expect(out.ok).toBe(false);
    });

    it("accepts hasMore null only at limit=100", () => {
        const nullAt20 = envelope({ pagination: { limit: 20, offset: 0, hasMore: null } });
        expect(parseSearchSuccess(nullAt20, input).ok).toBe(false);

        const at100 = { ...input, limit: 100 };
        const nullAt100 = envelope({ pagination: { limit: 100, offset: 0, hasMore: null } });
        const out = parseSearchSuccess(nullAt100, at100);
        expect(out.ok && out.value.pagination.hasMore).toBe(null);
    });

    it("rejects a missing hasMore instead of guessing it", () => {
        const out = parseSearchSuccess(envelope({ pagination: { limit: 20, offset: 0 } }), input);
        expect(out.ok).toBe(false);
    });

    it.each([
        ["sourceUrl", { sourceUrl: undefined }],
        ["effectiveFrom", { effectiveFrom: undefined }],
        ["effectiveTo", { effectiveTo: undefined }],
        ["versionId", { versionId: undefined }]
    ])("rejects a provision missing %s as a data error", (_field, missing) => {
        const out = parseSearchSuccess(
            envelope({ data: { asOf: "2026-09-24", items: [provision(missing)] } }),
            input
        );
        expect(out).toEqual({ ok: false, error: { kind: "data", requestId: "req-1" } });
    });

    it("rejects items without identity fields or with duplicate keys", () => {
        const noKey = envelope({ data: { asOf: "2026-09-24", items: [provision({ articleKey: "" })] } });
        expect(parseSearchSuccess(noKey, input).ok).toBe(false);
        const dup = envelope({ data: { asOf: "2026-09-24", items: [provision(), provision()] } });
        expect(parseSearchSuccess(dup, input).ok).toBe(false);
    });
});

describe("createTaxLawApi", () => {
    it("maps contract error envelopes to domain errors with requestId", async () => {
        const fetch = vi.fn(async () =>
            jsonResponse(503, { error: { code: "DEPENDENCY_UNAVAILABLE", message: "x" }, requestId: "r-503" })
        );
        const api = createTaxLawApi({ baseUrl: "/api", fetch });
        expect(await api.search(input)).toEqual({
            ok: false,
            error: { kind: "domain", code: "DEPENDENCY_UNAVAILABLE", requestId: "r-503" }
        });
        expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/search\?/), expect.anything());
    });

    it("maps a rejected fetch to a network error", async () => {
        const api = createTaxLawApi({ baseUrl: "/api", fetch: async () => { throw new TypeError("offline"); } });
        expect(await api.search(input)).toEqual({ ok: false, error: { kind: "network" } });
    });

    it("maps a non-JSON body to a network error", async () => {
        const api = createTaxLawApi({ baseUrl: "/api", fetch: async () => new Response("<html>", { status: 502 }) });
        expect(await api.search(input)).toEqual({ ok: false, error: { kind: "network" } });
    });

    it("maps an unknown error code to a protocol error", async () => {
        const api = createTaxLawApi({
            baseUrl: "/api",
            fetch: async () => jsonResponse(500, { error: { code: "BOOM" }, requestId: "r" })
        });
        expect(await api.search(input)).toEqual({ ok: false, error: { kind: "protocol", requestId: "r" } });
    });

    it("reports a caller abort as aborted and a timeout as network", async () => {
        const hang: typeof fetch = (_url, init) =>
            new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("abort"))));

        const controller = new AbortController();
        const pending = createTaxLawApi({ baseUrl: "/api", fetch: hang }).search(input, controller.signal);
        controller.abort();
        expect(await pending).toEqual({ ok: false, error: { kind: "aborted" } });

        const timed = await createTaxLawApi({ baseUrl: "/api", fetch: hang, timeoutMs: 5 }).search(input);
        expect(timed).toEqual({ ok: false, error: { kind: "network" } });
    });
});
