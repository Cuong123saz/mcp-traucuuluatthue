# Kế hoạch kiểm thử PostgreSQL

## Phạm vi và hợp đồng

- PostgreSQL 15 trở lên; extension `btree_gist` phải khả dụng và tài khoản migration có quyền cài đặt. `schema.sql` là migration khởi tạo chạy một lần, không phải script đồng bộ schema đang tồn tại.
- Mỗi version là **snapshot đầy đủ**. Mọi điều khoản kế thừa trạng thái duyệt và khoảng hiệu lực của version. Khi chỉ một điều thay đổi, ingestion phải tạo snapshot mới gồm cả các điều giữ nguyên. Không tìm điều thiếu từ version cũ.
- Khoảng hiệu lực là `[effectiveFrom, effectiveTo]`: cả ngày bắt đầu và ngày kết thúc đều được tính; `NULL` là chưa có ngày kết thúc. PostgreSQL chuẩn hóa daterange ngày rời rạc thành `[from, day-after-to)`, vì vậy containment vẫn nhận ngày `effective_to`.
- `asOf` là ngày áp dụng pháp luật, không phải thời điểm hệ thống biết thông tin. Approval dùng trạng thái hiện tại; đây chưa phải mô hình lịch sử hai chiều thời gian.
- Đơn vị `approved` là toàn bộ version. Service phải kiểm tra tính đầy đủ, nguồn và nội dung trước khi duyệt; schema không chứng minh nội dung pháp lý đúng hay URL tồn tại. Không chỉnh sửa nội dung/snapshot đã duyệt trực tiếp bằng tài khoản ứng dụng. Quyền ghi và quy trình hiệu chỉnh lịch sử cần được triển khai khi tích hợp.
- `sourceUrl` của mỗi kết quả lấy từ chính điều khoản trong version đã chọn; title và khoảng hiệu lực lấy từ cùng version. URL cấp version và ingestion lưu dấu vết nguồn. FK kép ngăn gắn snapshot của văn bản khác.
- Search dùng `simple` full-text trên heading/body, không phân biệt hoa thường nhưng có phân biệt dấu; nhiều từ có nghĩa AND, không tìm chuỗi con hay tự bỏ dấu. Không tìm theo title/documentNumber trong bản này.
- `get` nhận `(documentNumber, articleKey, asOf)`. Search nhận `(keyword, asOf, limit, offset)`. Tất cả dùng bind parameters; service kiểm tra ngày hữu hạn, chuỗi không rỗng, limit 1..100, offset >= 0. Không tự thay ngày thiếu bằng ngày hôm nay.
- ID là bigint: backend nên serialize thành chuỗi khi đi qua JavaScript để tránh mất độ chính xác. Ngày trả dạng `YYYY-MM-DD`, `effectiveTo` giữ `null`. Hai query dùng cùng tên trường camelCase.
- Quan hệ giữa văn bản chỉ là metadata, không tự hợp nhất nội dung và không được trả công khai khi chưa bổ sung quy trình duyệt riêng.

## Khởi tạo và chạy query thật

Chỉ chạy trên database test trống, tuyệt đối không nạp seed vào production. Seed là dữ liệu giả, URL `example.invalid` và hash chỉ là fixture.

```powershell
psql -X --set=ON_ERROR_STOP=1 --dbname=tax_law_test --file=artifacts/db/schema.sql
psql -X --set=ON_ERROR_STOP=1 --dbname=tax_law_test --file=artifacts/db/seed.sql

# Đọc trực tiếp các query repository, không chép lại logic thành query test khác.
$searchSql = Get-Content -Raw artifacts/db/query-search-tax-law.sql
$getSql = Get-Content -Raw artifacts/db/query-get-tax-provision.sql
$testSql = @"
PREPARE search_tax_law(text,date,integer,integer) AS
$searchSql
PREPARE get_tax_provision(text,text,date) AS
$getSql
EXECUTE search_tax_law('thuế','2025-12-31',100,0);
EXECUTE search_tax_law('thuế','2026-01-01',100,0);
EXECUTE search_tax_law('oldonly','2026-01-01',100,0);
EXECUTE search_tax_law('draftonly','2026-01-01',100,0);
EXECUTE search_tax_law('rejectedonly','2026-01-01',100,0);
EXECUTE get_tax_provision('DEMO-TAX-001','1','2025-12-31');
EXECUTE get_tax_provision('DEMO-TAX-001','1','2026-01-01');
EXECUTE get_tax_provision('DEMO-TAX-001','3','2026-01-01');
"@
$testSql | psql -X --set=ON_ERROR_STOP=1 --dbname=tax_law_test
```

Kết quả lần lượt: search trả ID `-1001, -1003` (thứ tự theo rank), `-1004`, rỗng, rỗng, rỗng; get trả `-1001`, `-1004`, rỗng. Phải kiểm tra giá trị, không chỉ exit code.

## Ma trận kiểm thử query

| Ca | Thao tác | Kỳ vọng |
|---|---|---|
| Trước hiệu lực | Search `thuế` ngày 2024-12-31; get điều 1 cùng ngày | Không có hàng |
| Đầu kỳ cũ | Search/get ngày 2025-01-01 | Chỉ version -101 |
| Cuối kỳ cũ (bao gồm) | Get điều 1 ngày 2025-12-31 | Body chứa oldonly, title bản cũ, URL v1, [2025-01-01, 2025-12-31] |
| Ngày sau cuối kỳ cũ / đầu kỳ mới | Get điều 1 ngày 2026-01-01 | Chỉ -102; body newonly, title bản mới, URL v2, [2026-01-01, null) |
| Không giới hạn cuối | Get điều 1 ngày 2099-01-01 | Version -102 |
| Không trộn | Search oldonly/removedonly ngày 2026-01-01 | Rỗng, không quay lại version -101 |
| Điều không đổi | Get điều 2 trước/sau 2026-01-01 | ID -1002/-1005; mỗi hàng thuộc đúng version và nguồn |
| Điều đã bỏ | Get điều 3 ngày 2026-01-01 | Rỗng |
| Chưa duyệt | Search draftonly/rejectedonly ngày 2026-01-01 | Rỗng dù interval khớp |
| Get chỉ approved | Get DEMO-TAX-002 điều 1 ngày 2026-01-01 | Rỗng |
| Thiếu đối tượng | Get documentNumber/articleKey không tồn tại | Rỗng |
| Đầu vào null | NULL asOf ở cả hai query, NULL/blank keyword ở search | Rỗng; service phải báo lỗi validation |
| Đầu vào sai | Ngày vô hiệu, infinity, limit ngoài 1..100, offset âm | Service từ chối; cast/limit âm có thể gây lỗi SQL; infinity không trả hàng |
| Phân trang | Search thuế ngày 2025-12-31, limit 1 với offset 0/1/2 | Hai hàng khác nhau rồi rỗng; ghép bằng thứ tự query toàn bộ |
| SQL injection | Bind keyword chứa dấu nháy và chuỗi SQL | Chỉ là dữ liệu; bảng nguyên vẹn |
| Nguồn và interval | Với mọi hàng search/get | sourceUrl không rỗng; effectiveFrom <= asOf <= effectiveTo nếu end khác null |

## Ràng buộc dữ liệu và đồng thời

Chạy từng ca lỗi trong transaction riêng rồi `ROLLBACK`; dùng SQLSTATE để xác nhận lỗi mong đợi thay vì coi mọi lỗi là thành công.

| Ca | Thay đổi thử nghiệm | Kỳ vọng |
|---|---|---|
| Approved overlap | Chuyển version -103 thành approved, điền approved_at/by | `23P01` do chồng version -102 |
| Khoảng liền kề | Version -101 kết thúc 2025-12-31, -102 bắt đầu 2026-01-01 | Nạp thành công, không overlap |
| Draft overlap | Version -103 trong seed | Được lưu, không lộ qua lookup |
| Khoảng sai | effective_to bằng/trước effective_from | Bị từ chối bởi CHECK hoặc range constructor |
| Metadata duyệt | Approved nhưng thiếu approved_at/by | `23514` |
| Điều trùng | Thêm article_key 1 vào version -102 | `23505` |
| Version trùng | Thêm version_number 2 cho document -1 | `23505` |
| Khác version | article_key 1 ở -101 và -102 | Được lưu |
| FK thiếu | Thêm provision với version không tồn tại | `23503` |
| Sai nguồn văn bản | Đổi ingestion_snapshot_id của -102 thành -21 | `23503` |
| Nguồn trống | source_url NULL hoặc chuỗi rỗng | `23502` hoặc `23514` |
| Xóa cha | Xóa version/document đang có con | `23503`; không cascade mất lịch sử |
| Hai phiên duyệt | Hai transaction cùng thêm approved version chồng nhau cho một document mới | Transaction thứ hai chờ; sau transaction đầu commit, một transaction bị `23P01` |

Ví dụ ca overlap, mong lỗi `23P01` (chạy riêng với chế độ hiển thị lỗi verbose):

```sql
BEGIN;
UPDATE document_versions
SET status = 'approved', approved_at = now(), approved_by = 'test-reviewer'
WHERE id = -103;
ROLLBACK;
```

Kiểm tra hiệu năng bằng `EXPLAIN (ANALYZE, BUFFERS) EXECUTE search_tax_law(...)` sau khi nạp lượng dữ liệu đại diện và `ANALYZE`. Không yêu cầu index scan trên seed nhỏ. Kiểm tra GIN cho tìm từ, GiST cho approved interval, unique index cho version/article. Nếu cần nhất quán qua nhiều trang trong lúc cập nhật, backend phải dùng cùng snapshot transaction; offset không bảo đảm điều đó qua nhiều request độc lập.

## Tình trạng kiểm chứng

- Đã rà soát tĩnh năm artifact, FK, khoảng hiệu lực, điều kiện approved và join theo version ID.
- Chưa thực thi migration/query trên PostgreSQL: môi trường hiện không có `psql`/`postgres` trong PATH, Docker daemon không chạy. Không được coi các ca ở trên là đã pass; cần chạy chúng trước khi tích hợp.
