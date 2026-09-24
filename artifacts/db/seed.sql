-- Synthetic fixtures ONLY, not Vietnamese law. Reserved example.invalid URLs.
-- Run once after schema.sql in a disposable development/test database.
-- Negative IDs avoid advancing/conflicting with positive identity sequences.
BEGIN;
INSERT INTO documents (id, document_number, title, issuing_body, issued_on, source_url) VALUES
    (-1, 'DEMO-TAX-001', 'Văn bản thuế minh họa', 'Cơ quan minh họa', '2024-12-01', 'https://example.invalid/tax/001'),
    (-2, 'DEMO-TAX-002', 'Văn bản thuế minh họa thứ hai', 'Cơ quan minh họa', '2024-12-02', 'https://example.invalid/tax/002');
INSERT INTO ingestion_snapshots (id, document_id, source_url, content_sha256, raw_payload) VALUES
    (-11, -1, 'https://example.invalid/tax/001/v1', repeat('a', 64), '{"fixture":true,"version":1}'),
    (-12, -1, 'https://example.invalid/tax/001/v2', repeat('b', 64), '{"fixture":true,"version":2}'),
    (-13, -1, 'https://example.invalid/tax/001/draft', repeat('c', 64), '{"fixture":true,"version":3}'),
    (-21, -2, 'https://example.invalid/tax/002/rejected', repeat('d', 64), '{"fixture":true,"version":1}');
INSERT INTO document_versions
    (id, document_id, version_number, title, source_url, ingestion_snapshot_id,
     status, approved_at, approved_by, effective_from, effective_to)
VALUES
    (-101, -1, 1, 'Văn bản thuế minh họa - bản cũ', 'https://example.invalid/tax/001/v1',
     -11, 'approved', '2024-12-20T00:00:00Z', 'fixture-reviewer', '2025-01-01', '2025-12-31'),
    (-102, -1, 2, 'Văn bản thuế minh họa - bản mới', 'https://example.invalid/tax/001/v2',
     -12, 'approved', '2025-12-20T00:00:00Z', 'fixture-reviewer', '2026-01-01', NULL),
    (-103, -1, 3, 'Bản nháp không được công bố', 'https://example.invalid/tax/001/draft',
     -13, 'draft', NULL, NULL, '2026-01-01', NULL),
    (-201, -2, 1, 'Bản bị từ chối', 'https://example.invalid/tax/002/rejected',
     -21, 'rejected', NULL, NULL, '2025-01-01', NULL);
INSERT INTO provisions (id, document_version_id, article_key, heading, body, source_url) VALUES
    (-1001, -101, '1', 'Thuế minh họa', 'Thuế áp dụng theo nội dung cũ. oldonly', 'https://example.invalid/tax/001/v1#article-1'),
    (-1002, -101, '2', 'Kê khai minh họa', 'Nội dung kê khai giữ nguyên.', 'https://example.invalid/tax/001/v1#article-2'),
    (-1003, -101, '3', 'Điều đã bỏ', 'Thuế điều cũ đã bỏ. removedonly', 'https://example.invalid/tax/001/v1#article-3'),
    (-1004, -102, '1', 'Thuế minh họa', 'Thuế áp dụng theo nội dung mới. newonly', 'https://example.invalid/tax/001/v2#article-1'),
    (-1005, -102, '2', 'Kê khai minh họa', 'Nội dung kê khai giữ nguyên.', 'https://example.invalid/tax/001/v2#article-2'),
    (-1006, -103, '1', 'Thuế bản nháp', 'Thuế chưa duyệt. draftonly', 'https://example.invalid/tax/001/draft#article-1'),
    (-1007, -201, '1', 'Thuế bị từ chối', 'Thuế bị từ chối. rejectedonly', 'https://example.invalid/tax/002/rejected#article-1');
INSERT INTO document_relations
    (id, from_document_id, to_document_id, relation_type, source_url, effective_from)
VALUES (-1, -2, -1, 'consolidates', 'https://example.invalid/tax/002/rejected', '2025-01-01');
COMMIT;
