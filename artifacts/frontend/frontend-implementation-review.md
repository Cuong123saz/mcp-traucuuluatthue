# Frontend implementation review — MVP

Ngày review: 2026-09-24. Phạm vi: frontend implementation; không nghiệm thu lại Backend/DB.

## 1. Kết luận

**Đạt luồng chính của MVP có điều kiện; chưa đủ để nghiệm thu toàn bộ frontend hoặc deploy production.** REST search, detail từ result snapshot, ngày áp dụng, giới hạn phạm vi và phân trang ba giá trị đều đúng yêu cầu hiện tại. Có **2 phát hiện P2 và 1 phát hiện P3** cần xử lý; không phát hiện P0/P1 trong phạm vi đã kiểm tra. Không sửa source code.

Điểm cần nói thẳng: 55 test xanh không đồng nghĩa mọi quyết định Coordinator đã được đáp ứng. Nhánh response thiếu provenance hiện vẫn ghi đè snapshot hợp lệ và chuyển sang success, trái điều kiện C-08. Không được đóng C-08 bằng lý do “đã có banner cảnh báo”.

Chỉ thị hiện tại của người dùng và quyết định A-01…A-11/C-07 được ưu tiên hơn mô tả lịch sử trong Design/page-plan. Detail dùng snapshot là đúng yêu cầu review này; không yêu cầu tự bổ sung REST detail để làm khớp kế hoạch cũ. C-06/C-01 vẫn chưa được đóng, và việc hiển thị panel không chứng minh REST get-provision đã được tích hợp.

## 2. Tài liệu và phương pháp

Đã đọc final-summary, conflict-log, design-spec, component-guidelines, ui-copy, interaction-flow, page-plan, component-map, integration-notes và api-contract theo danh sách yêu cầu. `interaction-flow\.md` được hiểu là file thực `interaction-flow.md`; báo cáo này dùng tên thực `frontend-implementation-review.md`.

Đã kiểm tra toàn bộ source tự viết trong frontend/src, toàn bộ frontend/tests, cấu hình Vite/TypeScript, package manifest, khai báo dependency trong lockfile, HTML entry, README, .env.example và .gitignore. Không coi node_modules hoặc bundle sinh ra là source cần review từng dòng. Dùng skill UI/UX Pro Max hỗ trợ kiểm tra tương tác; tiêu chí nghiệm thu lấy từ tài liệu dự án.

Kiểm chứng thực hiện trong lượt review:

| Kiểm chứng | Kết quả và giới hạn |
|---|---|
| `npm test` tại frontend | **4 test files passed, 55 tests passed**, không có test skipped trong lượt chạy. Môi trường Vitest + happy-dom, API mock. |
| `npm run build` | **PASS**: vue-tsc --noEmit và Vite production build. |
| Probe adapter → store, không sửa file | Tái hiện response thiếu sourceUrl sau snapshot hợp lệ: `status=success`, `previousSnapshotPreserved=false`, `requestId=bad-response`, `dataError=true`. |
| Tính tương phản từ CSS | Với opacity 0.6 và các màu hiện có: chữ muted trên card khoảng **2.68:1**, body khoảng **4.48:1**. Đây là phép tính màu CSS, không phải đo ảnh screenshot. |
| Quét đường gọi mạng và tính năng ngoài scope | Chỉ có fetch GET /search trong adapter; không có browser MCP client, detail request, timeline/list documents hoặc sort. |

Không chạy browser E2E, kiểm thử screen reader thực, ma trận viewport hay timezone trong lượt này. Smoke với Fastify + InMemoryTaxLawRepository chỉ được ghi nhận từ integration-notes §8.3, không gọi đó là bằng chứng PostgreSQL E2E hoặc lượt smoke mới. Không khởi động/migrate DB, không sửa artifacts/db, artifacts/backend, artifacts/design.

## 3. Phát hiện cần xử lý

### FR-01 — P2: Response lỗi provenance làm mất snapshot hợp lệ trước đó

**Bằng chứng:** [taxLawApi.ts:167](D:/Tra-cuu-luat-thue/frontend/src/lib/taxLawApi.ts:167) chỉ kiểm tra identity/text rồi nhận item; [searchStore.ts:123](D:/Tra-cuu-luat-thue/frontend/src/stores/searchStore.ts:123) commit mọi outcome thành công thành snapshot và status success. [App.vue:41](D:/Tra-cuu-luat-thue/frontend/src/App.vue:41) còn phát thông báo “Đã tải … điều khoản áp dụng tại ngày …” cho nhánh này. Banner dữ liệu ở [App.vue:138](D:/Tra-cuu-luat-thue/frontend/src/App.vue:138) không ngăn việc commit.

**Tái hiện:** search A trả item hợp lệ → giữ snapshot A → refresh cùng input trả item thiếu sourceUrl → snapshot A bị thay bằng response lỗi, status success. Probe chạy trực tiếp adapter và store xác nhận hành vi trên. Cùng cơ chế áp dụng cho thiếu effectiveFrom/effectiveTo hoặc interval sai ngày.

**Ảnh hưởng:** mất kết quả hợp lệ trước đó; thông báo thành công không thống nhất với cảnh báo lỗi dữ liệu. Conflict-log C-08 yêu cầu “giữ snapshot hợp lệ trước nếu có” và không nghiệm thu malformed provenance như success hợp lệ. Integration-notes §8.1 mô tả giữ card cảnh báo nhưng chưa giải quyết phần này.

**Đề nghị:** Frontend tách payload lỗi dữ liệu khỏi snapshot thành công; giữ snapshot hợp lệ trước và hiển thị lỗi/requestId của lần tải lỗi. Nếu cần giữ card lỗi để chẩn đoán, thể hiện trong trạng thái lỗi riêng, không âm thầm loại item hay gắn nhãn thành công hợp lệ. Coordinator/Design chốt cách trình bày C-08. Bổ sung ca valid A → malformed B, kiểm tra giữ A và không phát success announcement cho B.

**Mức độ:** P2; lỗi chỉ xuất hiện với payload vi phạm contract và UI đã có cảnh báo rõ, chưa đủ cơ sở coi là lỗi nghiêm trọng để tự sửa source trong lượt review này. C-08 chưa đạt.

### FR-02 — P2: Làm mờ cả card khiến chữ không đạt tương phản thiết kế

**Bằng chứng:** [App.vue:183](D:/Tra-cuu-luat-thue/frontend/src/App.vue:183) bật dimmed khi stale hoặc loading; [style.css:85](D:/Tra-cuu-luat-thue/frontend/src/style.css:85) đặt opacity 0.6 lên toàn bộ card-list. Chữ document/title và hostname dùng màu muted ở dòng 112/121; link, body và badge cũng bị làm mờ.

**Tái hiện:** có kết quả → sửa q/asOf hoặc tải trang mới → các card cũ vẫn đọc và mở detail được nhưng chữ muted chỉ còn khoảng 2.68:1 trên nền card đã composite với nền trang. Body khoảng 4.48:1 cũng dưới 4.5:1. Design-spec §5 và page-plan §2 yêu cầu chữ đạt 4.5:1. Card vẫn hoạt động nên không thể xem toàn bộ chữ là control disabled để bỏ qua tiêu chí này.

**Đề nghị:** giữ độ tương phản chữ/link/badge; dùng banner stale đã có hoặc thay viền/nền để phân biệt kết quả cũ. Xác nhận lại tương phản ở cả stale và loading. Owner: Frontend.

### FR-03 — P3: Banner lỗi dùng live announcement ngắt ngang

**Bằng chứng:** [ErrorBanner.vue:16](D:/Tra-cuu-luat-thue/frontend/src/components/ErrorBanner.vue:16) dùng role=alert, có ngữ nghĩa thông báo assertive; [App.vue:98](D:/Tra-cuu-luat-thue/frontend/src/App.vue:98) đồng thời có live region polite cho lỗi. Interaction-flow §8 yêu cầu polite và tránh assertive trong tra cứu.

**Ảnh hưởng:** lỗi mạng/server hoặc cảnh báo dữ liệu có thể ngắt nội dung screen reader đang đọc và tạo thông báo lặp. Đây là nhận định từ semantics trong source; chưa kiểm chứng bằng screen reader thực.

**Đề nghị:** thống nhất một cơ chế thông báo polite; giữ nội dung banner đọc được mà không tự ngắt lời. Kiểm tra thực với screen reader khi hoàn thiện accessibility. Owner: Frontend.

## 4. Đối chiếu yêu cầu MVP

| Yêu cầu | Kết luận | Bằng chứng |
|---|---|---|
| Chỉ một trang tra cứu và detail panel | Đạt phạm vi chức năng; còn FR-01…03 và rủi ro bàn giao | App.vue tổ chức SearchBar, results, DetailPanel; không router/màn ngoài MVP. |
| REST /search, không MCP browser | **Đạt** | taxLawApi.ts:66 tạo URL /search với đúng q/asOf/limit/offset; dòng 93 gọi fetch method GET. main.ts:8 khởi tạo adapter REST. Không dependency/import MCP trong runtime frontend. |
| Không tự tạo endpoint detail chưa chốt | **Đạt** | TaxLawApi chỉ có search; DetailPanel không gọi mạng. /documents chỉ được nhắc trong comment giải thích C-06. |
| Detail dùng dữ liệu card/result snapshot | **Đạt** | searchStore.ts:197 kiểm tra item thuộc snapshot rồi chụp provision, asOf, requestId; DetailPanel.vue:21 render selection.provision, body đầy đủ. Không ghép metadata từ document hoặc version khác. |
| Detail lấy asOf từ snapshot, không form | **Đạt** | searchStore.ts:200 dùng s.input.asOf; DetailPanel.vue:74/95 dùng selection.asOf. App.vue:190 truyền snapshot.input.asOf cho card. Tests phủ B đang chờ/lỗi và B thành công trong khi panel giữ A. |
| Không hiển thị total | **Đạt** | App.vue:115 chỉ items.length của trang; PaginationBar.vue:19 chỉ offset+1 đến offset+itemCount. Không suy tổng hoặc số trang. |
| Không sort control | **Đạt** | Chỉ một select cho limit; items render theo thứ tự nhận được, không sort/filter lại danh sách kết quả. |
| Không timeline/list documents/toàn văn bản | **Đạt** | Không component, API call hay nút ẩn sau flag cho các chức năng này. First-run là hướng dẫn tĩnh. |
| Không new Date(str).toLocaleDateString() với YYYY-MM-DD | **Đạt** | calendarDate.ts:27 split chuỗi; localToday:33 chỉ dùng Date() đọc đồng hồ local. Có test quét source và kiểm tra ngày nhuận. Không UTC conversion ngày nghiệp vụ. |
| Nguồn và khoảng hiệu lực | Đạt với payload hợp lệ; **chưa đạt đầy đủ C-08** | SourceLink chỉ http/https, target blank + noopener noreferrer; inspectEffective phân biệt effectiveTo null với field thiếu, so sánh hai đầu inclusive. FR-01 xử lý snapshot lỗi chưa đúng. |
| Render dữ liệu an toàn, giữ ID | Đạt trong phạm vi kiểm tra | Vue text interpolation, không v-html; versionId là string và key versionId:articleKey; test ID lớn hơn 2^53, HTML hiển thị text. |

## 5. Ma trận state và tương tác

| State / tình huống | Kết quả review |
|---|---|
| idle | Không request khi mở trang; ngày hôm nay local, limit=20, hướng dẫn tĩnh. |
| loading lần đầu | Skeleton tối đa 5; aria-busy; nút submit disabled và Enter bị store chặn; input vẫn sửa được. |
| loading khi đã có card | Giữ snapshot/ngày cũ, hiện nhãn tải; response chưa về không đổi context sang ngày mới. Có FR-02 về tương phản. |
| empty offset=0 | Copy không có kết quả kèm asOf snapshot; đủ hướng dẫn, không pager/range 1–0. |
| empty offset>0 | Lưu emptyPage riêng, ẩn card/pager; Back khôi phục snapshot trước cùng chuỗi q/asOf/limit, không request lại hoặc sửa offset response rỗng. |
| error | Giữ snapshot trước; requestId nếu có; không bịa ID cho network error. Retry dùng failed input, không đọc form hiện tại; không retry tự động. |
| error mapping | INVALID_ARGUMENT/DATA_INTEGRITY_ERROR không retry; DEPENDENCY_UNAVAILABLE/INTERNAL_ERROR/network/protocol có retry. Search NOT_FOUND được map generic error theo FE-18, không nói sai rằng điều khoản không tồn tại. Không đoán details.field/path. |
| stale | So form đã trim với q/asOf/limit snapshot; đổi về A thì bỏ stale; refresh cùng input lỗi dùng nhãn previous, không nói người dùng đổi điều kiện. |
| hasMore=true | Next bật; request tăng offset bằng limit snapshot, kể cả form đang khác. |
| hasMore=false | Next tắt, hiện hết kết quả; không dựa vào số item để suy hasMore. |
| hasMore=null | Adapter chỉ nhận khi limit=100; Next bật thăm dò kèm copy; trang kế rỗng có Back phục hồi. Thiếu hasMore/null tại limit khác bị từ chối như protocol error. |
| Pagination loading/error | Khóa Prev/Next khi loading; trang lỗi không commit offset mới; retry giữ request trang đã lỗi. |
| Đổi limit | Trước submit chỉ đổi form; sau submit validate form hiện tại rồi search offset=0. Có thể thay request đang chờ; sequence guard bỏ response cũ. |
| Detail snapshot | Form B, pending B, failure B không đổi panel A; thành công B không đổi selection A. Không thêm request khi mở panel. |
| Detail loading/error/NOT_FOUND riêng | **Không áp dụng cho MVP snapshot hiện tại**, đúng chỉ thị người dùng và FE-19. Không tạo state tải giả cho dữ liệu đã có; không coi đây là đã test REST get-provision. |
| Modal/bàn phím | Source có focus ban đầu, Tab/Shift+Tab trap, inert nền, Esc đóng, restore trigger hoặc heading khi trigger mất. Test hiện có phủ Esc/restore/inert; chưa đủ bằng chứng nghiệm thu Tab trap và fallback focus trên browser thật. |

Không phát hiện lỗi current-form asOf hoặc fallback version trong các luồng đã kiểm tra. State success khi payload lỗi provenance là ngoại lệ FR-01, không được che bằng kết luận “các state đã pass”.

## 6. Bốn rủi ro bắt buộc phải ghi nhận

| Rủi ro | Bằng chứng / ảnh hưởng | Điều kiện xử lý |
|---|---|---|
| **Vue 3 + Vite thay vì Nuxt** | package.json dùng Vue/Vite, không Nuxt. FE-15 còn cần Coordinator xác nhận sai khác với phân công Nuxt/Vue. | Coordinator chấp nhận stack hoặc giao chuyển đổi riêng. Không mặc định “chỉ bọc App.vue” là đủ: vẫn phải kiểm tra cấu hình môi trường, routing/build/deploy và khởi tạo ngày client nếu có SSR. Test pass không tự hợp thức hóa thay đổi stack. |
| **Chưa end-to-end với PostgreSQL thật** | 55 test frontend dùng mock; smoke đã báo cáo dùng InMemoryTaxLawRepository. Backend PostgreSQL PASS 106/0 trong final-summary là mốc của Backend, không phải Frontend E2E. | Chạy browser → REST → Service/Repository → PostgreSQL với dữ liệu kiểm soát, kiểm tra search/asOf/nguồn/interval/pagination và mở detail snapshot. Không mở lại blocker PostgreSQL cũ của Backend; thiếu bằng chứng ở đường frontend. |
| **CORS/reverse proxy deploy chưa chốt** | main.ts mặc định /api; vite.config.ts chỉ cấu hình proxy ở dev/preview. FE-17 ghi backend chưa gửi CORS header; lượt này không xác minh lại header backend. | Backend/Ops chốt reverse proxy cùng origin hoặc CORS allowlist; xác minh trên môi trường deploy thật. Upload dist không tự mang theo Vite proxy; /api/search có thể 404/trả HTML nếu host chưa cấu hình. |
| **4 chuỗi fe.* chưa có trong ui-copy chính thức** | copy.ts:102–106 có chính xác 4 key dưới đây, không nằm trong ui-copy.md. Chúng đã được dùng trong giao diện, không chỉ là TODO. | Design cung cấp/chấp nhận copy; Frontend đồng bộ theo bàn giao. Không tự sửa Design trong lượt này. |

Bốn chuỗi tạm:

| Key | Nội dung hiện tại |
|---|---|
| fe.result.previous | Danh sách bên dưới là kết quả của lần tra cứu thành công trước (ngày {asOf}). |
| fe.dataError.title | Lỗi dữ liệu trong kết quả |
| fe.dataError.body | {count} điều khoản trên trang này thiếu nguồn hoặc khoảng hiệu lực hợp lệ. Hệ thống không tự điền nguồn hay ngày thay thế; vui lòng báo lại kèm mã yêu cầu. |
| fe.copy.failed | Không sao chép được. Hãy chọn và sao chép thủ công. |

FE-20 còn liên quan cách diễn đạt lỗi interval mismatch: “không chứa ngày tra cứu” không hoàn toàn đồng nghĩa “thiếu khoảng hiệu lực”. Cần chốt copy nhưng không tự mở rộng API hoặc bịa mã lỗi domain.

## 7. Điều kiện nghiệm thu tiếp và phạm vi thay đổi

1. Frontend xử lý FR-01, xác nhận giữ snapshot hợp lệ trước khi payload mới lỗi; bổ sung regression test theo hành vi người dùng.
2. Frontend xử lý tương phản stale/loading và thống nhất thông báo polite; kiểm chứng bàn phím/modal, responsive và screen reader trên browser thật.
3. Coordinator chốt ngoại lệ Vue + Vite; Design chốt 4 chuỗi tạm và C-08/FE-20. Không tự đóng các conflict liên quan REST detail.
4. Backend/Ops/Frontend chốt đường deploy rồi cung cấp bằng chứng Frontend E2E với PostgreSQL thật. Không thay chứng cứ này bằng unit test hoặc smoke in-memory.

Chỉ tạo báo cáo review này; không sửa source, test hoặc artifact DB/Backend/Design. Lệnh build có sinh lại frontend/dist và Vite có cập nhật cache cục bộ. Không có Git repository tại thư mục làm việc để dùng git diff làm bằng chứng; không tuyên bố working tree sạch.
