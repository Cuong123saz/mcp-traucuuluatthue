# Design Spec — Legal Lookup Mini Platform

Phiên bản: v0.1 (2026-09-24). Phạm vi: UX/UI cho demo tra cứu điều khoản thuế.

Tài liệu này bám theo `artifacts/backend/api-contract.md` v0.2 và `artifacts/backend/mcp-tools.md` v0.2. Design không đổi contract; mọi thứ UI cần mà contract chưa có đều nằm ở mục "Design assumptions" phía dưới và phải được Backend/Coordinator chốt trước khi Frontend hiện thực phần liên quan.

## 1. Nguyên tắc thiết kế

1. **Nguồn phải kiểm chứng được.** Mỗi kết quả luôn hiện `documentNumber`, `articleKey`, khoảng hiệu lực và link nguồn. Không có card nào thiếu nguồn.
2. **Ngày áp dụng là ngữ cảnh, không phải bộ lọc phụ.** `asOf` luôn hiển thị ngay cạnh kết quả, vì cùng một điều khoản ở hai ngày khác nhau là hai nội dung khác nhau.
3. **Không giả vờ có dữ liệu.** Không fallback sang version gần nhất, không ghép nội dung, không đoán ngày. Không có kết quả thì nói rõ là không có tại ngày đó.
4. **Nói đúng khả năng tìm kiếm.** Search là full-text theo từ trên `heading`/`body`, không phải tìm chuỗi con, không tìm theo tiêu đề hay số hiệu văn bản. UI phải nói điều này ở nơi người dùng gặp thất bại (empty state), không giấu trong tooltip.
5. **Đơn giản để FE demo được.** Một trang chính, một panel chi tiết. Không dashboard, không biểu đồ, không đa cột phức tạp.

## 2. Phạm vi MVP

| Use case | Tool / route | Trạng thái | Ưu tiên |
|---|---|---|---|
| Tìm điều khoản theo từ khóa tại `asOf` | `search_tax_law` / `GET /search` | Hợp đồng đã ổn (final-summary) | **P0 — thiết kế đầy đủ** |
| Xem chi tiết một điều khoản | `get_tax_provision` / `GET /documents/:number?articleKey&asOf` | Hợp đồng đã ổn | **P0 — thiết kế đầy đủ** |
| Xem văn bản liên quan (sửa đổi, bãi bỏ, hướng dẫn, hợp nhất) trong panel chi tiết | `GET /relations?documentNumber&asOf` | Có contract | **P1 — thiết kế đầy đủ, mục 11** |
| Xem lịch sử version của văn bản | `get_document_timeline` | Bị chặn bởi C-02, C-05 | P2 — chỉ phác thảo, ẩn sau feature flag |
| Danh sách văn bản áp dụng tại `asOf` | `list_tax_documents` | Bị chặn bởi C-03 | P2 — không thiết kế trong v0.1 |
| Xem toàn bộ provisions của một văn bản | `GET /documents/:number` không kèm `articleKey` | Bị chặn bởi C-01 | P2 — không thiết kế trong v0.1 |

Frontend chỉ build P0 cho demo. P2 chỉ được bật khi conflict tương ứng trong `artifacts/conflicts/conflict-log.md` đã đóng.

## 3. Layout

Một trang, ba vùng dọc, tối đa 1 cột nội dung rộng 720–880px căn giữa. Panel chi tiết là side panel phải (desktop ≥1024px) hoặc full-screen sheet (mobile).

```
┌──────────────────────────────────────────────────────────┐
│ Header: tên sản phẩm + dòng mô tả 1 câu                  │
├──────────────────────────────────────────────────────────┤
│ SearchBar                                                │
│  ┌────────────────────────────┐ ┌──────────┐ ┌────────┐  │
│  │ q — search input           │ │ asOf     │ │ limit  │  │
│  └────────────────────────────┘ └──────────┘ └────────┘  │
│  [ Tra cứu ]                        hint: cách tìm kiếm  │
├──────────────────────────────────────────────────────────┤
│ ResultContext: "Kết quả áp dụng tại 24/09/2026"          │
│ ResultList                                               │
│  ┌────────────────────────────────────────────────────┐  │
│  │ ProvisionCard                                      │  │
│  │  articleKey · heading                              │  │
│  │  documentNumber · title                            │  │
│  │  EffectiveBadge: 01/01/2026 → không thời hạn       │  │
│  │  body (rút gọn 3 dòng)                             │  │
│  │  [Xem nguồn ↗]                    [Xem chi tiết]   │  │
│  └────────────────────────────────────────────────────┘  │
│  ... n cards ...                                         │
│ Pagination: [Trang trước]  Đang xem 1–20  [Trang sau]    │
└──────────────────────────────────────────────────────────┘
```

Panel chi tiết (`get_tax_provision`) hiện cùng các field nhưng `body` đầy đủ, không rút gọn, cộng khối "Văn bản liên quan" (mục 11) và khối "Thông tin phiên bản" (`versionId`, `asOf` đã dùng để tra).

## 4. Các thành phần bắt buộc

### 4.1 Search input (`q`)

- Một dòng, placeholder mô tả cách tìm theo từ khóa.
- Ràng buộc trùng contract: sau trim 1–300 ký tự. Bắt buộc.
- Đếm ký tự chỉ hiện khi đã nhập ≥ 260 ký tự.
- Enter = submit. Không autocomplete, không gợi ý (API không có endpoint suggest).
- Không auto-search khi gõ. Search luôn là hành động chủ động — tránh bắn request thừa và tránh cảm giác "kết quả nhảy" khi người dùng đang đọc dở một điều khoản.

### 4.2 asOf date picker

- Bắt buộc. Mặc định UI prefill **ngày hôm nay của client**, nhưng luôn gửi giá trị tường minh lên API; không bao giờ để trống rồi trông chờ backend tự điền (contract trả `400 INVALID_ARGUMENT`).
- Nhập dạng ngày lịch, hiển thị `DD/MM/YYYY`, gửi `YYYY-MM-DD`.
- Có nhãn phụ giải thích ý nghĩa: đây là ngày muốn biết luật đang áp dụng, không phải ngày ban hành văn bản.
- Cho phép chọn ngày tương lai và quá khứ. Không giới hạn min/max ở client vì dữ liệu approved có thể có hiệu lực trong tương lai.
- Khi đổi `asOf` mà kết quả đang hiển thị: đánh dấu kết quả là cũ (xem `interaction-flow.md`, mục "Stale results"), không tự động search lại.

### 4.3 Limit selector

- Select với các giá trị **10 / 20 / 50 / 100**, mặc định 20 (khớp default contract).
- Không cho nhập tự do; contract chỉ cho 1–100 và giá trị lạ bị từ chối.
- Có ghi chú cạnh option 100: ở limit=100 hệ thống không xác định được còn trang sau hay không (`hasMore: null`, xung đột C-04). UI xử lý theo mục 4.7.
- Đổi limit thì reset `offset` về 0.

### 4.4 Result card (`ProvisionResult`)

Mỗi card hiển thị đủ, theo thứ tự đọc:

| Vùng | Field | Bắt buộc |
|---|---|---|
| Dòng định danh | `articleKey` + `heading` | Có |
| Dòng văn bản | `documentNumber` + `title` | Có |
| Badge hiệu lực | `effectiveFrom` → `effectiveTo` | Có |
| Nội dung | `body` (rút gọn 3 dòng ở list, đầy đủ ở detail) | Có |
| Hành động | link `sourceUrl`, nút xem chi tiết | Có |
| Ẩn / kỹ thuật | `versionId` | Chỉ ở detail, trong khối phụ |

Không card nào được render nếu thiếu `sourceUrl` hoặc `effectiveFrom` — xử lý ở `component-guidelines.md`, mục "Dữ liệu khuyết".

### 4.5 sourceUrl

- Hiện như link ngoài, kèm icon "mở tab mới" và hostname rút gọn để người dùng thấy mình sắp đi đâu.
- `target="_blank"` + `rel="noopener noreferrer"`.
- Không preview, không fetch nội dung link (MCP contract cấm tool fetch `sourceUrl`; FE cũng không tự proxy).
- Ở detail panel có thêm nút copy link.

### 4.6 effectiveFrom / effectiveTo

- Luôn đi cùng nhau trong một badge duy nhất, không tách thành hai field rời.
- `effectiveTo = null` hiển thị là "không thời hạn kết thúc", **không** hiển thị "hiện hành" (nội dung có thể có hiệu lực trong tương lai so với hôm nay).
- Khoảng bao gồm cả hai đầu mút — copy không được dùng chữ "đến trước ngày".
- Badge có 3 trạng thái tương đối so với `asOf` đang tra, dùng để người dùng tự kiểm chứng kết quả đúng ngày họ hỏi:
  - `asOf` nằm trong khoảng: trạng thái mặc định (luôn đúng với search/get theo contract).
  - `effectiveFrom > asOf` hoặc `effectiveTo < asOf`: trạng thái cảnh báo. Trường hợp này **không được phép xảy ra** với search/get; nếu xảy ra là lỗi dữ liệu và UI hiện cảnh báo thay vì im lặng.

### 4.7 Pagination

- Dùng offset/limit, điều khiển "Trang trước / Trang sau".
- Không hiển thị tổng số kết quả và không hiển thị số trang — contract chỉ trả `{limit, offset, hasMore}`, không có `total`.
- `hasMore === true`: bật "Trang sau".
- `hasMore === false`: tắt "Trang sau", hiện dòng kết thúc danh sách.
- `hasMore === null` (chỉ khi limit=100): nút "Trang sau" vẫn bật nhưng ở dạng thăm dò, kèm copy nói rõ là chưa chắc còn kết quả. Nếu trang sau rỗng thì hiện empty state dạng "hết kết quả", không phải "không tìm thấy".

### 4.8 Loading / Empty / Error

Ba state bắt buộc; đặc tả chi tiết ở `component-guidelines.md` và `interaction-flow.md`, copy ở `ui-copy.md`.

- **Loading**: skeleton card, số lượng bằng `limit` nhưng tối đa 5 để không đẩy trang quá dài; SearchBar giữ nguyên, nút submit vào trạng thái đang xử lý.
- **Empty**: phân biệt 3 nguyên nhân — chưa search lần nào, search không có kết quả, phân trang vượt quá dữ liệu. Ba copy khác nhau.
- **Error**: phân biệt theo `error.code` của contract, luôn hiện `requestId` để đối soát log.

## 5. Visual system (tối giản, đủ để FE code nhanh)

- **Typography**: một font sans hệ thống. Kích thước: heading card 16px/600, tiêu đề văn bản 14px/500, body 14px/1.6, meta 12px. `body` điều khoản dùng độ cao dòng 1.6 vì là văn bản pháp lý dài.
- **Màu**: nền trung tính, chữ gần đen. Một màu accent duy nhất cho hành động chính. Trạng thái: xanh lá cho khoảng hiệu lực chứa `asOf`, xám cho đã hết hiệu lực, hổ phách cho cảnh báo, đỏ cho lỗi. Không dùng màu làm kênh thông tin duy nhất — badge luôn kèm chữ.
- **Spacing**: thang 4px. Card padding 16px, khoảng cách giữa các card 12px.
- **Density**: một card cao khoảng 140–180px ở trạng thái rút gọn.
- **Contrast**: tối thiểu WCAG AA 4.5:1 cho chữ, 3:1 cho viền control.

## 6. Responsive

| Breakpoint | Hành vi |
|---|---|
| ≥1024px | SearchBar 3 control trên một hàng; detail mở side panel phải rộng 480px, list vẫn nhìn thấy |
| 640–1023px | SearchBar xuống 2 hàng (q một hàng; asOf + limit + nút một hàng); detail mở sheet phủ toàn màn |
| <640px | Mỗi control một hàng, nút "Tra cứu" full width; card rút gọn còn 2 dòng body; pagination là hai nút full width |

## 7. Accessibility

- Mỗi input có `<label>` thật, không chỉ placeholder.
- Vùng kết quả là `aria-live="polite"`; khi search xong thông báo số kết quả trên trang.
- Lỗi field gắn `aria-describedby` tới message và `aria-invalid` khi sai.
- Loading skeleton đặt `aria-busy="true"` trên container, không tạo hàng chục node cho screen reader đọc.
- Focus sau khi mở detail panel chuyển vào panel; đóng panel trả focus về card đã bấm.
- Toàn bộ thao tác làm được bằng bàn phím: Tab qua các control, Enter submit, Esc đóng panel.

## 8. Design assumptions

Những điều UI cần nhưng `api-contract.md` v0.2 / `mcp-tools.md` v0.2 **chưa có**. Frontend không được tự suy diễn; mỗi mục có phương án tạm để demo vẫn chạy.

| ID | Giả định / thiếu hụt | Vì sao UI cần | Phương án tạm trong v0.1 | Cần ai chốt |
|---|---|---|---|---|
| DA-01 | **Không có `total` số kết quả.** Pagination chỉ có `{limit, offset, hasMore}`. | Người dùng muốn biết "có bao nhiêu điều khoản khớp". | Không hiển thị tổng. Copy dùng "Đang xem 1–20". Không vẽ số trang. | Backend (nếu muốn thêm `total`) |
| DA-02 | **Không có snippet / highlight offset.** API trả `body` đầy đủ, không trả đoạn khớp. | Card cần đoạn trích cho thấy vì sao kết quả khớp. | Rút gọn `body` từ đầu bằng CSS line-clamp. Highlight phía client là **tùy chọn và gần đúng**: search là full-text có tách token nên match chuỗi ở client có thể tô không đúng chỗ. Nếu có highlight thì chỉ để dẫn mắt, không dùng để khẳng định "khớp ở đây". | Backend (nếu muốn thêm `snippet`) |
| DA-03 | **Không có thứ tự sắp xếp được công bố cho `items` của search.** Contract không nói sort theo relevance hay theo gì. | UI đang mặc định hiển thị theo đúng thứ tự API trả. | Giữ nguyên thứ tự API. **Không** thêm control "Sắp xếp theo". Không nói với người dùng đây là thứ tự độ liên quan. | Backend + DB |
| DA-04 | **`hasMore` có thể là `null` khi limit=100** (C-04 chưa đóng). | Nút "Trang sau" cần biết bật hay tắt. | Xử lý theo mục 4.7: thăm dò kèm copy riêng. Nếu C-04 đóng theo hướng luôn trả boolean thì xóa nhánh này. | Backend + DB |
| DA-05 | **Không có endpoint gợi ý từ khóa / autocomplete.** | Người dùng gõ sai từ sẽ không có kết quả và không biết nên gõ gì. | Không làm autocomplete. Bù bằng empty state có hướng dẫn cách tìm và vài ví dụ từ khóa tĩnh viết cứng trong UI copy. | Backend (ngoài scope v0.2) |
| DA-06 | **Search không tìm theo `title` hay `documentNumber`** (chỉ heading/body, full-text `simple`, phân biệt dấu, mọi từ trong query đều phải khớp). | Người dùng rất hay gõ số hiệu văn bản vào ô search. | UI dùng heuristic phía client phát hiện chuỗi trông giống số hiệu (có `/`, lẫn chữ và số) và hiện hint rằng tìm kiếm không nhận số hiệu văn bản. Chỉ là hint, **không** đổi request. | Design (đã quyết) + Backend review |
| DA-07 | **Không có cách liệt kê văn bản để người dùng bắt đầu khi chưa có từ khóa** (`list_tax_documents` bị chặn C-03). | Trang lần đầu vào trống trơn. | First-run state là hướng dẫn tĩnh, không gọi API. Không có mục "văn bản phổ biến". | Backend + DB (C-03) |
| DA-08 | **Timeline chưa chốt policy khi document không có approved version** (C-05: 200 rỗng hay 404). | Màn timeline cần biết render empty hay NOT_FOUND. | Không build timeline trong v0.1. Có phác thảo ở `interaction-flow.md` mục P2 nhưng đặt sau feature flag tắt. | Backend + Coordinator (C-05) |
| DA-09 | **`versionId` là chuỗi số lớn (bigint serialize thành string)**, không phải nhãn thân thiện. | Không nên đưa ra cho người dùng cuối như thông tin chính. | Dùng làm React key. Hiển thị chỉ trong khối "Thông tin phiên bản" ở detail, nhãn "Mã phiên bản", kèm nút copy. | — (quyết định design) |
| DA-10 | **Ngày là chuỗi `YYYY-MM-DD` không kèm timezone.** | Nếu FE parse qua `new Date()` rồi format theo local timezone sẽ lệch một ngày. | Bắt buộc coi là ngày lịch thuần: tách chuỗi để format, không đưa qua `Date`/UTC. Ghi rõ ở `component-guidelines.md`. | — (quyết định design) |
| DA-11 | **Không có field ngôn ngữ / i18n.** | Nội dung điều khoản là tiếng Việt có dấu và search phân biệt dấu. | UI tiếng Việt. Không làm bộ chuyển ngôn ngữ. Không tự bỏ dấu từ khóa trước khi gửi vì sẽ làm hỏng kết quả. | — (quyết định design) |
| DA-12 | **`sourceUrl` không được backend kiểm chứng domain và tool không fetch nó.** | Link ngoài là bề mặt rủi ro. | Coi là link ngoài không tin cậy: `rel="noopener noreferrer"`, hiện hostname trước khi người dùng bấm, không nhúng iframe, không preview. | Design (đã quyết) |
| DA-13 | **Quan hệ ở cấp văn bản, không ở cấp điều khoản.** `GET /relations` nhận `documentNumber`, không nhận `articleKey`, và `RelationItem` không nói điều nào bị sửa/bãi bỏ. | Người dùng đang xem một điều cụ thể và muốn biết chính điều đó có bị sửa không. | Mọi câu chữ nói về **văn bản**, không nói "điều khoản này đã bị sửa". Cảnh báo dùng "có thể" và hướng người dùng đối chiếu văn bản kia. Không suy đoán điều bị ảnh hưởng. | Backend (nếu muốn thêm phạm vi điều khoản) |
| DA-14 | **Contract không công bố thứ tự của `outgoing` / `incoming`.** | Danh sách cần thứ tự ổn định. | Giữ nguyên thứ tự API trả, không tự sắp xếp, không nói gì về thứ tự. | Backend |
| DA-15 | **Không có màn xem văn bản liên quan trong app** (C-01: không có document detail không kèm `articleKey`). | Người dùng muốn "đi tới" văn bản sửa đổi. | Số hiệu văn bản liên quan là chữ thường, **không** phải link/nút. Chỉ có link nguồn ngoài `sourceUrl` của mục quan hệ. | Backend (C-01) |
| DA-16 | **`effectiveFrom`/`effectiveTo` của `RelationItem` là khoảng hiệu lực của quan hệ**, không nhất thiết trùng khoảng hiệu lực version của điều khoản đang xem. Hai nguồn này có thể trông mâu thuẫn (ví dụ điều khoản vẫn được trả tại `asOf` trong khi văn bản có quan hệ bãi bỏ đang hiệu lực). | UI không được tự hòa giải hai khoảng. | Hiển thị cả hai nguyên trạng: badge của điều khoản giữ nguyên, cảnh báo quan hệ hiện riêng. Không đổi trạng thái badge điều khoản dựa trên quan hệ. | Backend + DB (xác nhận ngữ nghĩa) |
| DA-17 | **`404 NOT_FOUND` từ `/relations` khi điều khoản đã hiển thị được** là trường hợp bất thường (văn bản có trong search nhưng không có trong dữ liệu quan hệ). | Cần copy riêng, không được hiểu là "không có quan hệ". | Hiện lỗi nhỏ trong mục, nói rõ chưa kiểm tra được quan hệ; không hiện empty state. | Backend (xác nhận có thể xảy ra hay không) |
| DA-18 | **`label` là chuỗi hiển thị, không phải khóa logic.** | Cảnh báo cần biết quan hệ nào là bị bãi bỏ / bị sửa đổi. | FE hiển thị `label` nguyên văn trong danh sách, nhưng quyết định có cảnh báo hay không **chỉ** dựa vào `relationType` và mảng chứa nó (`incoming`), không phân tích chuỗi `label`. | — (quyết định design) |

Không assumption nào trong bảng này yêu cầu đổi API contract. Nếu Backend muốn đóng DA-01/DA-02/DA-04 thì đó là thay đổi contract thuộc Backend Agent; Design sẽ cập nhật spec sau.

## 9. Conflict đã biết ảnh hưởng tới UI

| Conflict | Ảnh hưởng UI | Ứng xử của design v0.1 |
|---|---|---|
| C-01 document detail chưa có query | Không có màn "xem toàn bộ điều khoản của văn bản" | Bỏ khỏi MVP. Card không có nút "Xem cả văn bản". |
| C-02 timeline chưa có query | Không có màn lịch sử hiệu lực | Bỏ khỏi MVP |
| C-03 list documents chưa có query | Không có trang danh sách văn bản, không có dữ liệu cho first-run | DA-07 |
| C-04 `hasMore` null ở limit=100 | Pagination không chắc chắn | DA-04, mục 4.7 |
| C-05 policy timeline rỗng vs 404 | Empty state của timeline chưa quyết được | DA-08 |

## 10. Ngoài phạm vi v0.1

Không thiết kế: đăng nhập/phân quyền, lưu tra cứu, so sánh hai version cạnh nhau, tải PDF, bình luận, dark mode, biểu đồ, thông báo. Những thứ này chưa có dữ liệu hoặc endpoint hỗ trợ và sẽ làm Frontend không kịp demo.

## 11. Văn bản liên quan (trong panel chi tiết)

Nguồn dữ liệu: `GET /relations?documentNumber={p.documentNumber}&asOf={selection.asOf}`. `asOf` là ngày của lần tra đã mở panel (giống phần còn lại của panel), **không** phải ngày hôm nay hay giá trị đang gõ trong ô.

Mục tiêu: cho người dùng biết văn bản chứa điều khoản đang xem có bị văn bản khác bãi bỏ / thay thế hoặc sửa đổi tại ngày tra cứu hay không, và liệt kê các quan hệ khác để tự kiểm chứng qua link nguồn.

### 11.1 Vị trí trong panel

Hai phần, cùng lấy từ **một** request:

```
┌ Panel chi tiết ─────────────────────────────────┐
│ Chi tiết điều khoản                     [Đóng]  │
│ [Điều 9] heading                                │
│ 48/2024/QH15 · title                            │
│ (EffectiveBadge của điều khoản)                 │
│ ┌ A. RelationAlert (chỉ khi có) ──────────────┐ │
│ │ ⚠ Văn bản 48/2024/QH15 có văn bản sửa đổi,  │ │
│ │   bổ sung đang có hiệu lực tại 24/09/2026   │ │
│ │ • Được sửa đổi, bổ sung bởi 204/2025/QH15   │ │
│ │ Xem văn bản liên quan                       │ │
│ └─────────────────────────────────────────────┘ │
│ body đầy đủ …                                   │
│ [Xem nguồn ↗] [Sao chép link nguồn]             │
│ ── B. Văn bản liên quan ─────────────────────── │
│ Quan hệ có hiệu lực tại ngày 24/09/2026         │
│ Văn bản khác tác động lên văn bản này           │
│  ┌ RelationItem ─────────────────────────────┐  │
│  │ [Được sửa đổi, bổ sung bởi]               │  │
│  │ 204/2025/QH15 · title                     │  │
│  │ Từ 01/07/2025 đến hết 31/12/2026          │  │
│  │ Xem nguồn ↗ hostname                      │  │
│  └───────────────────────────────────────────┘  │
│ Văn bản này tác động lên văn bản khác           │
│  … (ẩn nhóm nếu rỗng)                           │
│ ── Thông tin phiên bản ──────────────────────── │
└─────────────────────────────────────────────────┘
```

- **A. RelationAlert**: ngay dưới `EffectiveBadge`, trên `body`. Chỉ render khi request thành công **và** `incoming` có ít nhất một mục `relationType` là `repeals` hoặc `amends`. Không render gì ở vị trí này khi loading, rỗng, lỗi, hoặc chỉ có quan hệ khác.
- **B. Mục "Văn bản liên quan"**: sau khối nguồn (`detail-source`), trước khối "Thông tin phiên bản". Mục này luôn render (có tiêu đề) và chứa mọi trạng thái loading / rỗng / lỗi.

### 11.2 Cảnh báo (RelationAlert)

Đây là phần quan trọng nhất của tính năng. Quy tắc:

| Điều kiện trong `incoming` | Tiêu đề cảnh báo | Token |
|---|---|---|
| Có ít nhất một `repeals` | `relations.alert.repeals.title` | `--warn-bg`, `--warn-text`, `--warn-border` (lớp `.banner .banner-warning` có sẵn) |
| Không có `repeals`, có ít nhất một `amends` | `relations.alert.amends.title` | như trên |
| Cả hai | Dùng tiêu đề `repeals` (nặng hơn), danh sách bên dưới liệt kê **cả** mục `repeals` và `amends` | như trên |

- Dùng màu cảnh báo (hổ phách), **không** dùng `--error-*`: đây là thông tin nghiệp vụ, không phải sự cố hệ thống.
- Viền trái dày 4px bằng `--warn-border` (giống `.card-data-error`) để nổi hơn banner stale thông thường.
- Nội dung: tiêu đề (đậm) → một câu giải thích → danh sách gạch đầu dòng, mỗi dòng: `{label} {documentNumber}, {khoảng hiệu lực}` → link nội bộ "Xem văn bản liên quan" cuộn tới mục B và chuyển focus vào tiêu đề mục B.
- Thứ tự dòng: mục `repeals` trước, `amends` sau; trong cùng loại giữ thứ tự API.
- Có ký hiệu cảnh báo trước tiêu đề nhưng là trang trí (`aria-hidden`); tiêu đề chữ tự đủ nghĩa.
- Không đổi màu/trạng thái `EffectiveBadge` của điều khoản vì cảnh báo này (DA-16).
- Chỉ `incoming` mới gây cảnh báo. `outgoing` repeals/amends (văn bản đang xem sửa văn bản khác) và mọi `guides` / `consolidates` **không** gây cảnh báo.

### 11.3 Mỗi mục quan hệ (RelationItem)

Thứ tự đọc, không được bỏ vùng nào:

| Vùng | Field | Hiển thị |
|---|---|---|
| Nhãn quan hệ | `label` | Nguyên văn từ API. Dạng tag nhỏ. Với `incoming` + `repeals`/`amends`: lớp `.warn-label` (warn tokens). Còn lại: viền `--border-soft`, chữ `--muted`. |
| Văn bản | `documentNumber` · `title` | `documentNumber` đậm 14px/600, `title` 14px `--text`. Là chữ thường, **không** phải link (DA-15). `title` tối đa 2 dòng rồi ellipsis. |
| Khoảng hiệu lực | `effectiveFrom`, `effectiveTo` | Text 12px `--muted`, dùng lại đúng câu của badge: `card.effective.open` / `card.effective.closed`. Không tô màu xanh "applicable" — tránh nhầm với trạng thái hiệu lực của điều khoản. |
| Nguồn | `sourceUrl` | Dùng lại `SourceLink` (tab mới, hostname, xử lý URL không hợp lệ như card). |

Mỗi mục là một khối viền `--border-soft`, bo 6px, padding 12px, cách nhau 8px. `relationType` không hiển thị ra chữ (đã nằm trong `label`).

### 11.4 Nhóm

- Hai nhóm, thứ tự cố định: `incoming` trước ("Văn bản khác tác động lên văn bản này"), `outgoing` sau ("Văn bản này tác động lên văn bản khác"). Lý do: `incoming` là thứ ảnh hưởng tới hiệu lực của nội dung đang đọc.
- Nhóm rỗng thì ẩn cả tiêu đề nhóm. Cả hai rỗng thì hiện trạng thái rỗng.
- Dưới tiêu đề mục luôn có dòng ngữ cảnh `relations.context` kèm `asOf` — cùng lý do với `ResultContext`.

### 11.5 Trạng thái

| Trạng thái | Mục B hiển thị | Vị trí A |
|---|---|---|
| `loading` | Dòng `relations.loading` (12px `--muted`) + 2 thanh skeleton `.sk`; container `aria-busy="true"` | Không có gì |
| `success`, có dữ liệu | Dòng ngữ cảnh + nhóm như 11.4 | Cảnh báo nếu thỏa 11.2 |
| `success`, hai mảng rỗng | `relations.empty` + `relations.empty.note` (14px `--muted`) | Không có gì |
| `error` | Banner nhỏ `.banner .banner-error` **trong mục B**, copy theo mã lỗi (`ui-copy.md` mục 10.1), kèm `requestId` + nút sao chép; nút "Thử lại" chỉ với 503/500/lỗi mạng | Không có gì |

Quy tắc bắt buộc:

- **Lỗi của mục này không bao giờ ảnh hưởng phần còn lại của panel.** Heading, badge, body, nguồn, "Thông tin phiên bản" đã hiển thị thì giữ nguyên. Không đóng panel, không thay panel bằng `ErrorState`, không hiện banner ở danh sách kết quả phía sau.
- Khi lỗi, copy phải nói rõ **chưa kiểm tra được** việc sửa đổi/bãi bỏ. Vắng cảnh báo A trong lúc loading/lỗi không có nghĩa là văn bản còn nguyên.
- Trạng thái rỗng nói "trong dữ liệu hiện có", không khẳng định văn bản chưa từng bị sửa đổi.
- Thử lại chỉ gọi lại `/relations`, không tải lại điều khoản.

### 11.6 Responsive và accessibility

- Panel đã là 480px (desktop) / toàn màn hình (mobile); mục này chỉ xếp dọc, không cần breakpoint riêng.
- Mục B là `<section aria-labelledby>` với `<h3>` "Văn bản liên quan" (có `tabindex="-1"` để nhận focus từ link trong cảnh báo).
- Cảnh báo A có `role="status"` để screen reader đọc khi xuất hiện (không dùng `alert`/`assertive`).
- Mỗi nhóm là `<ul>`, mỗi mục là `<li>`.
- Thứ tự Tab trong panel: Đóng → "Xem văn bản liên quan" (nếu có cảnh báo) → Xem nguồn / Sao chép link nguồn → nguồn của từng mục quan hệ → Thử lại / Sao chép mã (nếu lỗi) → Sao chép mã phiên bản. Focus trap hiện có tự bao gồm các phần tử mới.
