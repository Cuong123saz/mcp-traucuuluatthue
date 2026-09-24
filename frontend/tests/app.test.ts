import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import App from "../src/App.vue";
import { createSearchStore } from "../src/stores/searchStore";
import { flush, manualApi, page, provision } from "./support";

const A = "2026-09-24";
const B = "2025-06-01";

function setup() {
    const m = manualApi();
    const store = createSearchStore(m.api, { today: () => A });
    const wrapper = mount(App, { props: { store }, attachTo: document.body });
    return { ...m, store, wrapper };
}

async function search(s: ReturnType<typeof setup>, q: string, items = [provision()], hasMore: boolean | null = false) {
    await s.wrapper.find("#q").setValue(q);
    await s.wrapper.find("form").trigger("submit");
    s.last().resolve(page(s.last().input, items, hasMore));
    await flush();
}

afterEach(() => {
    document.body.innerHTML = "";
});

describe("App", () => {
    it("shows first-run guidance and makes no request", () => {
        const s = setup();
        expect(s.wrapper.find('[data-testid="empty-first-run"]').exists()).toBe(true);
        expect(s.calls).toHaveLength(0);
    });

    it("shows field errors for invalid q/asOf and does not call the API", async () => {
        const s = setup();
        await s.wrapper.find("form").trigger("submit");
        expect(s.wrapper.text()).toContain("Nhập từ khóa để tra cứu.");
        await s.wrapper.find("#q").setValue("thuế");
        await s.wrapper.find("#asOf").setValue("");
        await s.wrapper.find("form").trigger("submit");
        expect(s.wrapper.text()).toContain("Chọn ngày áp dụng.");
        expect(s.wrapper.find("#asOf").attributes("aria-invalid")).toBe("true");
        expect(s.calls).toHaveLength(0);
    });

    it("renders loading skeleton, then cards with snapshot date, source and badge", async () => {
        const s = setup();
        await s.wrapper.find("#q").setValue("thuế");
        await s.wrapper.find("form").trigger("submit");
        expect(s.wrapper.find('[data-testid="loading-skeleton"]').exists()).toBe(true);
        expect(s.wrapper.find('button[type="submit"]').attributes("disabled")).toBeDefined();
        expect(s.wrapper.find('button[type="submit"]').text()).toBe("Đang tra cứu…");

        s.last().resolve(page(s.last().input, [provision()], false));
        await flush();
        const text = s.wrapper.text();
        expect(s.wrapper.find('[data-testid="loading-skeleton"]').exists()).toBe(false);
        expect(text).toContain("Kết quả áp dụng tại ngày 24/09/2026");
        expect(text).toContain("Từ 01/01/2026 · không thời hạn kết thúc");
        expect(text).toContain("DEMO-TAX-001 · Văn bản thuế minh họa - bản mới");
        const link = s.wrapper.find("a.source-link");
        expect(link.attributes("href")).toBe("https://example.invalid/tax/001/v2#article-1");
        expect(link.attributes("rel")).toBe("noopener noreferrer");
        expect(link.attributes("target")).toBe("_blank");
    });

    it("never shows a total or a sort control", async () => {
        const s = setup();
        await search(s, "thuế", [provision()], true);
        const text = s.wrapper.text();
        expect(text).toContain("Đang xem 1–1");
        expect(text).not.toMatch(/tổng|Tìm thấy khoảng|Sắp xếp/i);
        expect(s.wrapper.findAll("select")).toHaveLength(1); // limit only
    });

    it("shows no-results with the snapshot date", async () => {
        const s = setup();
        await search(s, "không có", []);
        expect(s.wrapper.find('[data-testid="empty-no-results"]').text()).toContain(
            "Không có điều khoản nào khớp tại ngày 24/09/2026"
        );
        expect(s.wrapper.find(".pager").exists()).toBe(false);
    });

    it("shows an error banner with requestId and retry, keeping previous cards", async () => {
        const s = setup();
        await search(s, "thuế");
        await s.wrapper.find("form").trigger("submit");
        s.last().resolve({ ok: false, error: { kind: "domain", code: "DEPENDENCY_UNAVAILABLE", requestId: "r-503" } });
        await flush();
        const banner = s.wrapper.find('[data-testid="error-banner"]');
        expect(banner.text()).toContain("Hệ thống đang tạm thời không phản hồi");
        expect(banner.text()).toContain("Mã yêu cầu: r-503");
        expect(banner.find("button.btn:not(.btn-small)").text()).toBe("Thử lại");
        expect(s.wrapper.findAll('[data-testid="provision-card"]')).toHaveLength(1);
        expect(s.wrapper.find('[data-testid="previous-notice"]').exists()).toBe(true);
    });

    it("shows a network error without inventing a requestId", async () => {
        const s = setup();
        await s.wrapper.find("#q").setValue("thuế");
        await s.wrapper.find("form").trigger("submit");
        s.last().resolve({ ok: false, error: { kind: "network" } });
        await flush();
        const banner = s.wrapper.find('[data-testid="error-banner"]');
        expect(banner.text()).toContain("Không kết nối được");
        expect(banner.text()).not.toContain("Mã yêu cầu");
    });

    it("shows the stale notice with the old date while the form differs", async () => {
        const s = setup();
        await search(s, "thuế");
        await s.wrapper.find("#asOf").setValue(B);
        const notice = s.wrapper.find('[data-testid="stale-notice"]');
        expect(notice.text()).toContain("(ngày 24/09/2026)");
        expect(s.wrapper.find('[data-testid="result-context"]').text()).toContain("24/09/2026");
        expect(s.wrapper.find('[data-testid="card-list"]').classes()).toContain("dimmed");
        expect(s.calls).toHaveLength(1); // no auto-search
        await s.wrapper.find("#asOf").setValue(A);
        expect(s.wrapper.find('[data-testid="stale-notice"]').exists()).toBe(false);
    });

    it("pagination hasMore=false disables next and shows the end note", async () => {
        const s = setup();
        await search(s, "thuế", [provision()], false);
        expect(s.wrapper.find('[data-testid="pager-next"]').attributes("disabled")).toBeDefined();
        expect(s.wrapper.text()).toContain("Đã hết kết quả.");
    });

    it("pagination hasMore=true enables next", async () => {
        const s = setup();
        await search(s, "thuế", [provision()], true);
        expect(s.wrapper.find('[data-testid="pager-next"]').attributes("disabled")).toBeUndefined();
        expect(s.wrapper.find('[data-testid="pager-unknown"]').exists()).toBe(false);
    });

    it("pagination hasMore=null probes, then shows end-of-results and Back restores", async () => {
        const s = setup();
        await s.wrapper.find("#limit").setValue("100");
        await search(s, "thuế", [provision()], null);
        expect(s.wrapper.find('[data-testid="pager-unknown"]').exists()).toBe(true);
        expect(s.wrapper.find('[data-testid="pager-next"]').attributes("disabled")).toBeUndefined();

        await s.wrapper.find('[data-testid="pager-next"]').trigger("click");
        s.last().resolve(page(s.last().input, [], false));
        await flush();
        const end = s.wrapper.find('[data-testid="empty-end-of-results"]');
        expect(end.text()).toContain("Đã hết kết quả");
        expect(s.wrapper.find('[data-testid="card-list"]').exists()).toBe(false);

        await end.find("button").trigger("click");
        expect(s.wrapper.findAll('[data-testid="provision-card"]')).toHaveLength(1);
        expect(s.wrapper.text()).toContain("Đang xem 1–1");
    });

    it("detail panel uses the snapshot asOf, full body and versionId as string", async () => {
        const s = setup();
        await search(s, "thuế");
        // Form moves to B and a B search is in flight when detail is opened.
        await s.wrapper.find("#asOf").setValue(B);
        await s.wrapper.find("form").trigger("submit");
        await s.wrapper.find('[data-testid="provision-card"] button').trigger("click");

        const panel = document.querySelector('[data-testid="detail-panel"]')!;
        expect(panel.getAttribute("role")).toBe("dialog");
        expect(panel.getAttribute("aria-modal")).toBe("true");
        expect(panel.querySelector('[data-testid="detail-asof"]')?.textContent).toContain("24/09/2026");
        expect(panel.querySelector('[data-testid="detail-version-id"]')?.textContent).toBe("9007199254740993");
        expect(panel.querySelector(".detail-body")?.textContent).toBe("Thuế áp dụng theo nội dung mới.\nDòng thứ hai.");
        expect(s.calls).toHaveLength(2); // search A + search B; no detail request

        // B fails; the panel still shows date A.
        s.last().resolve({ ok: false, error: { kind: "network" } });
        await flush();
        expect(document.querySelector('[data-testid="detail-asof"]')?.textContent).toContain("24/09/2026");

        // Background is inert while the modal is open; Esc closes and restores focus.
        expect(s.wrapper.find(".page").attributes("inert")).toBeDefined();
        panel.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        await flush();
        expect(document.querySelector('[data-testid="detail-panel"]')).toBeNull();
        expect(document.activeElement?.textContent?.trim()).toBe("Xem chi tiết");
    });

    it("shows a data error and keeps the previous cards for an invalid response", async () => {
        const s = setup();
        await search(s, "thuế", [provision({ articleKey: "valid" })]);
        await s.wrapper.find("form").trigger("submit");
        s.last().resolve({ ok: false, error: { kind: "data", requestId: "bad-response" } });
        await flush();

        const banner = s.wrapper.find('[data-testid="error-banner"]');
        expect(banner.text()).toContain("Dữ liệu không nhất quán");
        expect(banner.text()).toContain("Mã yêu cầu: bad-response");
        expect(banner.find("button.btn:not(.btn-small)").exists()).toBe(false);
        expect(s.wrapper.findAll('[data-testid="provision-card"]')).toHaveLength(1);
        expect(s.wrapper.find('[data-testid="provision-card"]').text()).toContain("valid");
        expect(s.wrapper.find("a.source-link").attributes("href")).toBe(
            "https://example.invalid/tax/001/v2#article-1"
        );
    });

    it("renders content as text, never as HTML", async () => {
        const s = setup();
        await search(s, "thuế", [provision({ body: "<img src=x onerror=alert(1)>" })]);
        expect(s.wrapper.find(".body-clamp img").exists()).toBe(false);
        expect(s.wrapper.find(".body-clamp").text()).toBe("<img src=x onerror=alert(1)>");
    });
});
