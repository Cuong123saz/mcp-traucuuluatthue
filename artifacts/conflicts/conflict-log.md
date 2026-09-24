# Conflict Log — MVP cross-layer review

Ngày rà soát: 2026-09-24. Phạm vi: DB ↔ Backend ↔ Design ↔ Frontend, theo chỉ thị MVP mới nhất. Giữ ID C-01…C-05 từ lượt 2026-09-23; cập nhật mức độ theo phạm vi, không coi các vấn đề cũ đã được sửa.

**MVP search/get-provision workflow can proceed.**

**C-07 closed for MVP.**

**Frontend implementation can proceed via REST.**

Quyết định transport ngày 2026-09-24 theo chỉ thị người dùng: Frontend MVP dùng REST API, tức Frontend gọi backend qua HTTP, ví dụ GET /search. MCP stdio chỉ dùng cho AI Client / Inspector / local tool testing. Không triển khai MCP-over-HTTP trong MVP; để phase sau nếu cần browser hoặc remote agent gọi MCP qua HTTP.

Backend/MCP search/get-provision đã nghiệm thu kỹ thuật cơ bản. **PostgreSQL integration: PASS. 106 tests passed, 0 skipped. No PostgreSQL integration blocker remains. P2 issues remain non-blocking.** Kết quả theo integration-report.md; không chạy lại test trong lượt chốt transport này. R-01…R-04 vẫn mở, không tự coi đã sửa.

C-07 đóng về lựa chọn transport. E2E local REST search → detail snapshot nay đã PASS theo cập nhật bên dưới; không xác nhận REST get-provision tồn tại. C-06/C-01 liên quan REST detail giữ nguyên ngoài scope MVP.

## Cập nhật sau E2E local — 2026-09-24

- **E2E local: PASS — 9 nhóm case browser đều đạt.** Stack thật: **Frontend Vite 5180 → REST Backend 3100 → PostgreSQL container 5433**, DB taxlaw_e2e. Theo [e2e-local-report.md](../coordinator/e2e-local-report.md), không mock/in-memory và **không sửa code để E2E pass**.
- **C-07 closed for MVP**: Frontend REST; MCP stdio cho AI Client/Inspector/local testing, không MCP-over-HTTP trong MVP.
- **C-08 vẫn open**, không chặn E2E local với payload hợp lệ nhưng cần sửa FR-01. E2E không kiểm thử response 200 lỗi provenance; PASS không đóng C-08 hoặc phủ định R-01.
- Điều kiện đóng C-08: sửa FR-01; regression valid A → malformed B giữ snapshot A, lỗi/requestId thuộc B, không success announcement B; phân biệt effectiveTo=null hợp lệ với thiếu/sai; sau đó review lại Frontend nhỏ.
- **Mốc tiếp theo: sửa FR-01 để đóng C-08, sau đó review lại Frontend nhỏ**. Chỉ chuyển closed sau bằng chứng review đạt.
- **E2E-01/E2E-02/E2E-03 là follow-up**: E2E-01 (P3, Backend/Docs) hướng dẫn env; E2E-02 (P3, Ops) tránh nhầm cổng smoke in-memory; E2E-03 (UX, Design) giảm thông báo dư. Không phải blocker, chưa đóng.
- REST detail/timeline/list documents ngoài MVP. Detail dùng result snapshot, không gọi mạng mới; yêu cầu cũ bổ sung REST detail trước E2E không áp dụng scope này. C-06/C-01 chưa giải quyết nhưng không chặn luồng snapshot đã test.
- R-01…R-04, FR-01…FR-03 giữ trạng thái mở. Deploy CORS/reverse proxy, accessibility đầy đủ, responsive/timezone và race/timeout browser chưa nghiệm thu. Không tuyên bố toàn hệ thống hoàn thiện.
- Cập nhật này thay nhận định E2E pending bên dưới trong phạm vi local đã test, không thay trạng thái deploy/coverage thiếu. Không chạy lại E2E trong lượt Coordinator.

## 1. Quy ước phân loại

- **Blocking**: ngăn hiện thực/tích hợp đúng một nhánh được nêu rõ; phải đóng trước khi nghiệm thu nhánh đó.
- **Non-blocking**: không ngăn MVP search/get theo hợp đồng MCP; có thể vẫn chặn chức năng ngoài MVP.
- **Assumption accepted for MVP**: Coordinator chấp nhận cách diễn giải/tương tác cụ thể, không thêm field hoặc thay API. Chỉ có giá trị trong phạm vi MVP này.
- Rà soát tài liệu không phải kiểm thử runtime. Không ghi test pass khi mới có test plan.

## 2. Blocking

### C-06 — Design coi REST detail đã ổn trong khi envelope/phụ thuộc chưa được chốt

- Phân loại: **Blocking cho nhánh REST detail**, không chặn hợp đồng MCP get_tax_provision.
- Bằng chứng: design/design-spec.md:19-20 gọi cả hai luồng là “hợp đồng đã ổn”; design/interaction-flow.md:71-76 gọi REST là tương đương. backend/api-contract.md:35-37 chỉ công bố envelope document/provisions/pagination chung; backend/service-contract.md:19,26,47 cũng mô tả getDocument trả metadata. MCP trả trực tiếp ProvisionResult (backend/mcp-tools.md:12,25,29). frontend/integration-notes.md:60-71 và FE-01 đã phát hiện khác biệt.
- Ảnh hưởng: không được lấy data REST làm ProvisionResult hoặc cho rằng nhánh articleKey chắc chắn không cần query metadata C-01. Cùng DTO nghiệp vụ không có nghĩa cùng envelope.
- Owner: Backend; Design/Frontend đồng bộ sau khi chốt.
- Điều kiện đóng: Backend xác nhận envelope nhánh articleKey. Nếu giữ contract chung, bổ sung query metadata cần thiết và test đúng một provision theo identity; nếu đổi payload phải cập nhật contract bởi Backend. Không tự tạo endpoint /provisions, không lấy provisions[0] mù quáng, không trộn title/source từ DocumentSummary vào provision.
- Frontend MVP đã chọn REST theo C-07. C-06 vẫn cần đóng trước nghiệm thu nhánh REST detail; không tự fallback sang MCP stdio hoặc dựng MCP-over-HTTP. Backend cần bàn giao contract/endpoint HTTP cho use case này, không suy ra từ việc MCP get_tax_provision đã pass.

## 2a. Conflict đã đóng cho MVP

### C-07 — Transport Frontend: REST API

- Trạng thái: **C-07 closed for MVP.** Đóng theo quyết định người dùng ngày 2026-09-24.
- **Frontend implementation can proceed via REST.** REST API là Frontend gọi backend qua HTTP, ví dụ GET /search; không phải gọi MCP qua HTTP.
- MCP stdio chỉ dùng cho AI Client / Inspector / local tool testing.
- Không triển khai MCP-over-HTTP trong MVP. MCP-over-HTTP để phase sau nếu cần browser hoặc remote agent gọi MCP qua HTTP.
- Quyết định này thay tiêu chí đóng C-07 cũ vốn gộp lựa chọn transport với nghiệm thu end-to-end. Cấu hình môi trường, bàn giao endpoint REST và kiểm thử search → card → get-provision vẫn là công việc triển khai/nghiệm thu, không phải lựa chọn transport còn bỏ ngỏ.
- Owner triển khai: Backend bàn giao REST contract/endpoint và cấu hình cần thiết; Frontend dùng HTTP adapter; Coordinator theo dõi nghiệm thu. C-06/C-01 liên quan REST detail không tự đóng.
- Giữ quy tắc detail lấy identity/asOf từ result snapshot, không current form. Không có bằng chứng mới rằng endpoint REST get-provision hoặc toàn hệ thống đã hoàn thiện.

## 3. Non-blocking / tồn đọng ngoài MVP

| ID | Bằng chứng và ảnh hưởng | Owner / điều kiện đóng |
|---|---|---|
| C-01 | DB chỉ có hai query search/get; backend/service-contract.md:33-34 cần findDocumentAt/listProvisionsAt. Thiếu query cho document detail/toàn văn bản; schema đủ cột. **Non-blocking cho MVP MCP**, nhưng metadata REST articleKey có thể phụ thuộc, xem C-06. | DB + Backend: query approved version tại asOf, metadata/provisions cùng snapshot; kiểm thử nguồn, interval, pagination, NOT_FOUND. Không ép làm toàn văn bản cho MVP. |
| C-02 | Thiếu query listApprovedVersions (backend/service-contract.md:35,49). **Non-blocking cho MVP**, blocking cho timeline khi mở lại phạm vi. | DB + Backend: chỉ approved, giữ URL/interval từng version, sort effective_from/version_number; test phân trang. Timeline không nhận asOf theo thiết kế lịch sử, không phải lỗi bỏ lọc ngày. |
| C-03 | Thiếu query listDocumentsAt (backend/service-contract.md:36,49). **Non-blocking cho MVP**, blocking cho list documents sau này. | DB + Backend: query lọc approved và containment asOf; tối đa một version/document; test metadata/nguồn/interval. |
| C-04 | Search SQL dòng 11 giới hạn $3 trong 1..100, không đọc được 101; Backend đã công bố hasMore=null tại limit=100. Design/FE xử lý đủ true/false/null. **Non-blocking**, không đổi schema/contract để né null. | Backend: client limit 1..99 thì đọc limit+1, cắt về client limit; limit=100 bind 100 và trả null. Phân biệt limit SQL với limit trả client. Test 1/99/100 và trang rỗng; DB tham gia nếu đổi query. |
| C-05 | backend/api-contract.md:43 và backend/backend-test-plan.md:18 cho timeline versions=[]; test-plan:55 lại ghi không liệt kê/404 khi chưa có approved version. **Non-blocking cho MVP**, policy timeline vẫn chưa đóng. | Backend + Coordinator: chọn một policy và đồng bộ query/tests trước khi làm timeline. Không cần cột approval riêng trên documents. |
| C-08 / FE-03 | design-spec.md:96 cấm render card thiếu sourceUrl/effectiveFrom; component-guidelines.md:113-118 yêu cầu giữ card cảnh báo; Frontend tạm theo guideline. **Non-blocking với payload hợp lệ**, nhưng đây là mâu thuẫn có thật. | Design + Frontend: thống nhất đường dữ liệu lỗi. Coordinator không chấp nhận card thiếu nguồn/interval như kết quả thành công hợp lệ. Phải hiện lỗi dữ liệu rõ, không tạo link/badge hợp lệ giả; giữ snapshot hợp lệ trước nếu có. Không âm thầm bỏ item rồi trình bày như trang thành công. effectiveTo=null hợp lệ; thiếu field effectiveTo không tương đương null. |
| C-09 | design/component-guidelines.md:233-238 dùng queryState đã submit cho card/detail; interaction-flow.md:22 cập nhật query trước response, trong khi giữ card cũ khi loading/error (:218-221). Nếu làm đúng từng dòng theo nghĩa đen sẽ gắn ngày B lên card A. FE component-map.md:52-66 đã tách pendingSearch và snapshot thành công, xử lý đúng. | Design cập nhật mô tả khi được phân công. **Non-blocking sau quyết định A-01**: cấm dùng pending query cho card cũ; phải kiểm thử A→B loading/error và detail. Không ghi nhận đây là lỗi current-form asOf của FE. |

## 4. Assumption accepted for MVP — quyết định Coordinator

Các quyết định sau chốt ở tài liệu điều phối; không giả vờ artifacts của agent khác đã được sửa.

| ID / liên hệ | Quyết định chấp nhận và giới hạn |
|---|---|
| A-01 / C-09 | Dùng mô hình FE: pendingSearch tách searchState/resultSnapshot; chỉ commit ngày + items + pagination cùng response thành công được xác nhận. Detail chụp documentNumber/articleKey từ card và asOf của snapshot đó; selection bất biến cả khi form hoặc list thay đổi. Không dùng formState hoặc request đang chờ. |
| A-02 / FE-04, FE-14, C-04 | Giữ hasMore ba giá trị. Null chỉ ở search limit=100: cho thăm dò; nếu trang sau rỗng, lưu emptyPageAttempt riêng, hiện hết trang, Back khôi phục snapshot trước cùng chuỗi q/asOf/limit. Không ghi offset cũ lên response rỗng, không suy total/hasMore từ items.length. |
| A-03 / FE-05 | Trước search đầu: đổi limit chỉ đổi form. Sau đã submit: đổi limit là hành động submit form hiện tại sau validation, offset=0. Prev/Next vẫn lấy q/asOf/limit của snapshot. Đây là tương tác UI, không phải đổi API; không auto-search khi chỉ gõ q/đổi asOf. |
| A-04 / FE-06 | Panel là modal thật: focus trap, nền inert, Esc đóng, trả focus về card hoặc tiêu đề kết quả nếu card mất. Không thao tác form xuyên modal; chỉ response search đã gửi trước đó có thể cập nhật nền. Ưu tiên quy tắc modal hơn câu mô tả “search lại trong lúc panel mở”. |
| A-05 / FE-07 | Disable nút và Enter submit khi loading, vẫn cho sửa input. Sequence guard cho success/error/finally ở cả search/detail; request thay thế từ đổi limit vẫn an toàn. Không cần cho submit liên tục để demo. |
| A-06 / FE-08, FE-09 | Khi error.details chưa có schema, dùng banner, không đoán details.field/path. Reuse copy đúng hoàn cảnh; không nói người dùng đã đổi điều kiện nếu chỉ refresh thất bại; clipboard chỉ báo thành công khi đã copy. Không bịa requestId hoặc mã lỗi server cho lỗi client. |
| A-07 / FE-10 | asOf là ngày nghiệp vụ, không phải token khóa DB snapshot giữa hai request. Không gửi versionId ngoài contract. Nếu DB cập nhật giữa search/detail, dùng nguyên response detail mới, không ghép với card cũ; không hứa versionId luôn giống nhau. Nếu cần pin version phải thiết kế ngoài MVP. |
| A-08 / FE-11, DA-10 | UI prefill hôm nay local nhưng luôn gửi ngày tường minh; ô trống/sai bị chặn. Native date picker có thể hiển thị theo locale; text kết quả/detail dùng DD/MM/YYYY từ chuỗi lịch. Không dùng UTC conversion cho asOf. |
| A-09 / FE-12 | Thuật ngữ React trong Design được chuyển tương đương sang Vue :key và text interpolation. Key ghép versionId/articleKey, ID giữ string; không thêm React hay field API. |
| A-10 / FE-13, DA-01…DA-03, DA-05…DA-07 | Không total, số trang, sort control, score, snippet/highlight API, suggest, approval riêng hoặc metadata document trên ProvisionResult. CSS clamp body, giữ thứ tự API, hướng dẫn/ví dụ tĩnh. Count chỉ số item trang hiện tại. Hint số hiệu không sửa/chặn request. |
| A-11 / phạm vi MVP | Timeline/list documents/toàn văn bản nằm ngoài MVP theo chỉ thị mới, dù brief liệt kê phạm vi toàn dự án. Không dựng API call, màn hình hoặc nút ẩn sau flag cho chúng trong MVP. Việc đóng C-02/C-03/C-05 sau này không tự mở rộng MVP. |

## 5. Ma trận đối chiếu và rule bắt buộc

Đường dẫn trong bảng tương đối với artifacts/ trừ khi ghi khác; số dòng ứng với bản đã đọc ngày 2026-09-24.

| Kiểm tra | Bằng chứng | Kết luận |
|---|---|---|
| DB ↔ Backend: field | db/query-search-tax-law.sql:13-17; db/query-get-tax-provision.sql:4-8; backend/api-contract.md:17-19 | Đủ field. documentVersionId từ v.id map thành versionId string. Document metadata có trong schema; thiếu query không phải thiếu cột. requestId/pagination/asOf do ứng dụng tạo. |
| DB ↔ Backend: ngày/approval/version | Search SQL:19-21; get SQL:14-16; schema.sql:33-50,53-67; service-contract.md:41-53 | Cả hai query lọc approved và asOf, join đúng version; interval inclusive, null kết thúc hợp lệ. Không fallback/trộn version. |
| MCP architecture/output | backend/mcp-tools.md:3,11-14,25-29 | Handler không SQL/Repository; Service → Repository. Search/get có URL/interval; timeline/list có interval trong version. Chỉ xác nhận thiết kế, chưa kiểm tra code. |
| Backend ↔ Design | api-contract.md:7-17; design-spec.md:60-120,159-174 | Search semantics, ngày bắt buộc, provenance, null pagination khớp. REST detail chưa được coi tương đương envelope MCP: C-06. |
| Design ↔ FE | frontend/page-plan.md:9-11,22-51,70-88; component-map.md:31-48 | Bố cục, card/detail, breakpoints, copy và phân trang khớp trên happy path; các mâu thuẫn state/modal/loading/provenance đã ghi C-08/C-09 và A-01…A-09. |
| asOf bắt buộc search/get | backend/mcp-tools.md:11-12; frontend/integration-notes.md:15-19; page-plan.md:32-37 | Đạt trong kế hoạch. Prefill UI không phải backend tự điền; ngày thiếu/sai không request. |
| Detail dùng result snapshot, không current form | frontend/page-plan.md:48; component-map.md:57-66,93-97; integration-notes.md:86-90 | Đạt; mạnh hơn queryState mơ hồ của Design. Pending search không được đổi ngày của card cũ. |
| Không hiển thị total | design-spec.md:117; ui-copy.md:55-58,85; frontend/page-plan.md:11,80 | Đạt. items.length/range chỉ mô tả trang, không phải total. |
| Không sort control | design-spec.md:163; frontend/page-plan.md:11; integration-notes.md:21,148 | Đạt; giữ API order, không gửi sort. SQL có thứ tự xác định nhưng FE không tự hứa relevance ranking hoặc nhất quán nhiều request. |
| Không timeline/list trong MVP | frontend/page-plan.md:9; integration-notes.md:7; A-11 | Đạt. Bản phác thảo P2 của Design không phải yêu cầu hiện thực. |
| sourceUrl + effectiveFrom/effectiveTo ở result/detail | design-spec.md:87-109; frontend/page-plan.md:43-49; component-map.md:87-97 | Đạt với payload đúng contract; source của provision, interval version. Nhánh thiếu dữ liệu còn C-08, không được nghiệm thu như success hợp lệ. |
| FE tự thêm field/API behavior? | frontend/integration-notes.md:18-21,28-71; component-map.md:66,97 | Không phát hiện field/API mới. State nội bộ/selection không phải DTO. REST/MCP adapter tách envelope, không tự endpoint/bridge, không thêm versionId filter/asOf vào ProvisionResult. FE-04…FE-12 là quyết định UI được phân loại ở trên. |

## 6. Điều kiện kiểm chứng / lịch sử

- Đã đọc project/brief.md, agents/coordinator.md; bốn DB artifacts được yêu cầu; bốn Backend, bốn Design và ba Frontend artifacts; hai file điều phối cũ. Các tên có escape trong yêu cầu được đọc bằng file thực query-search-tax-law.sql và interaction-flow.md.
- Kết luận ngày 2026-09-23 “No blocking conflicts for search_tax_law and get_tax_provision” vẫn đúng ở lớp DB/MCP contract; không mở rộng kết luận đó sang REST detail hay transport browser.
- Trạng thái PostgreSQL pending trong tài liệu cũ đã được integration-report.md thay thế: 8/8 integration pass; toàn suite có TEST_DATABASE_URL đạt 106 tests passed, 0 skipped; typecheck pass. Backend/MCP search/get-provision đã nghiệm thu kỹ thuật cơ bản. E2E local sau đó đã PASS 9/9 nhóm theo báo cáo riêng; deploy và coverage thiếu chưa nghiệm thu. R-01…R-04 vẫn non-blocking ở mức nghiệm thu cơ bản.
- Khi hiện thực phải kiểm thử: asOf thiếu/sai; ngày đầu/cuối/null; draft/rejected không lộ; không fallback; mapping ID/URL/interval; pagination true/false/null; card A + form/request B + B lỗi → detail vẫn ngày A; response cũ không ghi đè; không total/sort/P2; malformed provenance không thành success; modal/focus/keyboard.
- Chỉ cập nhật conflict-log.md và final-summary.md; không sửa DB/Backend/Design/Frontend, task board hay tạo implementation.
