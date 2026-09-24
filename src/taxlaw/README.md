# Backend MVP — search_tax_law / get_tax_provision

Implementation of the MVP scope the Coordinator approved in
[final-summary.md](../../artifacts/coordinator/final-summary.md): full-text
search and single-provision lookup, over approved document versions, at an
explicit `asOf` date.

## Layering

```
Fastify route  ─┐
                ├─> TaxLawService ─> TaxLawRepository ─> PostgreSQL
MCP tool handler┘
```

| Layer | File | Allowed to do |
|---|---|---|
| Transport (REST) | `http/app.ts` | validate query shape, call Service, serialize |
| Transport (MCP) | `mcp/tools.ts` | validate tool schema, call Service, serialize |
| Business | `service/tax-law-service.ts`, `service/validation.ts` | domain validation, `asOf`, pagination arithmetic, provenance invariants, error codes |
| Data | `repository/pg-tax-law-repository.ts`, `repository/sql.ts` | SQL text, binding, connections, driver-error translation |

Rules enforced by tests, not just by convention:

- SQL exists only in `repository/sql.ts`, copied verbatim from
  `artifacts/db/*.sql`. `tests/sql-artifact-parity.test.ts` fails on drift and
  also fails if SQL keywords or a `pg` import appear in the service or either
  transport.
- Both transports share one `TaxLawService` instance type, so date, approval,
  version and error rules cannot diverge; a test compares the REST and MCP
  payloads for the same input.

## Business rules implemented

- `asOf` is required everywhere and is never defaulted to today.
- Only `document_versions.status = 'approved'` is visible. Draft and rejected
  content never appears.
- The effective interval is inclusive at both ends; `effectiveTo: null` means
  no end date and is always serialized as an explicit `null`.
- One version per answer. No fallback to another version or another date, and
  no merging of content across versions.
- Every result carries `sourceUrl` (the provision's own URL), `effectiveFrom`,
  `effectiveTo` and `versionId`. A row missing any of these is a
  `DATA_INTEGRITY_ERROR`, never a success item.
- `pagination.hasMore` is `boolean | null`. The repository reads `limit + 1`
  rows to decide it; at `limit = 100` the search SQL cannot be asked for a
  101st row, so `hasMore` is `null` — "unknown", not "no more pages".
- Error responses carry only `{code, message, details?}`. SQL, bindings,
  driver messages and stacks stop at the repository boundary.
- Logs are an allowlist (`requestId`, operation, duration, error code, result
  count). Query text, law text and raw tool arguments are never logged.

## Not implemented (out of MVP scope)

`get_document_timeline`, `list_tax_documents`, `GET /documents/:number` and
`GET /documents/:number/timeline` are absent — not stubbed, not behind a flag —
per conflict-log A-11 and the unresolved conflicts C-01, C-02, C-03, C-05
(missing SQL artifacts) and C-06 (REST detail envelope not settled).

## Running

```bash
cp .env.example .env          # set DATABASE_URL
npm install
npm run start:api             # REST on http://127.0.0.1:3000
npm run start:mcp             # MCP over stdio
npm test                      # unit / route / MCP tests, no database needed
TEST_DATABASE_URL=... npm run test:integration   # real SQL, disposable DB only
```
