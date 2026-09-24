# Implementation review — MVP search/get-provision

Ngày review: 2026-09-24. Vai trò: Reviewer Agent.

**Kết luận: đúng phạm vi MVP và đúng hướng phân lớp; chưa đủ điều kiện nghiệm thu implementation hoàn chỉnh hoặc MVP tích hợp.** Có lỗi ở invariant/provenance và cancellation, coverage còn thiếu, và toàn bộ integration PostgreSQL đang skip. Không được dùng kết quả unit test xanh để kết luận SQL chạy đúng.

Đã đọc toàn bộ `src/taxlaw/**`, `tests/**` và năm tài liệu được yêu cầu: final-summary, conflict-log, mcp-tools, service-contract, backend-test-plan. Đọc bổ sung schema/API contract để kiểm tra các phát hiện. Quyết định MVP mới nhất trong final-summary/conflict-log ưu tiên hơn phần timeline/list/detail trong contract/test plan cũ.

## 1. Phát hiện cần xử lý

### R-01 — [P2] Repository biến effectiveTo thiếu/sai thành không thời hạn

- Vị trí: `src/taxlaw/repository/pg-tax-law-repository.ts:91`, `src/taxlaw/domain/date.ts:40`, `src/taxlaw/service/tax-law-service.ts:125`.
- `toDateString` trả `null` cho cả null thật, undefined và giá trị không parse được. Mapper đưa trực tiếp kết quả đó vào effectiveTo; Service chấp nhận null là không có ngày kết thúc. Như vậy invariant C-08 bị vượt qua ngay trước khi Service kiểm tra.
- Đã tái hiện bằng fake pool đi qua **PgTaxLawRepository → TaxLawService**: raw effectiveTo lần lượt là `undefined`, `"invalid"`, `"infinity"`; cả ba trả success với `effectiveTo: null`.
- Giới hạn kết luận: schema hiện tại cùng query đúng alias ngăn phần lớn dữ liệu lỗi này phát sinh từ DB bình thường. Đây là lỗi xử lý dữ liệu khuyết/corrupt mapping theo acceptance bắt buộc, chưa phải bằng chứng DB thật đang trả sai.
- Đề nghị: chỉ null DB thật được map thành null; thiếu/sai phải thành DATA_INTEGRITY_ERROR. Bổ sung test qua mapper thật cho cả search/get, gồm null hợp lệ làm đối chứng. Test hiện chỉ làm hỏng effectiveFrom hoặc sourceUrl nên không bắt được lỗi này.

### R-02 — [P2] Cancellation chưa truyền xuyên suốt; thiếu deadline theo contract

- Vị trí: `src/taxlaw/mcp/tools.ts:63,83,105`, `src/taxlaw/domain/dto.ts:38`, `src/taxlaw/repository/pg-tax-law-repository.ts:36–50`.
- MCP callback chỉ dùng input; context tự tạo chỉ chứa requestId. Không truyền tín hiệu hủy request từ MCP xuống Service/Repository. RequestContext cũng không có deadline dù service-contract yêu cầu; timeout DB cố định không thay thế deadline từng request.
- Repository kiểm tra aborted trước `await connect()`, rồi mới gắn listener. Nếu hủy lúc chờ pool, sự kiện đã xảy ra trước khi listener tồn tại và truy vấn vẫn chạy.
- Đã tái hiện bằng fake pool hủy signal trong connect: số lần gọi query sau hủy vẫn là **1**, lời gọi hoàn thành bình thường.
- Đề nghị: truyền signal từ MCP, xử lý trạng thái hủy sau khi lấy connection và release đúng một lần; hiện thực deadline theo contract hoặc xin Coordinator chốt thu hẹp yêu cầu. Thêm test hủy trước/trong connect, trong query, timeout và cleanup. Chưa có các test này trong suite hiện tại.

### R-03 — [P2] Search thiếu guard khi Repository trả nhiều version cho cùng document/asOf

- Vị trí: `src/taxlaw/service/tax-law-service.ts:36–38`; đối chiếu guard get tại dòng 63.
- Search chỉ kiểm tra từng row rồi serialize, không phát hiện hai version khác nhau của cùng document cùng chứa asOf. Get đã từ chối nhiều row; search chưa có invariant tương đương.
- Đã tái hiện bằng stub trả hai row cùng document/article/ngày với versionId `-102` và `-999`: search trả success chứa cả hai version, thay vì DATA_INTEGRITY_ERROR theo yêu cầu service fakes trong backend-test-plan.
- Giới hạn kết luận: EXCLUDE trong schema đúng phải ngăn overlap trên DB thật. Đây là thiếu guard/coverage khi dependency trả dữ liệu bất nhất, không khẳng định query hiện tự trộn version khi schema hợp lệ.
- Đề nghị: kiểm tra version theo document trong các row đọc được, kể cả row thăm dò trước khi cắt trang. Test phải cho phép nhiều article cùng version, nhưng từ chối nhiều version cùng document. Không dùng kiểm tra trên một trang để thay thế EXCLUDE trên toàn DB.

### R-04 — [P2] Validation pagination chưa khớp miền dữ liệu/contract

- Vị trí: `src/taxlaw/service/validation.ts:62,158`, `src/taxlaw/repository/sql.ts:22,36`, `src/taxlaw/mcp/tools.ts:36`.
- `optionalBoundedInteger` coi cả null và chuỗi rỗng là không truyền. REST `limit=`/`offset=` vì vậy dùng default thay vì từ chối chuỗi rỗng theo API contract. MCP có schema chặn null, nhưng gọi Service trực tiếp vẫn chấp nhận null.
- Offset được Service chấp nhận tới Number.MAX_SAFE_INTEGER, trong khi SQL bind `$4::integer`. Ví dụ `2147483648` vượt miền PostgreSQL integer; theo code hiện tại lỗi driver không thuộc nhóm dependency/integrity nên thành INTERNAL_ERROR. Đây là bất nhất xác định qua static review; chưa chạy trường hợp này trên PostgreSQL.
- Đề nghị: default chỉ cho field bị bỏ qua; thống nhất miền offset giữa schema/Service/SQL với owner, không tự sửa DB artifact trong lượt review. Thêm test empty/null và biên miền SQL. Không cần mở rộng chức năng để sửa validation.

Không phát hiện lỗi P0/P1 đã chứng minh trên đường dữ liệu hợp lệ buộc Reviewer phải sửa khẩn cấp. Giữ nguyên source và tests; các P2 trên cần được owner xử lý trước khi tuyên bố đạt đầy đủ acceptance.

## 2. Phạm vi và ranh giới kiến trúc

| Hạng mục | Kết luận và bằng chứng |
|---|---|
| Search/get-provision | Có `searchTaxLaw`/`getTaxProvision`, hai MCP tool tương ứng. REST chỉ có `/health` và `/search`. Không tự tạo REST provision/detail envelope. |
| Timeline/list/document detail | Không có implementation, stub hay feature flag trong phạm vi source đã review. MCP registration test xác nhận đúng hai tool; HTTP test xác nhận `/documents`, document detail và timeline đều 404. Các tên xuất hiện trong comment/README để ghi ngoài phạm vi không phải implementation lố. |
| MCP handler | `mcp/tools.ts` chỉ schema → Service → serialize/log; không SQL, DB client, Repository import hay query builder. Không fetch sourceUrl/call tool khác. |
| Composition root | `mcp/server.ts` có import pool và concrete Repository để lắp dependency. Đây là composition root, **không phải handler truy cập DB**. HTTP server có cách lắp tương tự. |
| Service → Repository | Service import interface, validate input, tính readLimit/hasMore, map DTO và kiểm tra invariant. Repository giữ SQL/bind args, mapping driver và release connection. Approval/asOf selection nằm trong SQL đúng contract; comment nói mọi rule đều ở Service là diễn đạt quá rộng. |
| Query/snapshot | Hai query dùng bind parameters, join provision đúng version, lọc approved/asOf, lấy title version và URL provision. Mỗi use case là một statement; không cần ép thêm transaction nhiều read. Chưa có use case nhiều read để nghiệm thu rollback/snapshot loại đó. |
| Repository interface | `findProvisionAt` trả mảng thay vì row/null để Service phát hiện duplicate; thay đổi nội bộ hợp lý, không làm đổi DTO MCP. |
| DTO/pagination | Không total/sort/filter documentNumber/snippet/field ngoài MVP. Defaults 20/0; limit <100 đọc thêm một row; limit=100 đọc 100 và luôn giữ hasMore=null. Có lỗi validation riêng tại R-04. |

REST/MCP dùng cùng class Service và có test parity cho **search**. Không có REST get-provision nên không được ghi đã kiểm chứng parity get với REST detail; nhánh đó đang hoãn đúng C-06.

## 3. Kết quả chạy và coverage acceptance

Đã chạy trong lượt review:

- `npm test`: **5 test files passed, 1 skipped; 98 tests passed, 8 skipped**.
- `npm run typecheck`: **pass**.
- Probe đọc code runtime bằng fake pool/stub cho R-01/R-02/R-03: tái hiện được như mô tả. Không ghi probe thành test đã bổ sung vào suite. Lần thử probe qua tsx gặp lỗi môi trường `uv_os_get_passwd ENOMEM`; đã chạy lại thành công bằng bộ chuyển TypeScript tích hợp của Node. Không ảnh hưởng kết quả Vitest/typecheck nêu trên.

| Acceptance | Bằng chứng hiện có | Phần còn thiếu |
|---|---|---|
| asOf bắt buộc/ngày lịch thật | Service search/get, HTTP search và MCP có test thiếu/sai ngày; không default hôm nay | Chưa đủ ma trận null/type/leap-year và get MCP invalid input |
| Approved, biên from/to inclusive, null end | Service fixtures kiểm tra ngày đầu/cuối/ngày kế tiếp/tương lai; MCP/HTTP có một phần | SQL thật chưa chạy; fake tự hiện thực visibility nên không chứng minh DB |
| Không fallback/trộn version | Removed article → NOT_FOUND/rỗng; URL/body v1/v2; get duplicate → DATA_INTEGRITY_ERROR | Search duplicate thiếu và lỗi R-03 |
| Provenance, mapping | Assert DTO/title/URL/versionId/effectiveTo:null; từ chối source rỗng/from sai | R-01; chưa test ID lớn hơn 2^53 qua mapper thật, thiếu versionId và lỗi provenance xuyên transport |
| Pagination true/false/null | Có default, limit=1, limit=100, offset quá cuối | **Thiếu limit=99**, trang rỗng limit=100, dữ liệu đủ lớn để chứng minh cắt 99/100 và offset/order trên DB thật; R-04 |
| MCP envelope/schema | Hai tool, required/additionalProperties, limit decimal, error không partial, search text=structuredContent | Chưa đủ null/string-number/bounds của cả hai tool; chưa assert text=structured cho get và error |
| SQL/boundary | SQL parity với artifacts pass; regex kiểm tra import/SQL ở handler/Service pass | Regex không phải dependency-graph đầy đủ; SQL bind runtime chỉ có ca integration đang skip |
| Errors/logging/cancellation | Có HTTP 400/404/409/503/500 và MCP error sanitization qua fake | Chưa test translator của PgRepository, release/error/abort/deadline hay capture log allowlist; R-02 |
| Law body là dữ liệu thuần | Code chỉ serialize body, không fetch URL | Test tên “looks like instructions” dùng body luật bình thường, chưa có fixture chứa chỉ dẫn giả và assertion không side effect |
| Cổng UI/snapshot/modal | Không có test UI trong `tests/**` | Chưa nghiệm thu A→B loading/error→detail dùng ngày A, race/close panel, pagination Back, keyboard/modal, lỗi provenance trên UI |

**Coverage chưa đầy đủ**, kể cả giả sử bật PostgreSQL và tám ca hiện có đều pass. Yêu cầu đăng ký bốn MCP tool, timeline/list/toàn văn bản và parity REST detail trong test plan cũ không phải acceptance của MVP hiện tại; không đề nghị thêm chúng để làm xanh checklist cũ.

## 4. PostgreSQL và tích hợp chưa nghiệm thu

`tests/integration-postgres.test.ts:22` dùng `describe.skipIf(!connectionString)` với TEST_DATABASE_URL. Lượt chạy này cả tám ca đều skip do không có cấu hình đó; chưa chứng minh PostgreSQL đã khởi động, schema/seed nạp thành công hay query chạy được. Không suy diễn rằng môi trường chắc chắn không thể cung cấp PostgreSQL.

Chưa nghiệm thu runtime: full-text simple/ranking, bind q có SQL marker, approved filter, containment đúng effectiveTo, source/version mapping, no-fallback và DATE parser. Những mục này mới có static evidence/fake tests và integration chưa chạy.

Ngoài tám ca hiện có, còn thiếu integration cho FK/EXCLUDE overlap, pagination/order ổn định và các biên, bigint lớn, timeout/cancellation/connection release, đầy đủ biên ngày và get draft/rejected. Không được ghi các mục thiếu là “đang skip”: **chưa có ca test** khác với **có ca nhưng chưa chạy**.

Integration setup xóa rồi tạo lại schema public (`integration-postgres.test.ts:38`); chỉ cấu hình DB test dùng riêng, có thể bỏ đi. Chưa chạy thao tác này trong review.

**C-07 vẫn mở:** MCP stdio entrypoint và HTTP search không chứng minh Frontend đã có đường gọi cả search/get. Chưa có bằng chứng cấu hình transport FE và kiểm thử search → card → get với identity/asOf snapshot. **C-06/C-01 không tự đóng**, nhưng không chặn viết hai MCP use case. C-02/C-03/C-05 tiếp tục hoãn ngoài MVP.

## 5. Bước tiếp theo

1. Backend xử lý R-01…R-04 và bổ sung test hồi quy qua Repository thật với fake pool; hoàn thiện các acceptance thiếu, ưu tiên provenance, limit=99 và cancellation.
2. Chạy và bổ sung integration trên PostgreSQL 15+ có btree_gist trong DB test riêng; lưu kết quả thực, không chấp nhận skip tại cổng nghiệm thu.
3. Owner transport/Coordinator đóng C-07 rồi kiểm thử FE search→get, snapshot/race/modal. Giữ timeline/list/toàn văn bản ngoài MVP.

Lượt review chỉ tạo `artifacts/coordinator/implementation-review.md`; không sửa source, tests hay artifacts/db, backend, design, frontend. Workspace không có Git repository nên không có git diff để chứng minh trạng thái trước/sau; danh sách thay đổi trên phản ánh các thao tác ghi do Reviewer thực hiện.
