# Backend API contract — v0.2 (đối chiếu DB artifacts)

Hợp đồng cho Fastify. Đây là thiết kế API, chưa khẳng định có backend chạy thật. JSON UTF-8, field camelCase. Thành công dùng `{ "data": ..., "requestId": "..." }`; list thêm `pagination` cùng cấp. `bigint` ID serialize thành string để không mất chính xác trong JavaScript. Ngày dùng `YYYY-MM-DD`.

## Quy ước dữ liệu

- `asOf` là ngày áp dụng luật, bắt buộc với search/provision và danh sách văn bản. Không tự dùng ngày hiện tại nếu thiếu; trả `400 INVALID_ARGUMENT`. Timeline là lịch sử approved, không có `asOf`.
- Khoảng DB `daterange(..., '[]')` bao gồm cả hai đầu. `effectiveTo` là ngày cuối còn hiệu lực; `null` nghĩa là không có ngày kết thúc. Version chọn nếu `effectiveFrom <= asOf` và (`effectiveTo IS NULL` hoặc `asOf <= effectiveTo`).
- Approval thuộc `document_versions.status`; chỉ `approved` được trả. Schema không có trạng thái duyệt riêng cho document hay provision. Draft/rejected versions không được xuất hiện. Mỗi version là snapshot đầy đủ provisions; provision luôn join theo `document_version_id`, không ghép nội dung giữa version.
- Provision result luôn gồm `documentNumber`, `title` (title của version được chọn), `articleKey`, `heading`, `body`, `sourceUrl` (URL của chính provision), `effectiveFrom`, `effectiveTo`, `versionId`. Không tính giao với khoảng riêng của provision vì schema không có khoảng đó.
- Search DB dùng PostgreSQL `plainto_tsquery('simple')` trên heading/body: full-text theo từ/tokens, không phân biệt hoa thường, phân biệt dấu, các từ cùng query cần khớp. Không hứa substring, phrase search hay tìm title/document number.
- Pagination: `limit` mặc định 20, 1–100; `offset` mặc định 0, >=0. Response `{limit, offset, hasMore}`. Repository đọc thêm một hàng để tính `hasMore`; nhưng SQL search artifact hiện giới hạn `$3 <= 100`, nên không thể đọc 101 hàng khi client yêu cầu 100. Để không báo sai, `hasMore` là `boolean | null`; trả `null` chỉ khi limit=100 cho đến khi query DB cho phép limit 101.
- Tham số lạ/lặp, ngày không hợp lệ, kiểu sai, chuỗi rỗng/ngoài giới hạn bị từ chối. Parameter binding bắt buộc.

## DTO

`ProvisionResult`: `{documentNumber:string,title:string,versionId:string,articleKey:string,heading:string,body:string,sourceUrl:string,effectiveFrom:DateString,effectiveTo:DateString|null}`.

`VersionSummary`: `{versionId:string,title:string,sourceUrl:string,effectiveFrom:DateString,effectiveTo:DateString|null}`. `DocumentSummary`: `{documentNumber:string,title:string,issuingBody:string,issuedOn:DateString,sourceUrl:string,version:VersionSummary}`. Nguồn/interval trong version lấy từ chính version; document-level source không thay thế provision source.

## Routes

### `GET /health`

Liveness, không query DB. `200 {"data":{"status":"ok"},"requestId":"..."}`. Không có readiness endpoint trong scope.

### `GET /search`

Query: `q` bắt buộc (trim, 1–300 ký tự), `asOf` bắt buộc (ngày lịch), `limit?`, `offset?`. Không nhận `documentNumber`: query artifact hiện không hỗ trợ filter này.

`200 {"data":{"asOf":"2026-09-23","items":[ProvisionResult...]},"pagination":{"limit":20,"offset":0,"hasMore":false},"requestId":"..."}`. Không có match thì `items: []`. Search SQL lọc `approved` và containment ngày trên cùng version trước khi đọc provisions.

### `GET /documents/:number`

Path number là document number; decode một lần, trim và giới hạn 1–100 ký tự. Query: `asOf` bắt buộc, `articleKey?` (1–100 ký tự), `limit?`, `offset?`. `articleKey` chọn lookup một provision. Không có `articleKey`: trả metadata document cùng provisions của version approved tại `asOf`.

`200 {"data":{"asOf":"...","document":DocumentSummary,"provisions":[ProvisionResult...]},"pagination":{"limit":20,"offset":0,"hasMore":false},"requestId":"..."}`. Không có document/version approved tại `asOf`: `404 NOT_FOUND`. Provision key không có trong version: `404`. Document/version tồn tại nhưng không có provisions: danh sách rỗng. Các truy vấn document detail/list provisions chưa có artifact SQL; xem conflict test plan.

### `GET /documents/:number/timeline`

Query: `limit?`, `offset?`, không nhận `asOf`. Trả lịch sử versions có status `approved`, quá khứ/tương lai; sort `effectiveFrom` tăng dần rồi version number tăng dần.

`200 {"data":{"documentNumber":"...","title":"...","issuingBody":"...","issuedOn":"YYYY-MM-DD","sourceUrl":"https://...","versions":[VersionSummary...]},"pagination":{...},"requestId":"..."}`. Không có document: 404; document có nhưng chưa có version approved: `versions: []`. Cần query repository mới; schema đủ cột để thực hiện.

### `GET /relations`

Query: `documentNumber` (bắt buộc), `asOf` (bắt buộc, `YYYY-MM-DD`). Tham số lạ hoặc lặp bị từ chối.

200: `{ data: { documentNumber, title, asOf, outgoing: RelationItem[], incoming: RelationItem[] }, requestId }`

`RelationItem = { relationType: "amends"|"repeals"|"guides"|"consolidates", label, documentNumber, title, sourceUrl, effectiveFrom, effectiveTo|null }`

- `outgoing`: văn bản này tác động lên văn bản khác. `incoming`: văn bản khác tác động lên văn bản này.
- `label` là nhãn tiếng Việt theo chiều quan hệ, ví dụ "Bãi bỏ / thay thế" và "Bị bãi bỏ / thay thế bởi".
- Chỉ trả quan hệ có hiệu lực tại `asOf` (hai đầu bao gồm). Văn bản có tồn tại nhưng không có quan hệ thì trả hai mảng rỗng.
- Văn bản không tồn tại trả `NOT_FOUND` (404). Quan hệ thiếu nguồn hoặc sai khoảng hiệu lực trả `DATA_INTEGRITY_ERROR`.
- SQL: `artifacts/db/query-get-document-relations.sql`.

## Lỗi

Lỗi `{ "error":{"code":"INVALID_ARGUMENT|NOT_FOUND|DATA_INTEGRITY_ERROR|DEPENDENCY_UNAVAILABLE|INTERNAL_ERROR","message":"...","details":[...]},"requestId":"..." }`. HTTP mapping: 400 validation, 404 không tìm thấy, 409 integrity, 503 timeout/DB unavailable, 500 lỗi ngoài dự kiến. Không đưa SQL, raw query, body hay stack ra response.
