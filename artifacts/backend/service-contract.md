# Service và Repository contract — v0.2

Đây là hợp đồng thiết kế theo `artifacts/db` hiện tại. DB chỉ cung cấp hai query nghiệp vụ (search và get provision); document detail, timeline, document list cần query bổ sung tại Repository. Không viết SQL ở route, Service hay MCP handler.

## Luồng và trách nhiệm

`Fastify route / MCP handler → TaxLawService → TaxLawRepository → PostgreSQL`.

- Route/MCP adapter validate transport input, gọi đúng Service, serialize kết quả/lỗi. Adapter không chọn version, truy cập DB hay gọi Repository.
- Service xác thực domain input, truyền rõ `asOf`, điều phối use case, kiểm tra invariant và trả DTO. `asOf` bắt buộc ở các use case phụ thuộc ngày; không có ngày mặc định ngầm.
- Repository quản lý SQL, bind parameters, transaction/snapshot và ánh xạ DB types. Dùng hai file query DB cho search/get, không chép query vào handler. Query timeline/list/detail mới phải đặt trong Repository và review cùng DB owner.
- Approval chỉ ở `document_versions.status`. Provision được công khai khi join đúng approved version có interval chứa asOf. Không giả định cột approval riêng ở documents/provisions.

## Service interface (pseudo-TypeScript)

```ts
searchTaxLaw(input: { q: string; asOf: DateString; limit: number; offset: number }, ctx): Promise<SearchResult>;
getTaxProvision(input: { documentNumber: string; articleKey: string; asOf: DateString }, ctx): Promise<ProvisionResult>;
getDocument(input: { documentNumber: string; asOf: DateString; articleKey?: string; limit: number; offset: number }, ctx): Promise<DocumentResult>;
getDocumentTimeline(input: { documentNumber: string; limit: number; offset: number }, ctx): Promise<TimelineResult>;
listTaxDocuments(input: { asOf: DateString; limit: number; offset: number }, ctx): Promise<DocumentListResult>;
```

Context gồm `requestId`, `AbortSignal`, deadline; clock/log dependencies được inject. Pagination defaults nằm trong validation/config ở Service: limit 20 (1..100), offset 0 (>=0). Ngày phải là ngày lịch thực, không chấp nhận timestamp/infinity. Chuỗi được trim rồi kiểm tra giới hạn.

Kết quả dùng DTO ở `api-contract.md`. `searchTaxLaw` trả `SearchResult={asOf,items:ProvisionResult[],pagination}`; `getTaxProvision` trả một `ProvisionResult`; detail trả `{asOf,document,provisions,pagination}`; timeline trả document metadata và `VersionSummary[]`; danh sách trả `{asOf,items:DocumentSummary[],pagination}`.

## Repository interface (ngữ nghĩa)

```ts
searchTaxLawAt({ q, asOf, limit, offset }, ctx): Promise<ProvisionRow[]>;
findProvisionAt({ documentNumber, articleKey, asOf }, ctx): Promise<ProvisionRow | null>;
findDocumentAt({ documentNumber, asOf }, ctx): Promise<DocumentVersionRow | null>;
listProvisionsAt({ documentVersionId, limitPlusOne, offset }, ctx): Promise<ProvisionRow[]>;
listApprovedVersions({ documentNumber, limitPlusOne, offset }, ctx): Promise<VersionRow[]>;
listDocumentsAt({ asOf, limitPlusOne, offset }, ctx): Promise<DocumentVersionRow[]>;
```

`ProvisionRow` gắn `documentVersionId` và chứa document number, version title, article key, heading/body, provision source URL, effective from/to. `VersionRow` chứa ID, document metadata, version title/source/status/effective interval/version number. `DocumentVersionRow` phải phân biệt document-level metadata với version-level metadata. ID bigint phải map thành string trước khi ra JSON.

Toàn bộ reads trong một lời gọi nhiều truy vấn dùng cùng read-only snapshot transaction, để metadata/provisions/version nhất quán. Lỗi overlap approved phải trả `DATA_INTEGRITY_ERROR`, không chọn `LIMIT 1` để che lỗi. Schema EXCLUDE đã chặn overlap theo document cho các version approved. Provision lookup không tìm fallback version khác. Approved version là complete snapshot; một điều khoản không có trong version thì không được lấy từ version trước.

Search gọi query artifact bằng bind args `(q, asOf, limit, offset)`. SQL tìm full-text heading/body bằng `plainto_tsquery('simple')`; không tự diễn dịch thành substring. `getTaxProvision` gọi query `(documentNumber, articleKey, asOf)`. Hai query trả URL provision và interval version đã chọn.

Pagination: dùng `limit+1` để tính `hasMore` nếu Repository/query cho phép. Query search hiện có CHECK `$3 <= 100`; với limit=100 không thể xin 101 hàng, vì vậy API phải trả `hasMore: null` trong trường hợp đó đến khi DB query được nới giới hạn. Không tính total count.

`getDocument` cần tìm đúng một approved version tại asOf và đọc provisions cùng version. Khi articleKey có mặt, có thể gọi find provision; không có kết quả là NOT_FOUND. Document-level sourceUrl lấy `documents.source_url`, provision sourceUrl lấy `provisions.source_url`; không dùng thay thế cho nhau.

`getDocumentTimeline` liệt kê mọi approved version, gồm tương lai/quá khứ, theo effective_from rồi version_number. `listTaxDocuments` chỉ liệt kê document có đúng một approved version hiệu lực tại asOf; sort document_number. Cả hai cần SQL Repository mới. Schema hiện có đủ title, issuing_body, issued_on, source_url trên documents và version fields trên document_versions, nhưng chưa có approved cột riêng cho document.

## Quy tắc interval và nguồn

Ngày hiệu lực là inclusive cả hai đầu: `effectiveFrom <= asOf <= effectiveTo`, hoặc effectiveTo null. SQL containment qua generated daterange là nguồn quyết định. Output effectiveFrom/effectiveTo sao chép đúng version đã chọn. Không có per-provision interval trong schema nên không lấy giao khoảng. `sourceUrl` phải đúng cấp dữ liệu: provision cho ProvisionResult, version cho VersionSummary, document cho DocumentSummary.

## Error handling, logging, timeout

Domain errors dùng `INVALID_ARGUMENT`, `NOT_FOUND`, `DATA_INTEGRITY_ERROR`, `DEPENDENCY_UNAVAILABLE`, `INTERNAL_ERROR`; REST map 400/404/409/503/500. MCP giữ cùng mã lỗi trong envelope lỗi. Không trả driver error/SQL/stack.

Log allowlist: requestId, route/tool name, duration, error code, result count. Không log query string, body luật, raw MCP arguments, SQL/bindings, credentials hay auth headers. Propagate cancellation/deadline đến Repository; transaction rollback/release trên mọi lỗi. Timeout DB có cấu hình; mặc định đề xuất 5 giây.
