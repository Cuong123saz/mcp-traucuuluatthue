import { describe, expect, it } from "vitest";
import { createTaxLawApi } from "../src/lib/taxLawApi";
import { createSearchStore } from "../src/stores/searchStore";
import { flush, manualApi, page, provision } from "./support";

const A = "2026-09-24";
const B = "2025-06-01";

function setup() {
    const m = manualApi();
    const store = createSearchStore(m.api, { today: () => A });
    return { ...m, store };
}

function responseEnvelope(item: unknown, requestId: string) {
    return {
        data: { asOf: A, items: [item] },
        pagination: { limit: 20, offset: 0, hasMore: false },
        requestId
    };
}

function setupRestResponses(...bodies: unknown[]) {
    let index = 0;
    const fetch: typeof globalThis.fetch = async () => {
        const body = bodies[index++];
        if (body === undefined) throw new Error("missing scripted response");
        return new Response(JSON.stringify(body), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    };
    const api = createTaxLawApi({ baseUrl: "/api", fetch });
    return createSearchStore(api, { today: () => A });
}

async function searchOk(s: ReturnType<typeof setup>, items = [provision()], hasMore: boolean | null = false) {
    s.store.form.q = "thuế";
    const run = s.store.submit();
    s.last().resolve(page(s.last().input, items, hasMore));
    await run;
}

describe("search store", () => {
    it("prefills asOf with local today and makes no request on load", () => {
        const s = setup();
        expect(s.store.form.asOf).toBe(A);
        expect(s.store.status.value).toBe("idle");
        expect(s.calls).toHaveLength(0);
    });

    it("blocks invalid q and asOf without calling the API", () => {
        const s = setup();
        s.store.form.q = "   ";
        s.store.submit();
        expect(s.store.fieldErrors.value.q).toBe("validation.q.required");

        s.store.form.q = "x".repeat(301);
        s.store.submit();
        expect(s.store.fieldErrors.value.q).toBe("validation.q.tooLong");

        s.store.form.q = "thuế";
        s.store.form.asOf = "";
        s.store.submit();
        expect(s.store.fieldErrors.value.asOf).toBe("validation.asOf.required");

        s.store.form.asOf = "2026-02-31";
        s.store.submit();
        expect(s.store.fieldErrors.value.asOf).toBe("validation.asOf.invalid");
        expect(s.calls).toHaveLength(0);
    });

    it("sends trimmed q, explicit asOf/limit and offset 0", async () => {
        const s = setup();
        s.store.form.q = "  thuế  minh họa ";
        s.store.submit();
        expect(s.last().input).toEqual({ q: "thuế  minh họa", asOf: A, limit: 20, offset: 0 });
    });

    it("goes loading -> success and commits the snapshot with the response", async () => {
        const s = setup();
        s.store.form.q = "thuế";
        const run = s.store.submit();
        expect(s.store.status.value).toBe("loading");
        expect(s.store.snapshot.value).toBeNull();
        s.last().resolve(page(s.last().input, [provision()], false));
        await run;
        expect(s.store.status.value).toBe("success");
        expect(s.store.snapshot.value?.input.asOf).toBe(A);
    });

    describe("REST response contract", () => {
        it("keeps the valid snapshot when the next response is missing sourceUrl", async () => {
            const store = setupRestResponses(
                responseEnvelope(provision({ articleKey: "valid" }), "valid-response"),
                responseEnvelope(provision({ articleKey: "broken", sourceUrl: undefined }), "bad-source")
            );
            store.form.q = "thuế";
            await store.submit();
            const validSnapshot = store.snapshot.value;

            await store.submit();

            expect(store.status.value).toBe("error");
            expect(store.failure.value?.error).toEqual({ kind: "data", requestId: "bad-source" });
            expect(store.snapshot.value).toBe(validSnapshot);
            expect(store.snapshot.value?.items[0]?.articleKey).toBe("valid");
        });

        it.each([
            ["effectiveFrom", { effectiveFrom: undefined }],
            ["effectiveTo", { effectiveTo: undefined }]
        ])("keeps the valid snapshot when the next response is missing %s", async (_field, missing) => {
            const store = setupRestResponses(
                responseEnvelope(provision({ articleKey: "valid" }), "valid-response"),
                responseEnvelope(provision({ articleKey: "broken", ...missing }), "bad-interval")
            );
            store.form.q = "thuế";
            await store.submit();
            const validSnapshot = store.snapshot.value;

            await store.submit();

            expect(store.status.value).toBe("error");
            expect(store.failure.value?.error).toEqual({ kind: "data", requestId: "bad-interval" });
            expect(store.snapshot.value).toBe(validSnapshot);
            expect(store.snapshot.value?.items[0]?.articleKey).toBe("valid");
        });

        it("commits a valid response as success", async () => {
            const store = setupRestResponses(responseEnvelope(provision(), "valid-response"));
            store.form.q = "thuế";

            await store.submit();

            expect(store.status.value).toBe("success");
            expect(store.failure.value).toBeNull();
            expect(store.snapshot.value?.requestId).toBe("valid-response");
        });
    });

    it("empty result at offset 0 is no-results", async () => {
        const s = setup();
        await searchOk(s, []);
        expect(s.store.status.value).toBe("empty");
        expect(s.store.emptyPage.value).toBeNull();
    });

    it("error keeps the previous snapshot and retries the failed input, not the form", async () => {
        const s = setup();
        await searchOk(s);
        s.store.form.asOf = B;
        const run = s.store.submit();
        s.last().resolve({ ok: false, error: { kind: "domain", code: "INTERNAL_ERROR", requestId: "r-500" } });
        await run;
        expect(s.store.status.value).toBe("error");
        expect(s.store.snapshot.value?.input.asOf).toBe(A);
        expect(s.store.failure.value?.presentation.requestId).toBe("r-500");

        s.store.form.asOf = "2020-01-01";
        s.store.retry();
        expect(s.last().input.asOf).toBe(B);
    });

    it("INVALID_ARGUMENT is not retryable", async () => {
        const s = setup();
        s.store.form.q = "thuế";
        const run = s.store.submit();
        s.last().resolve({ ok: false, error: { kind: "domain", code: "INVALID_ARGUMENT", requestId: "r" } });
        await run;
        expect(s.store.failure.value?.presentation.retryable).toBe(false);
        expect(s.store.retry()).toBeUndefined();
    });

    it("marks stale when q/asOf/limit differ from the snapshot, and clears when restored", async () => {
        const s = setup();
        await searchOk(s);
        expect(s.store.isStale.value).toBe(false);
        s.store.form.asOf = B;
        expect(s.store.isStale.value).toBe(true);
        s.store.form.asOf = A;
        s.store.form.q = " thuế ";
        expect(s.store.isStale.value).toBe(false);
        s.store.form.q = "khác";
        expect(s.store.isStale.value).toBe(true);
    });

    it("drops a late response from a superseded request", async () => {
        const s = setup();
        s.store.form.q = "thuế";
        s.store.submit();
        const first = s.last();
        s.store.changeLimit(50); // hasSubmitted -> replaces the in-flight request
        const second = s.last();
        expect(first.signal?.aborted).toBe(true);
        second.resolve(page(second.input, [provision({ articleKey: "2" })], false));
        first.resolve(page(first.input, [provision({ articleKey: "1" })], false));
        await flush();
        expect(s.store.snapshot.value?.input.limit).toBe(50);
        expect(s.store.snapshot.value?.items[0]?.articleKey).toBe("2");
    });

    it("changing limit before the first search only changes the form", () => {
        const s = setup();
        s.store.changeLimit(100);
        expect(s.store.form.limit).toBe(100);
        expect(s.calls).toHaveLength(0);
    });

    describe("pagination", () => {
        it("hasMore true: next uses the snapshot query even when the form changed", async () => {
            const s = setup();
            await searchOk(s, [provision()], true);
            s.store.form.q = "bản nháp";
            s.store.form.asOf = B;
            s.store.nextPage();
            expect(s.last().input).toEqual({ q: "thuế", asOf: A, limit: 20, offset: 20 });
        });

        it("hasMore false: next does nothing", async () => {
            const s = setup();
            await searchOk(s, [provision()], false);
            expect(s.store.nextPage()).toBeUndefined();
            expect(s.calls).toHaveLength(1);
        });

        it("hasMore null: next probes; an empty page shows end-of-results and Back restores", async () => {
            const s = setup();
            s.store.changeLimit(100);
            await searchOk(s, [provision()], null);
            expect(s.store.snapshot.value?.pagination.hasMore).toBeNull();

            const run = s.store.nextPage();
            expect(s.last().input.offset).toBe(100);
            s.last().resolve(page(s.last().input, [], false));
            await run;
            expect(s.store.status.value).toBe("empty");
            expect(s.store.emptyPage.value?.input.offset).toBe(100);
            // The previous snapshot is untouched, not rewritten with offset 100.
            expect(s.store.snapshot.value?.input.offset).toBe(0);

            s.store.backFromEmptyPage();
            expect(s.store.status.value).toBe("success");
            expect(s.store.emptyPage.value).toBeNull();
            expect(s.calls).toHaveLength(2);
        });

        it("prev goes back by limit and never below 0", async () => {
            const s = setup();
            await searchOk(s, [provision()], true);
            let run = s.store.nextPage();
            s.last().resolve(page(s.last().input, [provision({ articleKey: "9" })], true));
            await run;
            run = s.store.prevPage();
            expect(s.last().input.offset).toBe(0);
            s.last().resolve(page(s.last().input, [provision()], true));
            await run;
            expect(s.store.prevPage()).toBeUndefined();
        });

        it("a failed next page keeps the current page", async () => {
            const s = setup();
            await searchOk(s, [provision()], true);
            const run = s.store.nextPage();
            s.last().resolve({ ok: false, error: { kind: "network" } });
            await run;
            expect(s.store.snapshot.value?.input.offset).toBe(0);
            expect(s.store.failure.value?.input.offset).toBe(20);
        });
    });

    describe("detail", () => {
        it("uses asOf from the result snapshot, not the form or a pending/failed request", async () => {
            const s = setup();
            await searchOk(s);
            const card = s.store.snapshot.value!.items[0]!;

            s.store.form.asOf = B; // form B
            const run = s.store.submit(); // request B pending
            s.store.openDetail(card);
            expect(s.store.detail.value?.asOf).toBe(A);

            s.last().resolve({ ok: false, error: { kind: "network" } }); // B fails
            await run;
            expect(s.store.detail.value?.asOf).toBe(A);
        });

        it("selection stays on snapshot A after search B succeeds", async () => {
            const s = setup();
            await searchOk(s);
            const card = s.store.snapshot.value!.items[0]!;
            s.store.openDetail(card);

            s.store.form.asOf = B;
            const run = s.store.submit();
            s.last().resolve(page(s.last().input, [provision({ versionId: "2" })], false));
            await run;
            expect(s.store.snapshot.value?.input.asOf).toBe(B);
            expect(s.store.detail.value?.asOf).toBe(A);
            expect(s.store.detail.value?.provision).toBe(card);
        });

        it("makes no extra API call for detail", async () => {
            const s = setup();
            await searchOk(s);
            s.store.openDetail(s.store.snapshot.value!.items[0]!);
            expect(s.calls).toHaveLength(1);
        });
    });
});
