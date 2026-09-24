-- Repository parameterized statement (never concatenate user input).
-- $1 document number (required, nonblank); $2 asOf date (required, finite).
-- Returns zero rows when the document does not exist. When it exists, returns
-- one row per relation in force at asOf (both ends inclusive), or a single row
-- with NULL direction when there is none.
-- direction 'outgoing': this document acts on the other one (vd: nó thay thế văn bản khác).
-- direction 'incoming': the other document acts on this one (vd: nó bị văn bản khác thay thế).
WITH target AS (
    SELECT d.id, d.document_number, d.title
    FROM documents d
    WHERE d.document_number = $1::text AND isfinite($2::date)
)
SELECT t.document_number AS "documentNumber", t.title AS "documentTitle",
       r.direction AS "direction", r.relation_type AS "relationType",
       o.document_number AS "otherDocumentNumber", o.title AS "otherTitle",
       r.source_url AS "sourceUrl", r.effective_from AS "effectiveFrom",
       r.effective_to AS "effectiveTo"
FROM target t
LEFT JOIN LATERAL (
    SELECT 'outgoing' AS direction, rel.relation_type, rel.to_document_id AS other_id,
           rel.source_url, rel.effective_from, rel.effective_to
    FROM document_relations rel
    WHERE rel.from_document_id = t.id
    UNION ALL
    SELECT 'incoming' AS direction, rel.relation_type, rel.from_document_id AS other_id,
           rel.source_url, rel.effective_from, rel.effective_to
    FROM document_relations rel
    WHERE rel.to_document_id = t.id
) r ON r.effective_from <= $2::date AND (r.effective_to IS NULL OR r.effective_to >= $2::date)
LEFT JOIN documents o ON o.id = r.other_id
ORDER BY r.direction, r.effective_from, o.document_number;
