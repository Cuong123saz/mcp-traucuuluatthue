# Tổng hợp review và nghiệm thu MVP

Ngày tổng hợp: 2026-09-24. Vai trò: Coordinator Agent. Phạm vi: tổng hợp bằng chứng đã có, không review lại source hoặc chạy lại test.

## 1. Kết luận nghiệm thu

**Backend/MCP MVP search/get-provision đã nghiệm thu kỹ thuật cơ bản.**

**Frontend MVP đã pass review có điều kiện cho luồng chính**, theo kết luận của Frontend Reviewer: không phát hiện P0/P1 trong phạm vi kiểm tra, còn 2 P2 và 1 P3. Đây không phải pass vô điều kiện cho toàn bộ Frontend; C-08 chưa đạt ở nhánh response lỗi provenance.

**E2E local: PASS — 9 nhóm case browser đều đạt.** Stack thật đã dùng: **Frontend Vite 5180 → REST Backend 3100 → PostgreSQL container 5433**. Không sửa code để E2E pass.

**Mốc tiếp theo: sửa FR-01 để đóng C-08, sau đó review lại Frontend nhỏ.** Chỉ đóng C-08 sau kiểm chứng đạt. Chưa nghiệm thu toàn hệ thống hoặc deploy production.

| Hạng mục | Trạng thái mới nhất | Bằng chứng và giới hạn |
|---|---|---|
| Backend/MCP search/get-provision | Đạt nghiệm thu kỹ thuật cơ bản | Đúng hai use case, phân lớp handler → Service → Repository; R-01…R-04 vẫn mở, non-blocking ở mức cơ bản. |
| PostgreSQL integration | **PostgreSQL integration: PASS** | 8/8 ca integration thật, 0 skipped trên PostgreSQL 16.15 + btree_gist. **No PostgreSQL integration blocker remains** trong phạm vi suite hiện có. |
| Toàn suite Backend có TEST_DATABASE_URL | **106 tests passed, 0 skipped** | 6 test files passed; typecheck pass. Không cộng số test Frontend vào con số này hoặc gọi đây là browser E2E. |
| Frontend MVP | Pass review luồng chính có điều kiện | 4 files, **55 tests passed**, 0 skipped; build PASS gồm vue-tsc và Vite. Test dùng happy-dom/API mock; FR-01…FR-03 còn mở. |
| C-07 / transport | **C-07 closed for MVP** | Frontend dùng REST API qua HTTP, ví dụ GET /search. **Frontend implementation can proceed via REST.** |
| Frontend → Backend → PostgreSQL thật | **E2E local: PASS**, 9/9 nhóm case | Vite :5180 → REST :3100 → PostgreSQL container :5433; DB taxlaw_e2e, không mock/in-memory. Không sửa code để pass. |
| Deploy | **CORS/reverse proxy deploy chưa chốt** | Vite dev/preview proxy không tự đi cùng dist khi deploy. |
| REST detail / timeline / list documents | **Ngoài MVP, chưa nghiệm thu** | Không yêu cầu bổ sung để mở khóa E2E local hiện tại. Detail panel dùng dữ liệu result snapshot, không gọi endpoint detail. |

## 2. Nguồn và cách ưu tiên bằng chứng

- [Implementation review Backend/MCP](implementation-review.md): kiến trúc, phạm vi, phát hiện R-01…R-04 và coverage thiếu.
- [Frontend implementation review](../frontend/frontend-implementation-review.md): kết luận có điều kiện, 55 test/build và FR-01…FR-03.
- [Integration report](integration-report.md): kết quả PostgreSQL chạy thật và suite 106/0.
- [E2E local report](e2e-local-report.md): 9/9 nhóm case trên stack thật; thay trạng thái E2E pending trước đây.
- [Conflict log](../conflicts/conflict-log.md): quyết định REST/C-07, mức nghiệm thu cơ bản, C-08 và các quyết định MVP.

Integration report thay thế trạng thái lịch sử “8 PostgreSQL tests skipped” trong Backend review. Quyết định C-07 closed trong conflict log thay thế ghi chú C-07 còn mở ở hai báo cáo cũ. Không vì thế đóng các phát hiện lỗi hoặc coi coverage đầy đủ.

Chỉ thị hiện tại xác định REST detail/timeline/list documents ngoài MVP. Những câu cũ yêu cầu bàn giao REST detail trước tích hợp không áp dụng cho MVP detail từ snapshot này. C-06/C-01 không được đánh dấu đã giải quyết; chỉ không chặn scope hiện tại. Conflict log được cập nhật trạng thái E2E/C-08 và follow-up, không đóng các conflict ngoài phạm vi.

## 3. Phạm vi đã review

### Backend/MCP

Hai MCP tool search_tax_law/get_tax_provision dùng Service chung; SQL và bind parameters nằm trong Repository. Query lọc approved và asOf, join provision đúng version; output giữ nguồn và khoảng hiệu lực. REST hiện có health/search, chưa có bằng chứng REST get-provision được hiện thực hoặc parity với MCP get.

Tám ca PostgreSQL đã pass bao gồm search approved theo ngày, kết quả rỗng, ẩn draft/rejected, bind SQL marker, get đúng version, effectiveTo inclusive, NOT_FOUND khi điều khoản không thuộc version và date không lệch timezone. Việc tạo EXCLUDE thành công không đồng nghĩa đã test toàn bộ tình huống overlap.

### Frontend

Luồng đã đạt trong review gồm REST GET /search, asOf tường minh, state kết quả tách form/pending request, giữ thứ tự API, không total/sort và pagination true/false/null. Không gọi browser MCP, timeline hoặc list documents.

Detail panel chụp nguyên provision, asOf và requestId từ result snapshot; không gửi request mạng mới. Form B, request B hoặc lỗi B không đổi ngày/nội dung panel A. Đây là nghiệm thu detail từ snapshot trong phạm vi review, không phải bằng chứng gọi get_tax_provision qua REST.

Với payload hợp lệ, nguồn/interval hiển thị đúng; ngày là chuỗi lịch, effectiveTo inclusive/null, versionId giữ string và nội dung render text. Review chưa nghiệm thu đầy đủ browser thật, Tab trap/fallback focus, screen reader, responsive hoặc timezone matrix.

## 4. Phát hiện còn mở và điều kiện đi kèm

**P2 issues remain non-blocking** đối với mốc kỹ thuật cơ bản và E2E local đã đạt; non-blocking không có nghĩa đã sửa hoặc đáp ứng toàn bộ acceptance.

| ID | Mức độ / owner | Nội dung còn mở |
|---|---|---|
| R-01 | P2 / Backend | Mapper có thể biến effectiveTo thiếu/sai thành null không thời hạn; cần regression qua mapper thật. |
| R-02 | P2 / Backend | Cancellation/deadline và race khi chờ connection chưa đầy đủ. |
| R-03 | P2 / Backend | Search thiếu guard nhiều version cùng document/asOf khi dependency trả dữ liệu bất nhất. |
| R-04 | P2 / Backend | Pagination empty/null và miền offset chưa khớp SQL integer. |
| FR-01 / C-08 | P2 / Frontend | Response thiếu nguồn/interval có thể ghi đè snapshot hợp lệ, chuyển success và phát thông báo thành công. C-08 **chưa đạt**; banner cảnh báo không đủ để đóng. |
| FR-02 | P2 / Frontend | Opacity stale/loading làm chữ dưới ngưỡng tương phản; review tính muted khoảng 2.68:1, body khoảng 4.48:1. |
| FR-03 | P3 / Frontend | role=alert cùng live region polite có nguy cơ ngắt/lặp thông báo screen reader; cần thống nhất và kiểm chứng thực. |

Frontend pass ở luồng chính với dữ liệu hợp lệ; nhánh malformed provenance không được ghi là đã pass. FR-01 phải có ca valid A → malformed B giữ A, hiện lỗi/requestId của B và không success announcement cho B. FR-02/FR-03 cần sửa và xác nhận lại accessibility; lượt này không sửa code.

Coverage Backend còn thiếu gồm FK/EXCLUDE overlap, pagination limit=99/order trên dữ liệu đủ lớn, bigint > 2^53, timeout/cancellation/release và thêm biên ngày/get draft-rejected. Đây là ca chưa có, không phải test skipped trong kết quả 106/0.

Các điểm bàn giao Frontend chưa tự được chấp thuận bởi test xanh:

- Vue 3 + Vite thay Nuxt: FE-15 vẫn cần quyết định stack hoặc công việc chuyển đổi riêng; không tự hợp thức hóa trong báo cáo tổng hợp.
- Bốn chuỗi fe.result.previous, fe.dataError.title, fe.dataError.body, fe.copy.failed chưa có trong ui-copy chính thức; Design cần chốt, gồm cách diễn đạt interval mismatch (FE-20).
- C-02/C-03/C-05 tiếp tục ngoài MVP; C-04 giữ null tại limit=100; các quyết định snapshot/nguồn và C-08 không bị nới lỏng.

## 5. E2E local đã nghiệm thu

**E2E local: PASS. 9 nhóm case browser đều đạt**, theo [e2e-local-report.md](e2e-local-report.md) §4. Các nhánh 2b/9a–9c thuộc nhóm tương ứng, không cộng thành số nhóm khác.

| Nhóm | Nội dung đạt |
|---|---|
| 1 | Mở trang lần đầu không auto-search. |
| 2 | Search có kết quả, đúng version/nguồn/interval; biên ngày bổ sung qua API proxy. |
| 3 | Search rỗng; draft/rejected không lộ. |
| 4 | q/asOf invalid bị client chặn, không request; các ca HTTP 400 bổ sung kiểm qua proxy. |
| 5 | Stale giữ kết quả/ngày cũ, không tự search khi sửa form. |
| 6 | Pagination true/false/null dùng snapshot dù form bẩn; Back sau trang thăm dò rỗng không request lại, không total. |
| 7 | Detail dùng result snapshot; không request mới, có focus/inert, Esc đóng và trả focus. |
| 8 | Sửa form asOf không đổi ngày/version trong detail snapshot. |
| 9 | Backend chết → 502, DB mất kết nối → 503, khôi phục → retry đúng input; giữ card/detail A khi B lỗi. |

Stack thật đã dùng: **Frontend Vite 5180 → REST Backend 3100 → PostgreSQL container 5433**. PostgreSQL 16.15, database riêng taxlaw_e2e; schema/seed gốc và fixture phân trang 25 provisions bổ sung chỉ nằm trong DB E2E. Browser Chromium, viewport 1280×720; không dùng API mock hoặc InMemoryTaxLawRepository.

**Không sửa code để E2E pass.** Không sửa seed artifact; dữ liệu bổ sung chỉ nạp DB test. Đây là xác nhận theo báo cáo E2E Agent, không phải lượt chạy lại của Coordinator. Không suy ra tiến trình vẫn đang chạy tại thời điểm đọc báo cáo.

**C-08 vẫn open; không chặn E2E local nhưng cần sửa FR-01.** Các payload quan sát trên stack thật hợp lệ; E2E không chèn response 200 lỗi provenance. Schema/Service giảm nguy cơ trên đường hợp lệ, nhưng không chứng minh mapper hay mọi response trung gian luôn đúng: R-01 vẫn mở. Happy path và lỗi 502/503 pass không kiểm chứng nhánh malformed 200 làm mất snapshot.

## 6. Transport, follow-up và giới hạn

**C-07 đã closed: Frontend dùng REST.** MCP stdio chỉ dùng cho AI Client / Inspector / local tool testing; không triển khai MCP-over-HTTP trong MVP.

| Follow-up | Mức / owner | Việc cần theo dõi |
|---|---|---|
| E2E-01 | P3 / Backend–Docs | Hướng dẫn .env chưa khớp runtime chỉ đọc process.env; sửa hướng dẫn biến môi trường hoặc cơ chế nạp env trong nhiệm vụ riêng. |
| E2E-02 | P3 / Ops | Kiểm tra tiến trình/cổng để không nhầm smoke in-memory 3000/5173 với stack thật 3100/5180. |
| E2E-03 | Ghi nhận UX / Design | Cân nhắc giảm ba thông báo đồng thời khi B lỗi và form khác snapshot; đúng logic nhưng dư. |

**E2E-01/E2E-02/E2E-03 là follow-up**, không đảo kết quả E2E local PASS, chưa được coi đã xử lý.

Chưa nghiệm thu: CORS/reverse proxy deploy; Tab/Shift+Tab trap đầy đủ, screen reader/tương phản; responsive/mobile, timezone matrix, browser ngoài Chromium; loading chậm/timeout client và race nhiều request trên browser thật. Focus/Esc/inert đã quan sát không thay thế toàn bộ accessibility.

REST detail/timeline/list documents **ngoài MVP, chưa nghiệm thu**. Panel snapshot không gọi REST detail; C-06/C-01 không chặn scope này và chưa tự đóng. E2E local PASS không chứng minh deploy production hay toàn hệ thống hoàn thiện.

## 7. Mốc tiếp theo — sửa FR-01, review lại Frontend nhỏ

Owner thực hiện: Frontend; Coordinator/Reviewer kiểm chứng phạm vi nhỏ.

1. Sửa FR-01: payload 200 thiếu/sai nguồn hoặc interval không được commit thành snapshot thành công; giữ snapshot hợp lệ A, hiện lỗi/requestId B, không success announcement cho B. Không âm thầm lọc item để làm trang trông hợp lệ.
2. Bổ sung regression valid A → malformed B cho sourceUrl, effectiveFrom/effectiveTo thiếu/sai và interval lệch asOf; dùng effectiveTo=null hợp lệ làm đối chứng. Card, ngày, pagination và detail vẫn thuộc A.
3. Review lại Frontend nhỏ tập trung adapter → store → thông báo UI, kiểm tra regression và luồng hợp lệ. Chỉ khi có bằng chứng đạt mới đóng C-08/FR-01.
4. FR-02/FR-03, R-01…R-04 và E2E-01…E2E-03 tiếp tục theo dõi riêng; không tự đóng theo lần sửa FR-01.

**Kết luận:** Backend/MCP nghiệm thu kỹ thuật cơ bản; PostgreSQL integration PASS; Frontend pass review luồng chính có điều kiện và E2E local PASS 9/9 nhóm. C-07 closed, C-08 open. Mốc tiếp theo là sửa FR-01 để đóng C-08, sau đó review lại Frontend nhỏ; quyết định đóng chỉ thực hiện sau review đạt. Không tuyên bố toàn hệ thống hoàn thiện.

## 8. Phạm vi cập nhật

Chỉ cập nhật final-summary.md, final-review-summary.md và conflict-log.md. Không sửa source code, tests, DB/Backend/Design/Frontend artifacts hoặc e2e-local-report.md; không chạy lại test/build, khởi động tiến trình hay thay đổi DB. Bằng chứng runtime lấy từ báo cáo, không phải từ lượt cập nhật này.
