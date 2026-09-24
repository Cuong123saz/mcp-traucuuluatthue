-- $1 documentNumber text; $2 articleKey text; $3 asOf date (required, finite).
-- Exact identifiers. Service validates inputs and maps zero rows to not found.
-- No fallback to a past, future, draft, or different article version.
SELECT d.id AS "documentId", v.id AS "documentVersionId", p.id AS "provisionId",
       d.document_number AS "documentNumber", v.title AS "title",
       p.article_key AS "articleKey", p.heading AS "heading", p.body AS "body",
       p.source_url AS "sourceUrl", v.effective_from AS "effectiveFrom",
       v.effective_to AS "effectiveTo"
FROM documents d
JOIN document_versions v ON v.document_id = d.id
JOIN provisions p ON p.document_version_id = v.id
WHERE d.document_number = $1::text
  AND p.article_key = $2::text
  AND v.status = 'approved'
  AND isfinite($3::date)
  AND v.effective_interval @> $3::date;
