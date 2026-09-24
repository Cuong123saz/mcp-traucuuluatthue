# Component map — Nuxt/Vue MVP

Ngày cập nhật: 2026-09-24. Tên dưới đây là đề xuất tổ chức frontend; không phải field API mới, không tạo file triển khai trong đợt bàn giao tài liệu này.

## 1. Cây component

```text
TaxLawSearchPage
├── SearchBar
│   ├── SearchInput (q)
│   ├── AsOfPicker (asOf + Hôm nay)
│   └── LimitSelect
├── ResultContext
├── StaleResultsNotice
├── ResultList
│   ├── LoadingState / ErrorState / EmptyState
│   └── ProvisionCard × n
│       ├── EffectiveBadge
│       └── SourceLink
├── Pagination
└── ProvisionDetailPanel
    ├── LoadingState / ErrorState
    ├── EffectiveBadge
    └── SourceLink
```

## 2. Trách nhiệm và giao tiếp

Props/event trong bảng là giao diện nội bộ Vue. Chỉ tầng adapter gửi các tham số đã cho phép trong contract.

| Component | Props / dữ liệu | Event / trách nhiệm |
|---|---|---|
| TaxLawSearchPage | State từ composable search/detail | Điều phối form, request, snapshot và focus; không có logic chọn version |
| SearchBar | formState, fieldErrors, loading | update form, submit, limit-change; form thật, validate trước request |
| SearchInput | q, error | update:q; counter từ 260; hint số hiệu; không auto-search |
| AsOfPicker | asOf string, error | update:asOf; today; không parse ngày dữ liệu thành Date |
| LimitSelect | limit 10/20/50/100 | update:limit; ghi chú mức 100 |
| ResultContext | asOf của snapshot, items.length | `result.context`, `result.count`; count chỉ trên trang |
| StaleResultsNotice | asOf cũ, điều kiện form khác snapshot | `result.stale`; không lấy ngày form để gắn nhãn cards |
| ResultList | status, snapshot, pending, error, emptyContext | Render theo state tập trung; không tự gọi API hoặc lọc/sort items |
| ProvisionCard | ProvisionResult nguyên bản, asOf snapshot | open-detail với identity và asOf; `:key` ghép versionId/articleKey; không dùng index |
| EffectiveBadge | effectiveFrom, effectiveTo, asOf snapshot | So sánh chuỗi lịch đã validate; applicable/mismatch/missing; không sửa dữ liệu |
| SourceLink | sourceUrl | Link ngoài hợp lệ http/https; hostname; warning khi thiếu/sai; không fetch |
| Pagination | limit, offset, hasMore, itemCount, loading | prev/next; null có copy thăm dò; không tính total/page count |
| ProvisionDetailPanel | detail selection, status, provision, error, requestId | close/retry/copy; modal responsive; giữ body nguyên văn, metadata versionId/asOf |
| LoadingState | count=min(limit,5) hoặc variant detail | Skeleton có aria-hidden, container aria-busy; thông báo polite ngắn |
| EmptyState | first-run/no-results/end-of-results, asOf phù hợp | Back cho hết trang; hướng dẫn tĩnh; không gọi list documents |
| ErrorState | domain code hoặc lỗi client, requestId nếu có, retryable | Hiện copy an toàn, copy requestId, retry khi được phép; không dump details |

## 3. State ownership — điểm bắt buộc

Không chỉ tách form/query: phải tách **request đang chờ** và **snapshot đã nhận thành công**. Ghi query mới trước khi response về rồi dùng query ấy gắn lên card cũ là lỗi nghiệp vụ.

| State nội bộ | Nội dung | Khi nào thay đổi |
|---|---|---|
| formState | q, asOf, limit | Mỗi lần người dùng sửa; không tự đổi snapshot |
| pendingSearch | Input bất biến `{q,asOf,limit,offset}` + sequence nội bộ | Khi gửi search mới |
| searchState | Snapshot `{q,asOf,limit,offset}` đã tạo ra danh sách đang hiển thị | Commit cùng response thành công; không cập nhật chỉ vì submit |
| resultSnapshot | items, pagination, asOf phản hồi, requestId đi cùng searchState | Commit nguyên khối sau kiểm tra envelope; không ghép với response khác |
| searchStatus | idle/loading/success/empty/error | Vòng đời thao tác đang xét |
| failedSearch | Input bị lỗi + code/requestId | Cho retry đúng input, không đọc lại form |
| emptyPageAttempt | Input/response rỗng offset>0 + snapshot trước cùng chuỗi phân trang | Cho trạng thái end-of-results và quay lại |
| detailSelection | documentNumber, articleKey, asOf đã chụp lúc click | Khi mở một card; không bind trực tiếp form/searchState đang biến đổi |
| detailState | open, status, provision, error, requestId, sequence | Vòng đời detail riêng; đóng panel vô hiệu hóa response còn chờ |

`searchState` ở đây là queryState đã commit; `pendingSearch` mới là query vừa gửi. Các trường state như sequence, status, selection, emptyPageAttempt, retryable **không thuộc request/response API**.

Stale do form đổi = so sánh `(trim(form.q), form.asOf, form.limit)` với searchState; không so offset vì form không chứa offset. Khi dữ liệu cũ được giữ trong refresh thất bại, đánh dấu nội bộ là dữ liệu lần trước và hiện banner lỗi; không giả vờ đã refresh thành công. Không persist/cache xuyên phiên trong MVP. Snapshot quay lại trang chỉ thuộc cùng q/asOf/limit.

## 4. Composable và adapter dự kiến

| Module nội bộ | Phạm vi |
|---|---|
| useTaxLawSearch | Validate, submit, đổi limit, phân trang, stale, lưu snapshot, sequence/abort, retry input cũ |
| useTaxProvisionDetail | Chụp selection, fetch detail, chống response trễ, đóng/mở và retry độc lập |
| taxLawAdapter | Chuyển envelope REST hoặc MCP đã được chọn sang dữ liệu nội bộ; chỉ search/get provision; không tự dựng bridge/server |
| calendarDate | Validate lịch bằng phần năm/tháng/ngày và số ngày tháng; format chuỗi YYYY-MM-DD → DD/MM/YYYY; local today từ đồng hồ client |
| sourceUrlGuard | Parse URL trong try/catch, chỉ http/https; không xác minh tính pháp lý của domain |
| errorPresentation | Map domain code → ui-copy key/retry policy; phân biệt lỗi mạng/giao thức nội bộ và lỗi nghiệp vụ |

Search sequence và detail sequence độc lập. Abort chỉ tối ưu tài nguyên; vẫn kiểm tra sequence để response/lỗi/finally cũ không được sửa status của request mới. Không dùng requestId từ server để suy luận request nào mới nhất. Abort do yêu cầu mới hoặc đóng panel không hiện banner lỗi mạng.

## 5. Mapping dữ liệu, định dạng và an toàn render

| Nguồn contract | Hiển thị / sử dụng |
|---|---|
| documentNumber, title | Dòng văn bản card/detail; không dùng document title khác thay version title |
| articleKey, heading | Định danh và heading; heading rỗng dùng articleKey, ghi nhận bất thường |
| body | Vue text interpolation; card CSS clamp, detail pre-wrap; không v-html |
| sourceUrl | Nguồn của chính provision, không thay bằng nguồn DocumentSummary |
| effectiveFrom, effectiveTo | Badge interval bao gồm hai đầu; null kết thúc hợp lệ |
| versionId | String nguyên vẹn, key gồm versionId/articleKey, metadata/copy detail; không parse number |
| Search data.asOf | Xác nhận trùng input gửi; gắn resultSnapshot/searchState; detail dùng snapshot này |
| pagination.limit/offset/hasMore | Điều hướng trang theo contract; giữ đủ ba giá trị hasMore |
| requestId | Lưu cả success/error; hiển thị khi lỗi/cảnh báo để đối soát |

ProvisionResult không chứa asOf; asOf truyền riêng từ snapshot. `get_tax_provision` không trả asOf trong payload: panel hiển thị ngày từ detailSelection. Không thêm asOf vào DTO để che khác biệt này.

Không dùng `new Date(str).toLocaleDateString()` cho YYYY-MM-DD. Sau validate, tách `[year, month, day]` và nối `day/month/year`. `new Date()` không đối số chỉ dùng đọc đồng hồ hôm nay; ghép getFullYear/getMonth/getDate local, không toISOString.

Component guidelines nhắc React được chuyển tương đương Vue: `:key`, text interpolation, props/emits; không đưa React vào dự án Nuxt. Chi tiết các bất đồng tài liệu và phương án tạm xem `integration-notes.md`.
