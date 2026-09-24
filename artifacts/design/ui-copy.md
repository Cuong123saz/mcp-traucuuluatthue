# UI Copy — Legal Lookup Mini Platform

Phiên bản: v0.1 (2026-09-24). Ngôn ngữ: tiếng Việt.

Frontend dùng nguyên văn các chuỗi dưới đây. Chuỗi có `{...}` là chỗ chèn biến. Ngày hiển thị luôn định dạng `DD/MM/YYYY`.

## Nguyên tắc viết

1. Ngắn, không hoa mỹ. Đây là công cụ tra cứu, không phải trang tiếp thị.
2. Không hứa nhiều hơn hệ thống làm được. Không dùng chữ "chính xác nhất", "đầy đủ nhất", "mới nhất".
3. Khi không có kết quả hoặc có lỗi, nói rõ nguyên nhân và việc người dùng làm tiếp được.
4. Luôn gắn kết quả với ngày tra cứu. "Không tìm thấy" mà không kèm ngày là câu sai trong bối cảnh này.
5. Không dùng "hiện hành" cho `effectiveTo = null`; dùng "không thời hạn kết thúc".
6. Không dùng "đến trước ngày" cho `effectiveTo`; khoảng hiệu lực bao gồm cả ngày đó, nên dùng "đến hết".

## 1. Header

| Key | Nội dung |
|---|---|
| `app.title` | Tra cứu luật thuế |
| `app.subtitle` | Tìm điều khoản theo từ khóa và xem nội dung đang áp dụng tại một ngày cụ thể. |

## 2. SearchBar

| Key | Nội dung |
|---|---|
| `search.q.label` | Từ khóa |
| `search.q.placeholder` | Ví dụ: thu nhập chịu thuế, khấu trừ, hoàn thuế |
| `search.q.counter` | {length}/300 |
| `search.asOf.label` | Ngày áp dụng |
| `search.asOf.help` | Ngày bạn muốn biết luật đang áp dụng, không phải ngày ban hành văn bản. |
| `search.asOf.today` | Hôm nay |
| `search.limit.label` | Số kết quả mỗi trang |
| `search.limit.note100` | Ở mức 100, hệ thống chưa xác định được còn kết quả ở trang sau hay không. |
| `search.submit` | Tra cứu |
| `search.submit.loading` | Đang tra cứu… |
| `search.hint.scope` | Tìm kiếm đọc nội dung và tiêu đề của điều khoản. Các từ trong ô đều phải xuất hiện, có phân biệt dấu. |
| `search.hint.docNumber` | Tìm kiếm không nhận số hiệu văn bản. Hãy nhập từ khóa trong nội dung điều khoản. |

`search.hint.docNumber` chỉ hiện khi heuristic phát hiện chuỗi giống số hiệu (DA-06); nó là gợi ý, không chặn submit.

## 3. Lỗi nhập liệu phía client

| Key | Nội dung |
|---|---|
| `validation.q.required` | Nhập từ khóa để tra cứu. |
| `validation.q.tooLong` | Từ khóa tối đa 300 ký tự. |
| `validation.asOf.required` | Chọn ngày áp dụng. |
| `validation.asOf.invalid` | Ngày không hợp lệ. Dùng định dạng ngày/tháng/năm. |

## 4. Ngữ cảnh kết quả

| Key | Nội dung |
|---|---|
| `result.context` | Kết quả áp dụng tại ngày {asOf} |
| `result.count` | {count} điều khoản trên trang này |
| `result.stale` | Bạn đã đổi điều kiện tra cứu. Kết quả bên dưới vẫn là của lần tra trước (ngày {asOf}). Bấm Tra cứu để cập nhật. |
| `result.liveRegion` | Đã tải {count} điều khoản áp dụng tại ngày {asOf}. |

## 5. Result card

| Key | Nội dung |
|---|---|
| `card.effective.open` | Từ {from} · không thời hạn kết thúc |
| `card.effective.closed` | Từ {from} đến hết {to} |
| `card.effective.mismatch` | Không khớp ngày tra cứu |
| `card.effective.mismatch.help` | Khoảng hiệu lực của điều khoản này không chứa ngày {asOf}. Đây là dấu hiệu sai dữ liệu, vui lòng báo lại kèm mã yêu cầu. |
| `card.source` | Xem nguồn |
| `card.source.invalid` | Nguồn không hợp lệ |
| `card.source.missing` | Thiếu nguồn |
| `card.detail` | Xem chi tiết |
| `card.body.empty` | Điều khoản không có nội dung. |
| `card.effective.missing` | Thiếu khoảng hiệu lực |

## 6. Pagination

| Key | Nội dung |
|---|---|
| `pager.prev` | Trang trước |
| `pager.next` | Trang sau |
| `pager.range` | Đang xem {from}–{to} |
| `pager.unknownMore` | Chưa xác định được còn kết quả hay không. Bấm Trang sau để kiểm tra. |
| `pager.end` | Đã hết kết quả. |

Không có chuỗi nào hiển thị tổng số kết quả — API không trả `total` (DA-01).

## 7. Empty states

### 7.1 `first-run`

| Key | Nội dung |
|---|---|
| `empty.firstRun.title` | Bắt đầu tra cứu |
| `empty.firstRun.body` | Nhập từ khóa xuất hiện trong nội dung điều khoản, chọn ngày áp dụng rồi bấm Tra cứu. Hệ thống chỉ trả về nội dung đã được duyệt và đang có hiệu lực tại ngày bạn chọn. |
| `empty.firstRun.examplesLabel` | Thử với |
| `empty.firstRun.examples` | thu nhập chịu thuế · khấu trừ thuế · hoàn thuế · người nộp thuế |

Các ví dụ là chuỗi tĩnh viết cứng trong UI, không lấy từ API (DA-05, DA-07).

### 7.2 `no-results`

| Key | Nội dung |
|---|---|
| `empty.noResults.title` | Không có điều khoản nào khớp tại ngày {asOf} |
| `empty.noResults.body` | Không tìm thấy điều khoản đã duyệt nào chứa các từ khóa bạn nhập và có hiệu lực tại ngày này. |
| `empty.noResults.tipsLabel` | Gợi ý |
| `empty.noResults.tip1` | Giảm bớt từ khóa — mọi từ bạn nhập đều phải xuất hiện trong điều khoản. |
| `empty.noResults.tip2` | Kiểm tra dấu tiếng Việt, vì tìm kiếm phân biệt dấu. |
| `empty.noResults.tip3` | Thử một ngày áp dụng khác; cùng một nội dung có thể chỉ có hiệu lực trong một khoảng thời gian. |
| `empty.noResults.tip4` | Tìm kiếm không đọc số hiệu và tên văn bản, chỉ đọc nội dung điều khoản. |

### 7.3 `end-of-results`

| Key | Nội dung |
|---|---|
| `empty.endOfResults.title` | Đã hết kết quả |
| `empty.endOfResults.body` | Không còn điều khoản nào ở trang này. |
| `empty.endOfResults.action` | Quay lại trang trước |

## 8. Loading

| Key | Nội dung |
|---|---|
| `loading.results` | Đang tải kết quả… |
| `loading.detail` | Đang tải nội dung điều khoản… |
| `loading.srAnnounce` | Đang tra cứu, vui lòng đợi. |

Skeleton không cần chữ hiển thị; các chuỗi trên dùng cho screen reader và cho panel chi tiết.

## 9. Error states

Mọi banner lỗi đều kèm dòng mã yêu cầu khi có `requestId`.

| Key | Nội dung |
|---|---|
| `error.requestId` | Mã yêu cầu: {requestId} |
| `error.requestId.copy` | Sao chép mã |
| `error.retry` | Thử lại |
| `error.invalidArgument.title` | Điều kiện tra cứu chưa hợp lệ |
| `error.invalidArgument.body` | Kiểm tra lại từ khóa và ngày áp dụng rồi tra cứu lại. |
| `error.notFound.title` | Không có điều khoản này tại ngày {asOf} |
| `error.notFound.body` | Không tìm thấy điều khoản {articleKey} của văn bản {documentNumber} đã được duyệt và có hiệu lực tại ngày này. Hệ thống không tự chuyển sang phiên bản khác. Thử chọn ngày áp dụng khác. |
| `error.dataIntegrity.title` | Dữ liệu không nhất quán |
| `error.dataIntegrity.body` | Hệ thống phát hiện dữ liệu không hợp lệ cho yêu cầu này và đã dừng lại thay vì trả kết quả có thể sai. Vui lòng báo lại kèm mã yêu cầu. |
| `error.dependencyUnavailable.title` | Hệ thống đang tạm thời không phản hồi |
| `error.dependencyUnavailable.body` | Chưa kết nối được tới nguồn dữ liệu. Thử lại sau ít phút. |
| `error.internal.title` | Đã xảy ra lỗi |
| `error.internal.body` | Yêu cầu không hoàn tất. Thử lại, nếu vẫn lỗi vui lòng báo kèm mã yêu cầu. |
| `error.network.title` | Không kết nối được |
| `error.network.body` | Kiểm tra kết nối mạng rồi thử lại. |

Không hiển thị `error.message` thô của server nếu nó không phải câu dành cho người dùng; dùng bảng trên. `error.details` chỉ dùng để định vị ô nhập bị sai.

## 10. Detail panel

| Key | Nội dung |
|---|---|
| `detail.title` | Chi tiết điều khoản |
| `detail.close` | Đóng |
| `detail.meta.heading` | Thông tin phiên bản |
| `detail.meta.versionId` | Mã phiên bản |
| `detail.meta.asOf` | Tra cứu tại ngày |
| `detail.copyLink` | Sao chép link nguồn |
| `detail.copied` | Đã sao chép |

## 11. Chuỗi chưa dùng trong v0.1

Timeline và danh sách văn bản chưa được build (C-02, C-03, C-05 — xem `design-spec.md` mục 9). Không viết copy trước cho các màn đó để tránh việc Frontend hiểu nhầm là đã chốt và đem ra dùng.

## 12. Những cách viết bị cấm

| Không viết | Vì sao | Viết thay bằng |
|---|---|---|
| "Điều khoản hiện hành" | `effectiveTo = null` không có nghĩa là đang áp dụng hôm nay; nội dung có thể có hiệu lực trong tương lai | "không thời hạn kết thúc" |
| "Có hiệu lực đến trước {to}" | Khoảng hiệu lực bao gồm cả ngày `effectiveTo` | "đến hết {to}" |
| "Không tìm thấy kết quả" (không kèm ngày) | Bỏ mất ngữ cảnh `asOf`, người dùng sẽ tưởng điều khoản không tồn tại | "Không có điều khoản nào khớp tại ngày {asOf}" |
| "Tìm thấy khoảng {n} kết quả" | API không trả tổng số | "Đang xem {from}–{to}" |
| "Đang hiển thị kết quả phù hợp nhất" | Thứ tự sắp xếp chưa được contract công bố (DA-03) | Không nói gì về thứ tự |
| "Xem phiên bản gần nhất" | Hệ thống không fallback version | "Thử chọn ngày áp dụng khác" |
| Hiển thị SQL, stack trace, tên bảng | Contract cấm lộ chi tiết nội bộ | Mã yêu cầu |
