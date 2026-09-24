# Backend test plan — v0.2

Đây là test plan, chưa phải kết quả chạy: repo hiện mới có contract, chưa có implementation Fastify/MCP. Thiết kế test unit/service, `fastify.inject`, MCP harness và integration PostgreSQL.

## Fixture

Nạp `artifacts/db/schema.sql` và `seed.sql` trong DB test sạch. Fixture là giả, dùng `example.invalid`. Version -101 được duyệt từ 2025-01-01 đến hết 2025-12-31; version -102 bắt đầu 2026-01-01 và không có ngày kết thúc. Hai version cùng document nhưng mỗi version chứa snapshot provisions riêng; -103 draft và -201 rejected không được công khai. `asOf=2025-12-31` phải chọn -101; `asOf=2026-01-01` chỉ chọn -102. URL mỗi provision chứa v1/v2 để phát hiện lấy nhầm nguồn.

## Test Service và Repository

- Ngày hiệu lực: trước from không match; đúng from match; đúng effectiveTo match; ngày sau effectiveTo không match; null effectiveTo vẫn match ngày tương lai.
- Approval: chỉ `document_versions.status='approved'`; draft/rejected không lộ ở search/get/list/timeline. Không yêu cầu cột approval ở document/provision vì DB không có.
- Version integrity: mỗi provision khớp keyword hoặc articleKey chỉ lấy khi join cùng `document_version_id`; không fallback, merge hay bù từ version khác. Draft keyword và rejected keyword trả rỗng.
- Provenance: `sourceUrl` provision lấy từ provisions; interval và versionId đúng version; title từ document_versions. DocumentSummary lấy metadata documents. bigint ID serialize chính xác thành string.
- Search dùng semantics full-text simple: từ query cần khớp theo PostgreSQL; không khẳng định substring hoặc accent-insensitive. Bind q chứa quote/SQL marker không thay đổi query. Query hiện không lọc documentNumber.
- Pagination: default 20/0, limit 1 và offset ổn định, offset quá cuối trả rỗng; SQL order deterministic. Với limit=100 `hasMore=null` đến khi SQL hỗ trợ limit+1.
- Query lỗi: validation chặn asOf thiếu/sai, q trắng, ID trắng, limit 0/101/decimal/string, offset âm, tham số lạ/lặp. Mọi giá trị truyền qua bind parameters.
- Timeline liệt kê approved versions trong quá khứ và tương lai, không lọc theo ngày hiện tại; sort effectiveFrom/version_number. Document không có version approved cho danh sách rỗng nếu document tồn tại.
- Document detail lấy đúng một version approved tại asOf, mọi provision trong response thuộc version đó. Không có document/version/provision cụ thể trả NOT_FOUND theo route semantics.
- Nhiều read trong một service call phải dùng read-only snapshot transaction. Kiểm tra rollback/release khi lỗi/cancel và deadline DB.
- Service fakes: duplicate versions / corrupt mapping dẫn DATA_INTEGRITY_ERROR, không chọn bản đầu hoặc mới nhất; dữ liệu không đủ provenance không được tự dựng URL.

## Fastify `inject`

App factory inject Service stub, gọi ready/close, không mở port.

- `GET /health`: 200 envelope liveness, không gọi DB/service repository.
- `GET /search?q=thuế&asOf=2025-12-31`: 200 với fields yêu cầu, ID/URL/interval đúng; không kết quả vẫn 200 + items rỗng. Ngày cuối included.
- `GET /documents/DEMO-TAX-001?asOf=2026-01-01`: document metadata và provisions cùng version -102. `articleKey=1` trả đúng một provision; key thiếu trả 404.
- `GET /documents/DEMO-TAX-001/timeline`: đủ version approved v1/v2 kể cả version tương lai theo thứ tự; draft không xuất hiện. `asOf` không được chấp nhận ở route này.
- Validation toàn route: thiếu/sai ngày, `2026-02-30`, timestamp, q trắng/quá dài, path rỗng, malformed encoding, query lạ/lặp, limit/offset ngoài miền.
- Map domain errors: 400/404/409/503/500 đúng envelope; inject lỗi driver có bí mật và xác nhận response không rò SQL/stack/credentials.
- Kiểm tra serializer không bỏ `sourceUrl`, `effectiveTo: null`, versionId hoặc issuingBody metadata.
- Lưu ý encoded slash: inject không chứng minh proxy giữ `%2F` trong segment; nếu document numbers có slash thì cần smoke test qua cấu hình deploy thực.

## MCP tests

- Đăng ký bốn tool đúng tên/schema/required fields. `additionalProperties:false`; limit/offset phải JSON integer; ngày validate ngày thực.
- Mỗi handler chỉ gọi Service, không có dependency DB, SQL hoặc query builder. Có thể kiểm tra dependency graph/import boundary.
- Success payload: structuredContent và JSON text tương đương; search/get outputs giữ URL+interval. Errors có `isError=true`, code thống nhất, không có data một phần.
- So sánh search tool với REST search và get tool với document route nhánh articleKey: cùng DTO nghiệp vụ. Timeline cùng service REST; list gọi service trực tiếp vì không có REST list route.
- Body fixture chứa text có vẻ như chỉ dẫn vẫn chỉ là dữ liệu; tool không tự fetch URL hay gọi tool khác.

## Integration PostgreSQL

Chạy trên PostgreSQL 15+ với `btree_gist`. Theo DB test plan: schema rồi seed trên DB test trống; xác minh containment tại ngày effectiveTo, approved filter, không trộn version, FK và EXCLUDE overlap. Chạy đúng query artifacts search/get bằng prepared/bind parameters, không mock để thay kiểm thử SQL. PostgreSQL chưa khả dụng trên môi trường làm tài liệu hiện tại, vì vậy integration còn pending.

Query document detail, timeline, listTaxDocuments phải được thêm vào Repository, review và test sau khi viết. DB schema đủ metadata để map nhưng chưa có SQL artifact hoặc response query contract được verify cho các use case này.

## Conflict và giả định cần xử lý

1. **Search `hasMore` ở limit 100:** query search giới hạn `$3 BETWEEN 1 AND 100`; Repository không thể đọc 101 hàng. API cho phép 1..100. Tạm trả `hasMore: null` chỉ ở limit=100 hoặc DB Agent cần nới bound lên 101/cho phép `limitPlusOne`.
2. **Query còn thiếu:** chỉ có SQL artifact cho search và get provision. `/documents/:number`, `/documents/:number/timeline` và MCP `list_tax_documents` cần query repository mới. Schema có document metadata, approved status ở version, `version_number`, interval và relation metadata; document timeline không cần approved status riêng.
3. **Search contract:** query DB là full-text simple tokens heading/body (phân biệt dấu), không substring; không có documentNumber filter. API/MCP giữ semantics này.
4. **Approval granularity:** DB duyệt version, không document/provision. Tài liệu Backend trước đó giả định duyệt ở nhiều cấp đã được sửa; policy về document chưa từng có version approved là không liệt kê/404.
5. **Interval:** effectiveTo inclusive, thay mọi mô tả backend cũ về khoảng nửa mở. `effectiveFrom/effectiveTo` output chính là interval của version; DB không có interval riêng cho provision.
6. **Mặc định asOf:** API bắt buộc asOf; đây là quyết định hợp đồng để tránh phụ thuộc clock/múi giờ. Nếu sản phẩm muốn ngày mặc định thì cần Coordinator chốt contract.
7. **MCP list output pagination:** chưa có REST route danh sách; không thêm route ngoài yêu cầu. Tool map trực tiếp `listTaxDocuments`.

Không đánh dấu backend hoàn tất trước khi các query Repository còn thiếu được viết, test integration chạy được và conflict `hasMore` được giải quyết rõ.
