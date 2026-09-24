import type { ProvisionRow } from "../../src/taxlaw/repository/tax-law-repository.js";

/**
 * Mirror of artifacts/db/seed.sql, flattened to the join shape both query
 * artifacts produce. Synthetic data on reserved example.invalid hosts — not
 * real Vietnamese law.
 *
 * Version -101: approved 2025-01-01 .. 2025-12-31 (bounded end)
 * Version -102: approved 2026-01-01 .. NULL       (open end)
 * Version -103: draft, -201: rejected             (must never be visible)
 * The v1/v2 markers in each URL make a wrong-source read obvious.
 */
export interface FixtureRow extends ProvisionRow {
    status: "draft" | "approved" | "rejected";
}

export const FIXTURE_ROWS: FixtureRow[] = [
    {
        status: "approved",
        documentId: "-1",
        documentVersionId: "-101",
        provisionId: "-1001",
        documentNumber: "DEMO-TAX-001",
        title: "Văn bản thuế minh họa - bản cũ",
        articleKey: "1",
        heading: "Thuế minh họa",
        body: "Thuế áp dụng theo nội dung cũ. oldonly",
        sourceUrl: "https://example.invalid/tax/001/v1#article-1",
        effectiveFrom: "2025-01-01",
        effectiveTo: "2025-12-31"
    },
    {
        status: "approved",
        documentId: "-1",
        documentVersionId: "-101",
        provisionId: "-1002",
        documentNumber: "DEMO-TAX-001",
        title: "Văn bản thuế minh họa - bản cũ",
        articleKey: "2",
        heading: "Kê khai minh họa",
        body: "Nội dung kê khai giữ nguyên.",
        sourceUrl: "https://example.invalid/tax/001/v1#article-2",
        effectiveFrom: "2025-01-01",
        effectiveTo: "2025-12-31"
    },
    {
        status: "approved",
        documentId: "-1",
        documentVersionId: "-101",
        provisionId: "-1003",
        documentNumber: "DEMO-TAX-001",
        title: "Văn bản thuế minh họa - bản cũ",
        articleKey: "3",
        heading: "Điều đã bỏ",
        body: "Thuế điều cũ đã bỏ. removedonly",
        sourceUrl: "https://example.invalid/tax/001/v1#article-3",
        effectiveFrom: "2025-01-01",
        effectiveTo: "2025-12-31"
    },
    {
        status: "approved",
        documentId: "-1",
        documentVersionId: "-102",
        provisionId: "-1004",
        documentNumber: "DEMO-TAX-001",
        title: "Văn bản thuế minh họa - bản mới",
        articleKey: "1",
        heading: "Thuế minh họa",
        body: "Thuế áp dụng theo nội dung mới. newonly",
        sourceUrl: "https://example.invalid/tax/001/v2#article-1",
        effectiveFrom: "2026-01-01",
        effectiveTo: null
    },
    {
        status: "approved",
        documentId: "-1",
        documentVersionId: "-102",
        provisionId: "-1005",
        documentNumber: "DEMO-TAX-001",
        title: "Văn bản thuế minh họa - bản mới",
        articleKey: "2",
        heading: "Kê khai minh họa",
        body: "Nội dung kê khai giữ nguyên.",
        sourceUrl: "https://example.invalid/tax/001/v2#article-2",
        effectiveFrom: "2026-01-01",
        effectiveTo: null
    },
    {
        status: "draft",
        documentId: "-1",
        documentVersionId: "-103",
        provisionId: "-1006",
        documentNumber: "DEMO-TAX-001",
        title: "Bản nháp không được công bố",
        articleKey: "1",
        heading: "Thuế bản nháp",
        body: "Thuế chưa duyệt. draftonly",
        sourceUrl: "https://example.invalid/tax/001/draft#article-1",
        effectiveFrom: "2026-01-01",
        effectiveTo: null
    },
    {
        status: "rejected",
        documentId: "-2",
        documentVersionId: "-201",
        provisionId: "-1007",
        documentNumber: "DEMO-TAX-002",
        title: "Bản bị từ chối",
        articleKey: "1",
        heading: "Thuế bị từ chối",
        body: "Thuế bị từ chối. rejectedonly",
        sourceUrl: "https://example.invalid/tax/002/rejected#article-1",
        effectiveFrom: "2025-01-01",
        effectiveTo: null
    }
];
