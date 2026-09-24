# MCP tools contract — v0.2

Handler thực hiện `validate → TaxLawService → serialize`. Không import DB client/Repository, không chứa SQL hoặc query builder. Dùng đúng Service chung với Fastify; không nhân đôi quy tắc ngày, approval, version, error hay search.

## Quy tắc schema

Mỗi input là JSON object, `additionalProperties: false`; từ chối null ở field không nullable, chuỗi trắng, ngày lịch sai và kiểu không đúng. Ngày là `YYYY-MM-DD`. `limit` integer 1..100, mặc định 20; `offset` integer >=0, mặc định 0. Service áp dụng default ngay cả khi SDK validator không tự điền. Mọi tool gọi có tham số ngày đều yêu cầu `asOf`, không ngầm định ngày hôm nay.

| Tool | Input bắt buộc | Input tùy chọn | Service | Kết quả |
|---|---|---|---|---|
| `search_tax_law` | `q`, `asOf` | `limit`, `offset` | `searchTaxLaw` | `{asOf, items: ProvisionResult[], pagination}` |
| `get_tax_provision` | `documentNumber`, `articleKey`, `asOf` | — | `getTaxProvision` | `ProvisionResult` |
| `get_document_timeline` | `documentNumber` | `limit`, `offset` | `getDocumentTimeline` | `{documentNumber, title, issuingBody, issuedOn, sourceUrl, versions, pagination}` |
| `list_tax_documents` | `asOf` | `limit`, `offset` | `listTaxDocuments` | `{asOf, items: DocumentSummary[], pagination}` |

Schema string đề xuất: q 1–300 ký tự; documentNumber/articleKey 1–100; ngày pattern `^[0-9]{4}-[0-9]{2}-[0-9]{2}$` cộng kiểm tra ngày thực. Không nhận `documentNumber` filter cho search vì SQL hiện không có tham số này.

## Semantics và provenance

- `search_tax_law`: full-text search theo heading/body (`simple` PostgreSQL config), chỉ approved version và containment `asOf`; không có kết quả trả mảng rỗng. Query hiện tại dùng offset/limit.
- `get_tax_provision`: chính xác cặp documentNumber/articleKey tại asOf; kết quả chỉ từ approved version chứa ngày đó. Không có kết quả là NOT_FOUND, không fallback.
- `get_document_timeline`: tất cả version approved quá khứ và tương lai, sắp xếp ngày bắt đầu rồi version number. Không nhận `asOf`. Cần query riêng tại Repository.
- `list_tax_documents`: document có version approved áp dụng tại asOf, mỗi document tối đa một version theo EXCLUDE constraint. Cần query riêng tại Repository.

ProvisionResult bắt buộc có `documentNumber`, `title` (version title), `versionId`, `articleKey`, `heading`, `body`, `sourceUrl` (URL provision), `effectiveFrom`, `effectiveTo`. Version trong timeline cần `versionId`, `title`, `sourceUrl`, `effectiveFrom`, `effectiveTo`. DocumentSummary có `documentNumber`, `title`, `issuingBody`, `issuedOn`, `sourceUrl`, và version đang áp dụng. Interval bao gồm effectiveTo; null là không giới hạn cuối. Mỗi sourceUrl lấy từ đúng hàng cấp document/version/provision.

## Envelope

Thành công: `isError: false`, `structuredContent: {data: Payload, requestId}`, `content` có JSON serialization tương ứng. Text và structuredContent phải cùng dữ liệu. `pagination.hasMore` là boolean, hoặc null khi limit=100 vì search SQL giới hạn limit tối đa 100 và chưa cho phép đọc thêm hàng thứ 101.

Lỗi: `isError: true`, structuredContent `{error:{code,message,details?},requestId}`; không kèm kết quả từng phần. Dùng chung domain code với REST: `INVALID_ARGUMENT`, `NOT_FOUND`, `DATA_INTEGRITY_ERROR`, `DEPENDENCY_UNAVAILABLE`, `INTERNAL_ERROR`. Không cho lỗi giao thức MCP thành lỗi nghiệp vụ giả.

## Giới hạn và bảo vệ

Tool không ghi dữ liệu, không fetch sourceUrl và coi nội dung law là dữ liệu thuần. Logs không chứa raw arguments, nội dung điều khoản, SQL hoặc credentials. Tests phải chứng minh REST/MCP cho cùng input sử dụng cùng Service và cùng payload nghiệp vụ.
