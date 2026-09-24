import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../src/App.vue";
import { presentRelationsError } from "../src/lib/errorPresentation";
import { relationAlert } from "../src/lib/relations";
import { buildRelationsUrl, createTaxLawApi, parseRelationsSuccess } from "../src/lib/taxLawApi";
import { createRelationsStore } from "../src/stores/relationsStore";
import { createSearchStore } from "../src/stores/searchStore";
import { flush, manualApi, page, provision, relationItem, relationsOk } from "./support";

const A = "2026-09-24";
const B = "2025-06-01";
const input = { documentNumber: "DEMO-TAX-001", asOf: A };

function relEnvelope(data: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
    return {
        data: {
            documentNumber: "DEMO-TAX-001",
            title: "Văn bản thuế minh họa - bản mới",
            asOf: A,
            outgoing: [],
            incoming: [relationItem()],
            ...data
        },
        requestId: "rel-1",
        ...extra
    };
}

function jsonResponse(status: number, body: unknown) {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("GET /relations adapter", () => {
    it("sends exactly documentNumber and asOf to /api/relations", async () => {
        const fetch = vi.fn(async (_url: string | URL | Request) => jsonResponse(200, relEnvelope()));
        const api = createTaxLawApi({ baseUrl: "/api", fetch: fetch as unknown as typeof globalThis.fetch });
        await api.relations({ documentNumber: "48/2024/QH15", asOf: A });

        const url = String(fetch.mock.calls[0]![0]);
        expect(url.startsWith("/api/relations?")).toBe(true);
        const params = new URLSearchParams(url.split("?")[1]);
        expect([...params.keys()]).toEqual(["documentNumber", "asOf"]);
        expect(params.get("documentNumber")).toBe("48/2024/QH15");
        expect(params.get("asOf")).toBe(A);
        expect(buildRelationsUrl("/api/", input)).toBe("/api/relations?documentNumber=DEMO-TAX-001&asOf=2026-09-24");
    });

    it("parses a contract success envelope", async () => {
        const api = createTaxLawApi({
            baseUrl: "/api",
            fetch: async () =>
                jsonResponse(
                    200,
                    relEnvelope({ outgoing: [relationItem({ relationType: "guides", label: "Hướng dẫn", effectiveTo: null })] })
                )
        });
        const outcome = await api.relations(input);
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.value.requestId).toBe("rel-1");
        expect(outcome.value.incoming).toEqual([relationItem()]);
        expect(outcome.value.outgoing[0]!.effectiveTo).toBeNull();
    });

    it("accepts two empty arrays", () => {
        const outcome = parseRelationsSuccess(relEnvelope({ incoming: [], outgoing: [] }), input);
        expect(outcome.ok && outcome.value.incoming.length + outcome.value.outgoing.length).toBe(0);
    });

    it("maps 404 NOT_FOUND to a domain error with requestId", async () => {
        const api = createTaxLawApi({
            baseUrl: "/api",
            fetch: async () => jsonResponse(404, { error: { code: "NOT_FOUND", message: "x" }, requestId: "r-404" })
        });
        expect(await api.relations(input)).toEqual({
            ok: false,
            error: { kind: "domain", code: "NOT_FOUND", requestId: "r-404" }
        });
    });

    it.each([
        ["missing sourceUrl", { sourceUrl: undefined }],
        ["non-http sourceUrl", { sourceUrl: "javascript:alert(1)" }],
        ["invalid effectiveFrom", { effectiveFrom: "2025-02-30" }],
        ["effectiveTo before effectiveFrom", { effectiveFrom: "2026-01-01", effectiveTo: "2025-12-31" }],
        ["interval ends before asOf", { effectiveTo: "2026-09-23" }],
        ["interval starts after asOf", { effectiveFrom: "2026-09-25", effectiveTo: null }]
    ])("rejects a 200 with %s as a data error, not a filtered list", (_name, overrides) => {
        const bad = { ...relationItem(), ...overrides } as Record<string, unknown>;
        const outcome = parseRelationsSuccess(relEnvelope({ incoming: [relationItem(), bad] }), input);
        expect(outcome).toEqual({ ok: false, error: { kind: "data", requestId: "rel-1" } });
    });

    it("treats an absent effectiveTo as a data error (null is the open end)", () => {
        const bad: Record<string, unknown> = { ...relationItem() };
        delete bad.effectiveTo;
        expect(parseRelationsSuccess(relEnvelope({ outgoing: [bad] }), input)).toEqual({
            ok: false,
            error: { kind: "data", requestId: "rel-1" }
        });
    });

    it("includes both ends of the relation interval", () => {
        const edges = [relationItem({ effectiveFrom: A, effectiveTo: A })];
        expect(parseRelationsSuccess(relEnvelope({ incoming: edges }), input).ok).toBe(true);
    });

    it("rejects envelopes that do not match the request or the contract as protocol errors", () => {
        const protocol = { ok: false, error: { kind: "protocol", requestId: "rel-1" } };
        expect(parseRelationsSuccess(relEnvelope({ asOf: B }), input)).toEqual(protocol);
        expect(parseRelationsSuccess(relEnvelope({ documentNumber: "OTHER" }), input)).toEqual(protocol);
        expect(parseRelationsSuccess(relEnvelope({ incoming: null }), input)).toEqual(protocol);
        expect(parseRelationsSuccess(relEnvelope({ incoming: [relationItem({ relationType: "cites" })] }), input)).toEqual(
            protocol
        );
        expect(parseRelationsSuccess(relEnvelope({}, { requestId: undefined }), input)).toEqual({
            ok: false,
            error: { kind: "protocol", requestId: undefined }
        });
    });
});

describe("relation alert rule", () => {
    it("is decided by relationType in incoming, never by label", () => {
        expect(relationAlert([relationItem({ relationType: "guides", label: "Bị bãi bỏ / thay thế bởi" })])).toBeNull();
        expect(relationAlert([relationItem({ relationType: "consolidates" })])).toBeNull();
        expect(relationAlert([relationItem({ relationType: "repeals", label: "nhãn bất kỳ" })])?.titleKey).toBe(
            "relations.alert.repeals.title"
        );
    });

    it("uses the repeals title when both exist and lists repeals before amends in API order", () => {
        const a1 = relationItem({ documentNumber: "A1" });
        const r1 = relationItem({ relationType: "repeals", documentNumber: "R1" });
        const a2 = relationItem({ documentNumber: "A2" });
        const r2 = relationItem({ relationType: "repeals", documentNumber: "R2" });
        const model = relationAlert([a1, r1, a2, r2]);
        expect(model?.titleKey).toBe("relations.alert.repeals.title");
        expect(model?.lines.map((l) => l.documentNumber)).toEqual(["R1", "R2", "A1", "A2"]);
    });

    it("maps errors to copy and retry policy", () => {
        expect(presentRelationsError({ kind: "domain", code: "NOT_FOUND", requestId: "r" })).toMatchObject({
            titleKey: "relations.error.notFound.title",
            retryable: false,
            requestId: "r"
        });
        expect(presentRelationsError({ kind: "domain", code: "DATA_INTEGRITY_ERROR" }).retryable).toBe(false);
        expect(presentRelationsError({ kind: "domain", code: "INVALID_ARGUMENT" }).retryable).toBe(false);
        expect(presentRelationsError({ kind: "domain", code: "DEPENDENCY_UNAVAILABLE" }).retryable).toBe(true);
        expect(presentRelationsError({ kind: "domain", code: "INTERNAL_ERROR" }).retryable).toBe(true);
        expect(presentRelationsError({ kind: "network" })).toEqual({
            titleKey: "relations.error.generic.title",
            bodyKey: "relations.error.generic.body",
            retryable: true
        });
        expect(presentRelationsError({ kind: "data", requestId: "d" })).toMatchObject({
            titleKey: "relations.error.dataIntegrity.title",
            retryable: false
        });
    });
});

describe("relations store", () => {
    it("ignores a late response for a previous selection and aborts it", async () => {
        const m = manualApi();
        const store = createRelationsStore(m.api);
        const first = store.load("DOC-A", A);
        const second = store.load("DOC-B", A);
        expect(m.relationCalls[0]!.signal?.aborted).toBe(true);

        m.relationCalls[1]!.resolve(relationsOk(m.relationCalls[1]!.input, { incoming: [relationItem()] }));
        await second;
        m.relationCalls[0]!.resolve(
            relationsOk(m.relationCalls[0]!.input, { incoming: [relationItem({ relationType: "repeals" })] })
        );
        await first;

        const state = store.state.value;
        expect(state.status).toBe("success");
        if (state.status !== "success") return;
        expect(state.input.documentNumber).toBe("DOC-B");
        expect(state.data.incoming[0]!.relationType).toBe("amends");
    });

    it("cancel aborts the request and a late response does not revive the state", async () => {
        const m = manualApi();
        const store = createRelationsStore(m.api);
        const run = store.load("DOC-A", A);
        store.cancel();
        expect(m.lastRelations().signal?.aborted).toBe(true);
        m.lastRelations().resolve(relationsOk(m.lastRelations().input));
        await run;
        expect(store.state.value).toEqual({ status: "idle" });
    });

    it("retries only retryable errors, with the same input", async () => {
        const m = manualApi();
        const store = createRelationsStore(m.api);
        const run = store.load("DOC-A", A);
        m.lastRelations().resolve({ ok: false, error: { kind: "domain", code: "NOT_FOUND", requestId: "r" } });
        await run;
        expect(store.retry()).toBeUndefined();

        const run2 = store.load("DOC-A", A);
        m.lastRelations().resolve({ ok: false, error: { kind: "domain", code: "DEPENDENCY_UNAVAILABLE" } });
        await run2;
        void store.retry();
        expect(store.state.value.status).toBe("loading");
        expect(m.relationCalls).toHaveLength(3);
        expect(m.lastRelations().input).toEqual({ documentNumber: "DOC-A", asOf: A });
    });
});

describe("detail panel: Văn bản liên quan", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    async function openPanel(items = [provision()]) {
        const m = manualApi();
        const store = createSearchStore(m.api, { today: () => A });
        const relations = createRelationsStore(m.api);
        const wrapper = mount(App, { props: { store, relations }, attachTo: document.body });
        await wrapper.find("#q").setValue("thuế");
        await wrapper.find("form").trigger("submit");
        m.last().resolve(page(m.last().input, items, false));
        await flush();
        await wrapper.find('[data-testid="provision-card"] button').trigger("click");
        await flush();
        const panel = () => document.querySelector<HTMLElement>('[data-testid="detail-panel"]')!;
        return { ...m, store, relations, wrapper, panel };
    }

    async function resolveRelations(
        s: Awaited<ReturnType<typeof openPanel>>,
        groups: Parameters<typeof relationsOk>[1]
    ) {
        s.lastRelations().resolve(relationsOk(s.lastRelations().input, groups));
        await flush();
    }

    it("requests relations for the provision's document at the selection asOf, content not waiting", async () => {
        const s = await openPanel();
        expect(s.relationCalls).toHaveLength(1);
        expect(s.lastRelations().input).toEqual({ documentNumber: "DEMO-TAX-001", asOf: A });

        const panel = s.panel();
        expect(panel.querySelector(".detail-body")?.textContent).toContain("Thuế áp dụng theo nội dung mới.");
        const section = panel.querySelector('[data-testid="related-documents"]')!;
        expect(section.getAttribute("aria-busy")).toBe("true");
        expect(section.textContent).toContain("Văn bản liên quan");
        expect(section.textContent).toContain("Đang tải văn bản liên quan…");
        expect(panel.querySelector('[data-testid="relation-alert"]')).toBeNull();
    });

    it("does not reload relations when the form changes or a new search runs", async () => {
        const s = await openPanel();
        s.store.form.asOf = B;
        void s.store.submit();
        await flush();
        expect(s.relationCalls).toHaveLength(1);
    });

    it("shows the repeals alert under the badge from incoming relationType", async () => {
        const s = await openPanel();
        await resolveRelations(s, {
            incoming: [
                relationItem({ documentNumber: "AM-1" }),
                relationItem({
                    relationType: "repeals",
                    label: "Bị bãi bỏ / thay thế bởi",
                    documentNumber: "110/2025/UBTVQH15",
                    effectiveFrom: "2026-01-01",
                    effectiveTo: null
                })
            ]
        });
        const panel = s.panel();
        const alert = panel.querySelector('[data-testid="relation-alert"]')!;
        expect(alert.getAttribute("role")).toBe("status");
        expect(alert.classList.contains("banner-warning")).toBe(true);
        expect(alert.textContent).toContain("Văn bản DEMO-TAX-001 đã bị bãi bỏ hoặc thay thế tại ngày 24/09/2026");
        const lines = Array.from(alert.querySelectorAll("li")).map((li) => li.textContent);
        expect(lines).toEqual([
            "Bị bãi bỏ / thay thế bởi 110/2025/UBTVQH15, từ 01/01/2026 · không thời hạn kết thúc",
            "Được sửa đổi, bổ sung bởi AM-1, từ 01/07/2025 đến hết 31/12/2026"
        ]);
        // Placed after the badge and before the body.
        const order = Array.from(panel.querySelectorAll(".badge-wrap, [data-testid=relation-alert], .detail-body"));
        expect(order.map((el) => el.className.split(" ")[0])).toEqual(["badge-wrap", "banner", "detail-body"]);
        // The provision badge is unchanged (DA-16).
        expect(panel.querySelector(".badge")?.getAttribute("data-state")).toBe("applicable");

        const warnTags = panel.querySelectorAll('[data-testid="relations-incoming"] .warn-label');
        expect(warnTags).toHaveLength(2);
    });

    it("shows the amends alert and lists groups incoming then outgoing", async () => {
        const s = await openPanel();
        await resolveRelations(s, {
            incoming: [relationItem({ documentNumber: "204/2025/QH15" })],
            outgoing: [relationItem({ relationType: "repeals", label: "Bãi bỏ / thay thế", documentNumber: "OLD-1" })]
        });
        const panel = s.panel();
        expect(panel.querySelector('[data-testid="relation-alert"]')?.textContent).toContain(
            "Văn bản DEMO-TAX-001 có văn bản sửa đổi, bổ sung đang có hiệu lực tại ngày 24/09/2026"
        );
        const section = panel.querySelector('[data-testid="related-documents"]')!;
        expect(section.getAttribute("aria-busy")).toBe("false");
        expect(section.textContent).toContain("Quan hệ có hiệu lực tại ngày 24/09/2026");
        const headings = Array.from(section.querySelectorAll("h4")).map((h) => h.textContent);
        expect(headings).toEqual(["Văn bản khác tác động lên văn bản này", "Văn bản này tác động lên văn bản khác"]);

        const outgoing = section.querySelector('[data-testid="relations-outgoing"] [data-testid="relation-item"]')!;
        expect(outgoing.querySelector(".warn-label")).toBeNull();
        expect(outgoing.querySelector(".relation-label")?.textContent).toBe("Bãi bỏ / thay thế");
        expect(outgoing.querySelector(".relation-range")?.textContent).toBe("Từ 01/07/2025 đến hết 31/12/2026");
        expect(outgoing.querySelector(".badge-applicable")).toBeNull();
        const link = outgoing.querySelector("a.source-link")!;
        expect(link.getAttribute("href")).toBe("https://example.invalid/tax/002");
        expect(link.getAttribute("rel")).toBe("noopener noreferrer");
        // documentNumber is plain text, not a link or button.
        expect(outgoing.querySelector("strong")?.closest("a, button")).toBeNull();
    });

    it("shows no alert for outgoing repeals, guides or consolidates only", async () => {
        const s = await openPanel();
        await resolveRelations(s, {
            incoming: [relationItem({ relationType: "guides", label: "Được hướng dẫn bởi" })],
            outgoing: [relationItem({ relationType: "repeals", label: "Bãi bỏ / thay thế" })]
        });
        expect(s.panel().querySelector('[data-testid="relation-alert"]')).toBeNull();
        expect(s.panel().querySelectorAll('[data-testid="relation-item"]')).toHaveLength(2);
    });

    it("shows the empty state with context and note when both arrays are empty", async () => {
        const s = await openPanel();
        await resolveRelations(s, {});
        const section = s.panel().querySelector('[data-testid="related-documents"]')!;
        expect(section.textContent).toContain("Quan hệ có hiệu lực tại ngày 24/09/2026");
        expect(section.querySelector('[data-testid="relations-empty"]')?.textContent).toContain(
            "Không có văn bản sửa đổi, bãi bỏ, hướng dẫn hay hợp nhất nào liên quan tới văn bản DEMO-TAX-001 có hiệu lực tại ngày 24/09/2026."
        );
        expect(section.textContent).toContain("Danh sách chỉ gồm các quan hệ đã có trong dữ liệu của hệ thống.");
        expect(section.querySelectorAll("h4")).toHaveLength(0);
        expect(s.panel().querySelector('[data-testid="relation-alert"]')).toBeNull();
    });

    it("shows a 404 in the section with requestId, no retry, and keeps the rest of the panel", async () => {
        const s = await openPanel();
        const statusBefore = s.store.status.value;
        s.lastRelations().resolve({ ok: false, error: { kind: "domain", code: "NOT_FOUND", requestId: "rel-404" } });
        await flush();

        const panel = s.panel();
        expect(panel).not.toBeNull();
        const error = panel.querySelector('[data-testid="related-documents"] [data-testid="relations-error"]')!;
        expect(error.classList.contains("banner-error")).toBe(true);
        expect(error.textContent).toContain("Không tìm thấy thông tin quan hệ của văn bản DEMO-TAX-001");
        expect(error.textContent).toContain("Chưa kiểm tra được văn bản này có bị sửa đổi hay bãi bỏ tại ngày 24/09/2026");
        expect(error.textContent).toContain("Mã yêu cầu: rel-404");
        expect(error.textContent).not.toContain("Thử lại");
        expect(panel.querySelector('[data-testid="relations-empty"]')).toBeNull();
        expect(panel.querySelector('[data-testid="relation-alert"]')).toBeNull();

        // Rest of the panel intact; search state untouched.
        expect(panel.querySelector("#detail-heading")?.textContent).toBe("Thuế minh họa");
        expect(panel.querySelector(".detail-body")?.textContent).toContain("Thuế áp dụng theo nội dung mới.");
        expect(panel.querySelector("a.source-link")?.getAttribute("href")).toBe(
            "https://example.invalid/tax/001/v2#article-1"
        );
        expect(panel.querySelector('[data-testid="detail-version-id"]')?.textContent).toBe("9007199254740993");
        expect(s.store.status.value).toBe(statusBefore);
        expect(s.store.failure.value).toBeNull();
        expect(s.wrapper.find('[data-testid="error-banner"]').exists()).toBe(false);
        expect(s.wrapper.findAll('[data-testid="provision-card"]')).toHaveLength(1);
    });

    it("shows the data-integrity copy for an invalid 200, and retry reloads only relations on 503", async () => {
        const s = await openPanel();
        s.lastRelations().resolve({ ok: false, error: { kind: "data", requestId: "rel-bad" } });
        await flush();
        let error = s.panel().querySelector('[data-testid="relations-error"]')!;
        expect(error.textContent).toContain("Dữ liệu văn bản liên quan không nhất quán");
        expect(error.textContent).toContain("Mã yêu cầu: rel-bad");
        expect(error.textContent).not.toContain("Thử lại");

        // Reopen (Esc, then the card again) and fail with 503.
        s.panel().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        await flush();
        await s.wrapper.find('[data-testid="provision-card"] button').trigger("click");
        await flush();
        s.lastRelations().resolve({
            ok: false,
            error: { kind: "domain", code: "DEPENDENCY_UNAVAILABLE", requestId: "rel-503" }
        });
        await flush();
        error = s.panel().querySelector('[data-testid="relations-error"]')!;
        expect(error.textContent).toContain("Không tải được văn bản liên quan");
        expect(error.textContent).toContain("Nội dung điều khoản ở trên vẫn hiển thị bình thường.");
        expect(error.textContent).toContain("Mã yêu cầu: rel-503");

        const searchCalls = s.calls.length;
        const retry = Array.from(error.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Thử lại")!;
        retry.click();
        await flush();
        expect(s.relationCalls).toHaveLength(3);
        expect(s.calls).toHaveLength(searchCalls);
        expect(s.panel().querySelector('[data-testid="relations-loading"]')).not.toBeNull();
    });

    it("shows a network error without a requestId", async () => {
        const s = await openPanel();
        s.lastRelations().resolve({ ok: false, error: { kind: "network" } });
        await flush();
        const error = s.panel().querySelector('[data-testid="relations-error"]')!;
        expect(error.textContent).not.toContain("Mã yêu cầu");
        expect(error.textContent).toContain("Thử lại");
    });

    it("ignores a late response after switching selection, and aborts on close", async () => {
        const s = await openPanel([provision({ articleKey: "1" }), provision({ articleKey: "2" })]);
        const firstCall = s.lastRelations();

        s.panel().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        await flush();
        expect(firstCall.signal?.aborted).toBe(true);

        await s.wrapper.findAll('[data-testid="provision-card"] button')[1]!.trigger("click");
        await flush();
        const secondCall = s.lastRelations();
        expect(s.relationCalls).toHaveLength(2);

        firstCall.resolve(relationsOk(firstCall.input, { incoming: [relationItem({ relationType: "repeals" })] }));
        await flush();
        expect(s.panel().querySelector('[data-testid="relation-alert"]')).toBeNull();
        expect(s.panel().querySelector('[data-testid="relations-loading"]')).not.toBeNull();

        secondCall.resolve(relationsOk(secondCall.input, {}));
        await flush();
        expect(s.panel().querySelector('[data-testid="relations-empty"]')).not.toBeNull();
        expect(s.panel().querySelector('[data-testid="relation-alert"]')).toBeNull();
    });

    it("jump link in the alert focuses the section heading", async () => {
        const s = await openPanel();
        await resolveRelations(s, { incoming: [relationItem()] });
        const link = s.panel().querySelector<HTMLAnchorElement>('[data-testid="relation-alert"] a')!;
        expect(link.getAttribute("href")).toBe("#detail-relations");
        expect(link.textContent).toBe("Xem văn bản liên quan");
        link.click();
        expect(document.activeElement?.id).toBe("detail-relations-heading");
    });
});
