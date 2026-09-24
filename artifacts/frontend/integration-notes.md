# Integration notes — Frontend MVP

Ngày cập nhật: 2026-09-24. Căn cứ: API/MCP v0.2, design v0.1 và chỉ thị MVP của Coordinator trong yêu cầu hiện tại. Chỉ bàn giao tài liệu; chưa xác minh có backend/transport đang chạy.

## 1. Ranh giới tích hợp

Frontend chỉ gọi search và lookup một provision. Không viết backend, SQL, endpoint trung gian hoặc sửa design/backend/db artifacts. Không gọi timeline, list documents hay document detail không có articleKey. Quy tắc approved, lựa chọn version và không trộn snapshot do Service đảm trách; FE kiểm tra bất thường, không dựng lại thuật toán chọn version.

Nuxt/Vue dùng adapter frontend để tách envelope khỏi component. Chọn một transport đã được môi trường cung cấp; không tự động fallback REST ↔ MCP, không giả định trình duyệt có MCP client. Nếu chưa có transport thì chỉ có thể demo với fixture đúng contract, ghi rõ dữ liệu minh họa; đợt này không tạo fixture hay code chạy.

## 2. Input được phép gửi

| Thao tác | MCP | REST | Input |
|---|---|---|---|
| Search | search_tax_law | GET /search | q, asOf, limit, offset |
| Detail provision | get_tax_provision | GET /documents/:number với articleKey | MCP: documentNumber, articleKey, asOf. REST: number trên path; articleKey/asOf trên query |

- Search q trim 1–300, asOf ngày lịch thật YYYY-MM-DD; limit nguyên 1–100 (UI giới hạn lựa chọn 10/20/50/100), offset nguyên ≥0. Gửi limit/offset tường minh.
- Detail documentNumber/articleKey dài 1–100; lấy từ card, giữ nguyên định danh và gửi ngày snapshot kết quả. Không gửi versionId, q, limit hoặc offset cho MCP get_tax_provision.
- REST encode number bằng encodeURIComponent một lần từ giá trị gốc, gồm dấu `/`; query dùng URLSearchParams. Không encode kép, không tự decode số hiệu từ DTO. Kiểm tra router/proxy bảo toàn segment đã encode ở bước tích hợp thật.
- Không thêm `total`, `sort`, `documentNumber` filter search, `snippet`, `highlight`, `approved`, `versionId` filter hoặc field phụ vào request. Không dùng object spread toàn bộ state làm payload.
- Không chuẩn hóa dấu/hoa thường/khoảng trắng bên trong q. Hướng dẫn tìm kiếm phải nói rõ chỉ heading/body, phân biệt dấu và mọi từ đều cần khớp.

## 3. Envelope: phải đọc đúng từng transport

### 3.1 Search REST

```text
{
  data: { asOf, items: ProvisionResult[] },
  pagination: { limit, offset, hasMore },
  requestId
}
```

Pagination nằm cùng cấp data, không nằm trong data. Adapter kiểm tra asOf trùng input, pagination ứng với limit/offset đã gửi, items là mảng không vượt limit, hasMore là true/false/null và null chỉ tại limit=100. Không tính hasMore bằng items.length, không biến null thành false hoặc true. Schema envelope sai là lỗi tích hợp/client; không tự gán mã domain DATA_INTEGRITY_ERROR của server.

### 3.2 Search MCP

```text
isError: false
structuredContent: {
  data: { asOf, items: ProvisionResult[], pagination: { limit, offset, hasMore } },
  requestId
}
content: JSON serialization tương ứng
```

Pagination ở structuredContent.data.pagination. Ưu tiên structuredContent, không ghép từng field từ content và structuredContent. Nếu môi trường chỉ cung cấp content thì cần adapter parse/validate toàn bộ JSON tương ứng, không regex lấy trường. Không chấp nhận mâu thuẫn envelope như một kết quả thành công.

### 3.3 Detail MCP

```text
isError: false
structuredContent: { data: ProvisionResult, requestId }
```

Payload là một ProvisionResult; **không có data.asOf, document, provisions, pagination**. asOf hiển thị lấy từ detailSelection đã dùng gọi tool, không bổ sung field vào contract. Kiểm tra identity trả về khớp documentNumber/articleKey được yêu cầu. Hiệu lực không chứa ngày yêu cầu phải được cảnh báo, không gắn badge áp dụng bình thường.

### 3.4 Detail REST: còn điểm cần chốt

API contract nói articleKey chọn một provision nhưng chỉ công bố ví dụ chung:

```text
{ data: { asOf, document: DocumentSummary, provisions: ProvisionResult[] },
  pagination: { limit, offset, hasMore }, requestId }
```

Không có ví dụ/schema riêng khẳng định nhánh articleKey trả trực tiếp ProvisionResult như MCP. Vì vậy chưa được viết adapter REST giả định `data` là provision, cũng không được tự thêm endpoint `/provisions`.

Phương án có thể kiểm chứng sau khi Backend xác nhận dùng envelope chung: kiểm tra data.asOf, chọn **đúng một** phần tử provisions có documentNumber/articleKey yêu cầu, render nguyên phần tử đó; không lấy provisions[0] mù quáng, không ghép title/source từ document. 200 rỗng, nhiều match hoặc sai identity là bất thường contract, không tự chuyển thành domain 404. Nếu Backend xác nhận envelope khác thì cần Backend cập nhật contract trước. MCP get_tax_provision đã rõ payload nghiệp vụ; chỉ dùng được nếu có transport MCP sẵn. Xem FE-01/FE-02.

## 4. Data flow và chống sai ngữ cảnh

### Search

1. Validate form → tạo input bất biến `{q: trim(q), asOf, limit, offset: 0}`.
2. Ghi pendingSearch và tăng sequence nội bộ; giữ searchState/resultSnapshot của lần thành công trước. Đánh dấu loading, không đổi ngày trên dữ liệu cũ.
3. Gửi input qua transport đã chọn. Search mới thay thế request trước; abort nếu có, luôn kiểm tra sequence khi xử lý success/error/finally.
4. Chỉ response mới nhất, hợp lệ được commit đồng thời input đã xác nhận thành searchState và response thành resultSnapshot. asOf response phải khớp input; nếu khác thì giữ snapshot trước và hiện lỗi tích hợp.
5. Form có thể đã sửa trong lúc chờ: sau commit vẫn so sánh form với snapshot để giữ stale đúng. Không tự ghi đè bản nháp bằng response.
6. Lỗi giữ snapshot thành công trước, lưu input thất bại/requestId riêng. Retry gửi lại chính input thất bại; muốn dùng form mới phải Tra cứu. Không retry tự động.

### Detail

1. Click card → chụp `{documentNumber, articleKey, asOf: searchState.asOf}` gắn với card đang hiển thị thành detailSelection.
2. Mở panel/loading và tăng detail sequence riêng; gọi get_tax_provision hoặc REST articleKey sau khi chốt envelope.
3. Commit response đúng selection/sequence. Metadata ngày lấy từ selection; body/title/source/interval/versionId phải cùng một ProvisionResult trả về.
4. NOT_FOUND nói rõ không có provision approved tại ngày yêu cầu; không tìm version gần nhất hay thử ngày khác. Retry lỗi tạm giữ nguyên selection.
5. Đóng panel hủy/vô hiệu hóa request đang chạy; response trễ không được mở lại. Danh sách thay đổi không sửa selection hay body đang xem.

Không gửi versionId để “khóa version”: contract không hỗ trợ. Cùng asOf có thể trả versionId khác sau khi dữ liệu backend được cập nhật giữa search và detail. Giữ nguyên response detail, không ghép với card cũ; ghi FE-10 để chốt cách thông báo nếu cần.

### Pagination và thay đổi form

- Prev/Next lấy q/asOf/limit từ searchState của kết quả, chỉ thay offset; form bẩn vẫn được giữ, stale không mất sau phân trang nếu còn khác.
- true bật Next, false tắt, null tại 100 bật với copy thăm dò. Thiếu hasMore hoặc null tại limit khác là lỗi contract; không suy đoán.
- Chỉ commit offset mới cùng response. Lỗi tải trang sau giữ nguyên offset/cards cũ và lưu request bị lỗi để retry.
- Trang offset>0 trả rỗng: ghi emptyPageAttempt riêng, hiển thị end-of-results và ẩn cards/pager range; giữ snapshot trước cùng chuỗi. Back phục hồi snapshot đó. Không sửa pagination của response rỗng thành offset cũ; không tính tổng từ trang rỗng.
- Đổi limit: lần đầu chỉ đổi form; sau đã submit thì validate và submit toàn bộ form mới với offset=0. Khi invalid không request; giữ snapshot trước và đánh dấu stale. Đây là lựa chọn tạm cần Coordinator/Design biết (FE-05).

## 5. Error mapping

REST lỗi dùng `{error:{code,message,details:[...]},requestId}`; MCP dùng isError=true với structuredContent `{error:{code,message,details?},requestId}`. Không coi lỗi giao thức MCP là domain code giả.

| Mã / loại | UI copy | Retry |
|---|---|---|
| INVALID_ARGUMENT / 400 | error.invalidArgument; field error chỉ khi xác định được field an toàn | Không |
| NOT_FOUND / 404 | error.notFound trong detail, dùng ngày/identity của failed selection | Không |
| DATA_INTEGRITY_ERROR / 409 | error.dataIntegrity, requestId | Không |
| DEPENDENCY_UNAVAILABLE / 503 | error.dependencyUnavailable | Có, thủ công |
| INTERNAL_ERROR / 500 | error.internal | Có, thủ công |
| Mất mạng, timeout, không parse được | error.network theo design; loại nội bộ tách biệt domain | Có, thủ công |
| Envelope hợp lệ JSON nhưng sai contract/giao thức | Tạm error.internal, lưu requestId nếu có; ghi lỗi tích hợp nội bộ | Có, thủ công; không lặp tự động |

Không có cấu trúc phần tử details được công bố: chưa giả định details.field/path; mặc định banner INVALID_ARGUMENT, chỉ map field khi có schema được xác nhận. Không in raw error.message/details/response, nội dung luật, stack hoặc thông tin nội bộ vào thông báo chẩn đoán. requestId có thì hiện/copy; lỗi mạng không có thì không bịa ID.

Các ô input vẫn cho sửa trong search loading; submit disable theo guideline. Sequence guard vẫn bắt buộc cho request bị thay bởi đổi limit hoặc các đường dispatch khác. Nút retry không đọc lại form. Hủy chủ động không phải lỗi cần báo người dùng.

## 6. Frontend conflicts / assumptions

Các quyết định dưới đây chỉ là phương án frontend trong tài liệu, **không tuyên bố đã được Backend/Design phê duyệt**. Không tự bổ sung field API nào để giải quyết chúng.

| ID | Điểm chưa rõ / mâu thuẫn | Phương án MVP và người cần chốt |
|---|---|---|
| FE-01 | API GET /documents/:number có articleKey nhưng không mô tả envelope riêng; MCP trả trực tiếp ProvisionResult. Design coi hai luồng tương đương | Giữ phân biệt adapter, không đoán payload. Backend cần xác nhận envelope REST articleKey trước khi nối nhánh này; không chặn việc lập kế hoạch UI |
| FE-02 | Contract là thiết kế, chưa có base URL, transport MCP cho browser, auth/CORS hoặc timeout được cung cấp | Chỉ dùng transport được môi trường bàn giao; Coordinator/Backend xác nhận cấu hình khi hiện thực. Không xây bridge/backend trong phạm vi FE; chưa khẳng định demo tích hợp chạy được |
| FE-03 | design-spec §4.4 cấm render card thiếu sourceUrl/effectiveFrom; component-guidelines §6 lại yêu cầu giữ card kèm cảnh báo | Tạm theo hướng dẫn component cụ thể: giữ card, cảnh báo thiếu nguồn/khoảng hiệu lực, không render link/badge hợp lệ giả. Design/Coordinator chốt; không tự bỏ card làm sai số lượng/range |
| FE-04 | Design muốn end-of-results đồng thời “lùi offset”, dễ tạo trạng thái items rỗng gắn offset trang cũ | Tách emptyPageAttempt và snapshot trước; màn hết trang có Back khôi phục snapshot, không đổi dữ liệu response. Design/Coordinator xác nhận hành vi |
| FE-05 | Đổi limit gọi search ngay nhưng chưa rõ lấy q/asOf form hay kết quả cũ, và lúc chưa search thì sao | Sau lần submit đầu coi đổi limit là submit form hiện tại nếu hợp lệ, offset=0; trước đó không gọi. Prev/Next luôn dùng searchState. Design/Coordinator chốt |
| FE-06 | Modal aria-modal/focus trap nhưng flow mô tả người dùng search lại khi panel mở | Tạm giữ modal đúng nghĩa, nền inert. Response search đã chạy trước lúc mở vẫn có thể cập nhật nền; panel giữ nguyên. Muốn vừa thao tác form vừa đọc panel phải chốt đổi interaction, không tự bỏ focus trap |
| FE-07 | Guideline disable submit khi loading; flow nói người dùng có thể submit lần nữa | Tạm disable nút và Enter submit khi đang loading, giữ form editable; mọi dispatch thay thế vẫn sequence-safe. Design chốt nếu muốn cho submit liên tục |
| FE-08 | Chưa có copy riêng cho refresh cùng query thất bại, envelope sai, version thay đổi hoặc copy clipboard thất bại | Dùng banner lỗi sẵn có đúng hoàn cảnh; result.stale chỉ khi điều kiện đã đổi. Không báo copy thành công khi thất bại, cho chọn/copy text thủ công. Design bổ sung copy nếu cần; không bịa field/mã lỗi server |
| FE-09 | api-contract không công bố schema phần tử error.details | Mặc định banner; Backend xác nhận schema trước khi map lỗi server vào field. Validation local vẫn gắn field bình thường |
| FE-10 | Không có version pin/snapshot token cho lookup; get_tax_provision không nhận versionId | Dùng đúng identity+asOf, không gửi versionId. Không bảo đảm search/detail giống versionId nếu dữ liệu đổi giữa hai request. Không ghép response mới với card cũ; cần Backend/Coordinator chốt nếu muốn nhất quán mạnh hơn |
| FE-11 | Design yêu cầu DD/MM/YYYY nhưng native input date hiển thị tùy locale trình duyệt | Dùng native date theo component guideline; value gửi vẫn YYYY-MM-DD, text ngoài input format thủ công DD/MM/YYYY. Không cam kết native picker luôn cùng display format; Design chốt nếu cần picker tùy biến |
| FE-12 | Guideline dùng thuật ngữ React dù agent được giao Nuxt/Vue | Dùng Vue :key và interpolation tương đương; không thêm React. Không thay đổi design artifact |
| FE-13 | Không có total, sort semantics, snippet/highlight, suggest, trạng thái duyệt riêng hoặc issuingBody/issuedOn trong ProvisionResult | Không hiển thị tổng/sort; giữ API order, clamp body, hướng dẫn tĩnh; không yêu cầu/thêm các field này cho MVP. Không lấy DocumentSummary trộn vào provision |
| FE-14 | hasMore null ở limit=100 do C-04 chưa đóng | Giữ đủ nhánh true/false/null, thăm dò và Back như trên. Không xóa nhánh null trước khi Backend cập nhật contract |

Không có field bổ sung bắt buộc để hoàn thành UI MVP theo kế hoạch. Chỗ cần chốt trước tích hợp thật là response REST detail và môi trường transport; các mâu thuẫn UX có phương án tạm đã nêu, không được gọi là quyết định cuối của Design.

## 7. Giới hạn, định dạng và kiểm chứng bàn giao

- Ngày là chuỗi lịch: validate rồi tách năm/tháng/ngày để format; không dùng `new Date(str).toLocaleDateString()`, UTC conversion hay toISOString cho ngày nhập. Hôm nay lấy đồng hồ local client.
- effectiveTo=null là không thời hạn kết thúc; khoảng chứa cả hai đầu. Mismatch hiện warning, không tự lọc item/đổi ngày để che sai dữ liệu.
- versionId luôn string. Body/title/heading render text Vue, không v-html. Nguồn chỉ http/https, noopener/noreferrer, không fetch nguồn.
- Không hiển thị total hoặc relevance rank; count chỉ items.length của trang. Không kiểm chứng được thứ tự ổn định giữa các request vì sort semantics chưa công bố; FE không tự khử trùng/lọc lại làm biến dạng phân trang.
- (Lịch sử, trước mục 8) Bản tài liệu ban đầu chưa có ứng dụng; xem mục 8 cho kết quả triển khai và test.

## 8. Cập nhật triển khai MVP — 2026-09-24

Đã hiện thực frontend MVP trong `frontend/` (package riêng, không đụng backend/DB). Transport: **REST GET /search** theo C-07; không gọi MCP từ browser.

### 8.1 Quyết định đã áp dụng

- Detail panel **không gọi API**: hiển thị chính ProvisionResult trong snapshot search (search đã trả body đầy đủ). Không dựng `/documents/:number` hay `/provisions` vì C-06 chưa đóng. asOf panel lấy từ snapshot đã tạo card (A-01), selection bất biến.
- Adapter kiểm tra envelope search: `data.asOf` = asOf gửi, pagination.limit/offset khớp request, `hasMore` true/false hoặc null **chỉ khi limit=100**, items ≤ limit, identity (documentNumber/articleKey/versionId) không rỗng, không trùng key `versionId:articleKey`. Sai → lỗi protocol, hiện copy `error.internal` (không gán mã DATA_INTEGRITY_ERROR của server).
- Item thiếu/sai `sourceUrl`, `effectiveFrom`, thiếu hẳn field `effectiveTo` (khác null), hoặc interval không chứa asOf: **giữ card** (FE-03), không render link/badge hợp lệ, hiện nhãn cảnh báo và banner lỗi dữ liệu kèm requestId. Không tạo nguồn/ngày thay thế.
- Cấu hình: `VITE_TAXLAW_API_BASE_URL` (mặc định `/api`), `VITE_TAXLAW_API_TIMEOUT_MS` (mặc định 10000), `TAXLAW_API_PROXY_TARGET` cho Vite proxy (mặc định `http://127.0.0.1:3000`). Xem `frontend/.env.example`.

### 8.2 Điểm chưa rõ mới — cần chốt

| ID | Điểm chưa rõ | Phương án tạm / người chốt |
|---|---|---|
| FE-15 | Phân công ghi Nuxt/Vue; MVP dùng **Vue 3 + Vite** (không Nuxt) để gọn và test được bằng Vitest. Không có SSR nên không có vấn đề ngày server. | Coordinator xác nhận; chuyển sang Nuxt chỉ cần bọc App.vue thành page, logic ở `src/lib`, `src/stores` giữ nguyên. |
| FE-16 | ui-copy chưa có chuỗi cho: banner lỗi dữ liệu trong kết quả, nhãn "danh sách là kết quả lần trước" khi refresh lỗi, clipboard thất bại. | Dùng chuỗi tạm key `fe.*` trong `frontend/src/lib/copy.ts`. Design cung cấp copy chính thức. |
| FE-17 | Backend REST **không gửi CORS header**. Browser khác origin gọi thẳng `http://127.0.0.1:3000` sẽ bị chặn. | Dev/preview dùng Vite proxy `/api` → backend (cùng origin). Deploy thật cần Backend/Ops chốt: reverse proxy cùng origin hoặc CORS allowlist. FE không tự sửa backend. |
| FE-18 | GET /search trả `NOT_FOUND` chỉ khi route sai (ví dụ base URL cấu hình sai). | Hiển thị copy `error.internal` có retry, không dùng copy "không có điều khoản". Backend xác nhận. |
| FE-19 | Detail dùng dữ liệu card nên không có loading/error/NOT_FOUND riêng trong panel. | Khi Backend chốt REST detail (C-06/C-01), bổ sung gọi API với identity + asOf snapshot, sequence guard riêng, copy `error.notFound`. |
| FE-20 | Mismatch (interval không chứa asOf) được tính là lỗi dữ liệu và đưa vào banner. | Design/Coordinator xác nhận có muốn tách mismatch khỏi "thiếu nguồn/khoảng hiệu lực". |

### 8.3 Kiểm chứng

- `npm test` trong `frontend/`: 4 test files, 55 tests pass (search success/empty, invalid q/asOf, loading, error + retry, stale, hasMore true/false/null + end-of-results/Back, detail dùng asOf snapshot khi form/request B đang chờ/lỗi/thành công, dữ liệu thiếu nguồn/interval, không total/sort, render text).
- `vue-tsc --noEmit` và `vite build` pass.
- Smoke cục bộ: Fastify `buildApp` thật + Service + InMemoryTaxLawRepository (fixture test, không PostgreSQL) qua Vite proxy; search, detail, Esc/focus restore chạy trong browser. **Chưa** chạy end-to-end với PostgreSQL thật; Frontend end-to-end vẫn cần Coordinator nghiệm thu.
