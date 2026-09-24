/**
 * The ONLY place SQL text exists in this codebase. Route, MCP handler and
 * Service must never contain SQL (service-contract.md "Luồng và trách nhiệm").
 *
 * Both statements are copied verbatim from the DB artifacts:
 *   artifacts/db/query-search-tax-law.sql
 *   artifacts/db/query-get-tax-provision.sql
 *   artifacts/db/query-get-document-relations.sql
 * tests/sql-artifact-parity.test.ts fails if this copy drifts from the artifact.
 * Every value is bound as a parameter; nothing is ever concatenated.
 */

/** Binds: $1 q, $2 asOf, $3 limit (1..100), $4 offset (>= 0). */
export const SEARCH_TAX_LAW_SQL = `-- Repository parameterized statement (never concatenate user input).
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
`;

/** Binds: $1 documentNumber, $2 articleKey, $3 asOf. */
export const GET_TAX_PROVISION_SQL = `-- $1 documentNumber text; $2 articleKey text; $3 asOf date (required, finite).
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
`;

/** Binds: $1 documentNumber, $2 asOf. */
export const GET_DOCUMENT_RELATIONS_SQL = `-- Repository parameterized statement (never concatenate user input).
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
`;
