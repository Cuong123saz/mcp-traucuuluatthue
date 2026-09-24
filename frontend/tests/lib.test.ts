import { describe, expect, it } from "vitest";
import { formatCalendarDate, isCalendarDate, localToday } from "../src/lib/calendarDate";
import { inspectEffective, inspectProvision, looksLikeDocumentNumber } from "../src/lib/provision";
import { inspectSourceUrl } from "../src/lib/sourceUrl";
import { provision } from "./support";

describe("calendarDate", () => {
    it("formats YYYY-MM-DD to DD/MM/YYYY by string split", () => {
        expect(formatCalendarDate("2026-01-31")).toBe("31/01/2026");
        expect(formatCalendarDate("2025-12-01")).toBe("01/12/2025");
    });

    it("validates real calendar dates including leap years", () => {
        expect(isCalendarDate("2024-02-29")).toBe(true);
        expect(isCalendarDate("2025-02-29")).toBe(false);
        expect(isCalendarDate("1900-02-29")).toBe(false);
        expect(isCalendarDate("2000-02-29")).toBe(true);
        expect(isCalendarDate("2026-02-31")).toBe(false);
        expect(isCalendarDate("2026-04-31")).toBe(false);
        expect(isCalendarDate("2026-13-01")).toBe(false);
        expect(isCalendarDate("2026-1-01")).toBe(false);
        expect(isCalendarDate("")).toBe(false);
        expect(isCalendarDate(null)).toBe(false);
    });

    it("reads today from local calendar fields, not UTC", () => {
        // 23:30 local on 31 Dec: toISOString() could already be 1 Jan in UTC.
        expect(localToday(new Date(2026, 11, 31, 23, 30))).toBe("2026-12-31");
        expect(localToday(new Date(2026, 0, 1, 0, 5))).toBe("2026-01-01");
    });

    it("does not use Date parsing for API date strings", async () => {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const dir = path.resolve(__dirname, "../src");
        const files = fs.readdirSync(dir, { recursive: true }) as string[];
        for (const f of files) {
            if (!/\.(ts|vue)$/.test(f)) continue;
            // Code only: comments are allowed to name the forbidden calls.
            const text = fs
                .readFileSync(path.join(dir, f), "utf8")
                .replace(/\/\*[\s\S]*?\*\//g, "")
                .replace(/^\s*\/\/.*$/gm, "")
                .replace(/<!--[\s\S]*?-->/g, "");
            expect(text, f).not.toMatch(/toLocaleDateString/);
            expect(text, f).not.toMatch(/new Date\(\s*[a-zA-Z_"'`]/);
            expect(text, f).not.toMatch(/toISOString\(\)/);
        }
    });
});

describe("provision integrity", () => {
    it("treats effectiveTo null as an open, valid end", () => {
        expect(inspectEffective(provision(), "2026-09-24")).toEqual({
            kind: "applicable",
            from: "2026-01-01",
            to: null
        });
    });

    it("includes both interval ends", () => {
        const p = provision({ effectiveFrom: "2025-01-01", effectiveTo: "2025-12-31" });
        expect(inspectEffective(p, "2025-01-01").kind).toBe("applicable");
        expect(inspectEffective(p, "2025-12-31").kind).toBe("applicable");
        expect(inspectEffective(p, "2026-01-01").kind).toBe("mismatch");
    });

    it("treats an absent effectiveTo as missing, not as null", () => {
        const p = provision();
        delete (p as Record<string, unknown>).effectiveTo;
        expect(inspectEffective(p, "2026-09-24").kind).toBe("missing");
    });

    it("flags missing source or interval as a data error", () => {
        expect(inspectProvision(provision(), "2026-09-24").hasDataError).toBe(false);
        expect(inspectProvision(provision({ sourceUrl: "" }), "2026-09-24").hasDataError).toBe(true);
        expect(inspectProvision(provision({ effectiveFrom: undefined }), "2026-09-24").hasDataError).toBe(true);
        expect(inspectProvision(provision({ effectiveFrom: "2026-02-31" }), "2026-09-24").hasDataError).toBe(true);
    });

    it("only allows http/https sources", () => {
        expect(inspectSourceUrl("https://example.invalid/a").kind).toBe("ok");
        expect(inspectSourceUrl("javascript:alert(1)").kind).toBe("invalid");
        expect(inspectSourceUrl("not a url").kind).toBe("invalid");
        expect(inspectSourceUrl(undefined).kind).toBe("missing");
    });

    it("detects document-number-looking queries for the hint", () => {
        expect(looksLikeDocumentNumber("13/2008/QH12")).toBe(true);
        expect(looksLikeDocumentNumber("thu nhập chịu thuế")).toBe(false);
    });
});
