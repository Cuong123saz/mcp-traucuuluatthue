-- Repository parameterized statement (never concatenate user input).
-- $1 keyword text (required, nonblank); $2 asOf date (required, finite);
-- $3 limit integer (required, 1..100); $4 offset integer (required, >= 0).
-- Service validates inputs; SQL returns zero rows for NULL/out-of-range inputs,
-- except negative LIMIT/OFFSET or invalid casts, which PostgreSQL rejects.
-- Search scope: heading + body, case insensitive, accent sensitive, simple tokens.
WITH input AS (
    SELECT plainto_tsquery('simple'::regconfig, $1::text) AS query,
           $2::date AS as_of
    WHERE btrim($1::text) <> '' AND isfinite($2::date)
      AND $3::integer BETWEEN 1 AND 100 AND $4::integer >= 0
)
SELECT d.id AS "documentId", v.id AS "documentVersionId", p.id AS "provisionId",
       d.document_number AS "documentNumber", v.title AS "title",
       p.article_key AS "articleKey", p.heading AS "heading", p.body AS "body",
       p.source_url AS "sourceUrl", v.effective_from AS "effectiveFrom",
       v.effective_to AS "effectiveTo"
FROM input i
JOIN document_versions v ON v.effective_interval @> i.as_of AND v.status = 'approved'
JOIN documents d ON d.id = v.document_id
JOIN provisions p ON p.document_version_id = v.id
WHERE p.search_vector @@ i.query
ORDER BY ts_rank_cd(p.search_vector, i.query) DESC,
         d.document_number, p.article_key, p.id
LIMIT $3::integer OFFSET $4::integer;
