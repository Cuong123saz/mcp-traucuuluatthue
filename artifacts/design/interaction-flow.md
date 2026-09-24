# Interaction Flow — Legal Lookup Mini Platform

Phiên bản: v0.1 (2026-09-24). Phạm vi: luồng P0 gồm `search_tax_law` và `get_tax_provision`.

Ký hiệu: `→` là chuyển bước, `⟂` là nhánh rẽ. Tên field và mã lỗi bám đúng `artifacts/backend/api-contract.md` v0.2.

## 1. Flow chính — Tra cứu điều khoản theo từ khóa

```
[Vào trang]
   │  asOf prefill = hôm nay (local), q rỗng, limit = 20
   ▼
[EmptyState: first-run]            ← không gọi API
   │  người dùng nhập q, có thể đổi asOf / limit
   ▼
[Bấm Tra cứu hoặc Enter]
   │
   ├─⟂ q rỗng hoặc > 300 ký tự       → lỗi dưới ô q, KHÔNG gọi API
   ├─⟂ asOf rỗng hoặc không hợp lệ   → lỗi dưới ô asOf, KHÔNG gọi API
   │
   ▼
[queryState = {q(trim), asOf, limit, offset: 0}]
[LoadingState: skeleton x min(limit,5)]
   │
   ▼
GET /search?q&asOf&limit&offset      (hoặc MCP search_tax_law cùng tham số)
   │
   ├─⟂ 200, items.length > 0  → [ResultList] (mục 2)
   ├─⟂ 200, items.length = 0  → [EmptyState: no-results] (mục 4.2)
   ├─⟂ 400 INVALID_ARGUMENT   → [ErrorState] gắn vào ô nhập nếu xác định được field
   ├─⟂ 503 / 500              → [ErrorState] có nút Thử lại
   └─⟂ lỗi mạng               → [ErrorState: network] có nút Thử lại
```

Điểm bắt buộc:

- `asOf` **luôn** có trong request. UI không bao giờ gửi thiếu để backend tự điền — contract trả `400`.
- `offset` reset về 0 ở mọi lần submit mới và mọi lần đổi `limit`.
- `ResultContext` hiển thị `asOf` của `queryState`, không phải của ô nhập.

## 2. Trạng thái có kết quả

```
[ResultList]
   ├─ ResultContext: "Kết quả áp dụng tại ngày {asOf}"
   ├─ ProvisionCard × n   (n = items.length ≤ limit)
   └─ Pagination
```

Người dùng làm được:

| Thao tác | Kết quả |
|---|---|
| Bấm "Xem nguồn" | Mở `sourceUrl` ở tab mới. Trang hiện tại không đổi state. |
| Bấm "Xem chi tiết" | Mở detail panel (mục 3) |
| Bấm "Trang sau" / "Trang trước" | Đổi `offset`, gọi lại search, cuộn lên đầu danh sách |
| Đổi `limit` | `offset = 0`, gọi lại search ngay |
| Sửa `q` hoặc `asOf` | Đánh dấu stale (mục 5), **không** tự gọi API |

## 3. Flow phụ — Xem chi tiết một điều khoản

```
[ProvisionCard] Bấm "Xem chi tiết"
   │  lấy documentNumber, articleKey từ card
   │  lấy asOf từ queryState (KHÔNG phải ngày hôm nay, KHÔNG phải ô nhập)
   ▼
[Mở panel, focus chuyển vào panel]
[LoadingState trong panel]
   │
   ▼
get_tax_provision { documentNumber, articleKey, asOf }
  (REST tương đương: GET /documents/{number}?asOf=…&articleKey=…)
   │
   ├─⟂ 200 → [Detail: heading, documentNumber · title, EffectiveBadge,
   │          body đầy đủ (pre-wrap), SourceLink + copy,
   │          khối "Thông tin phiên bản": versionId, asOf]
   │
   ├─⟂ 404 NOT_FOUND → [ErrorState trong panel]
   │       Copy nói rõ: không có điều khoản này đã duyệt tại ngày {asOf},
   │       hệ thống không chuyển sang phiên bản khác.
   │       KHÔNG tự tra lại với ngày khác. KHÔNG gợi ý version gần nhất.
   │
   └─⟂ 400 / 409 / 503 / 500 → [ErrorState trong panel] theo bảng mã lỗi
   │
   ▼
[Esc hoặc bấm Đóng] → đóng panel, trả focus về nút "Xem chi tiết" của card nguồn
```

Ghi chú:

- Panel không đóng khi danh sách phía sau thay đổi. Nếu người dùng search lại trong lúc panel mở, panel giữ nguyên nội dung cũ; `asOf` hiển thị trong panel vẫn là `asOf` đã dùng để lấy nội dung đó.
- 404 ở đây là kết quả nghiệp vụ hợp lệ, không phải sự cố hệ thống. Copy không được mang giọng "đã xảy ra lỗi".

## 3a. Flow phụ — Văn bản liên quan trong panel

Chạy song song với việc hiển thị nội dung điều khoản, bắt đầu ngay khi panel mở. Đặc tả: `design-spec.md` mục 11.

```
[Panel mở với selection {provision, asOf}]
   │  nội dung điều khoản render ngay (không chờ)
   │  RelatedDocuments: status = loading  (vị trí cảnh báo: trống)
   ▼
GET /relations?documentNumber={provision.documentNumber}&asOf={selection.asOf}
   │
   ├─⟂ 200, incoming có repeals/amends
   │       → RelationAlert xuất hiện dưới EffectiveBadge (role="status")
   │       → RelatedDocuments: ngữ cảnh + nhóm incoming / outgoing
   │
   ├─⟂ 200, có quan hệ nhưng không có incoming repeals/amends
   │       → không cảnh báo; RelatedDocuments hiển thị danh sách
   │
   ├─⟂ 200, incoming = [] và outgoing = []
   │       → RelatedDocuments: relations.empty + relations.empty.note
   │
   ├─⟂ 404 NOT_FOUND / 409 DATA_INTEGRITY_ERROR
   │       → banner lỗi nhỏ TRONG mục, có requestId, KHÔNG có Thử lại
   │
   └─⟂ 503 / 500 / lỗi mạng
           → banner lỗi nhỏ TRONG mục, có requestId (nếu có) và Thử lại
                  └─ bấm Thử lại → chỉ gọi lại /relations, status = loading
```

Điểm bắt buộc:

- Mọi nhánh lỗi chỉ ảnh hưởng mục "Văn bản liên quan". Heading, badge, body, nguồn, "Thông tin phiên bản" giữ nguyên; panel không đóng, không chuyển sang `ErrorState` toàn panel.
- `asOf` là của selection (lần tra đã mở panel). Người dùng đổi ngày ở ô nhập hoặc search lại khi panel đang mở: không gọi lại `/relations`, không đổi nội dung mục.
- Mở điều khoản khác (selection đổi) → hủy/bỏ qua response cũ, chạy lại flow này. Đóng panel → hủy request.
- Bấm "Xem văn bản liên quan" trong cảnh báo → cuộn tới mục, focus vào tiêu đề mục. Bấm "Xem nguồn" của một mục → mở tab mới, panel không đổi.
- Số hiệu văn bản liên quan không bấm được; không có điều hướng sang văn bản đó trong app (DA-15).

## 4. Chi tiết các state

### 4.1 Loading

- Bắt đầu ngay khi submit, kết thúc khi có response hoặc lỗi.
- Skeleton giữ đúng hình dáng card để trang không nhảy layout.
- SearchBar không bị khóa: người dùng sửa từ khóa được trong lúc chờ.
- Nếu người dùng submit lần nữa khi request trước chưa xong: hủy/bỏ qua response cũ, chỉ render response mới nhất.

### 4.2 Empty

| Nguyên nhân | Điều kiện | Variant |
|---|---|---|
| Chưa tra cứu lần nào | `status = idle` | `first-run` |
| Không khớp | `200`, `items = []`, `offset = 0` | `no-results` |
| Hết trang | `200`, `items = []`, `offset > 0` | `end-of-results` |

`no-results` phải nêu ngày `asOf` trong tiêu đề và nêu 4 gợi ý ở `ui-copy.md` mục 7.2, trong đó có hai giới hạn thật của hệ thống: mọi từ đều phải khớp, và tìm kiếm phân biệt dấu.

`end-of-results` đưa nút quay về trang trước để người dùng không kẹt ở trang rỗng.

### 4.3 Error

```
response
   ├─ có error.code   → map theo bảng ở component-guidelines.md mục 13
   └─ không parse được / mất mạng → error.network
```

- Lỗi hiện dạng banner phía trên danh sách (hoặc trong panel nếu phát sinh từ detail).
- Không xóa kết quả đang hiển thị; kết quả cũ giữ lại kèm nhãn stale.
- `requestId` luôn hiện khi có, kèm nút sao chép.
- Nút "Thử lại" chỉ có ở `DEPENDENCY_UNAVAILABLE`, `INTERNAL_ERROR` và lỗi mạng. `INVALID_ARGUMENT` và `NOT_FOUND` không có, vì thử lại cùng tham số sẽ cho cùng kết quả.
- Không retry tự động.

## 5. Stale results — đổi điều kiện mà chưa submit

Đây là rủi ro nghiệp vụ lớn nhất của màn này: người dùng đổi ngày rồi đọc kết quả của ngày cũ.

```
[Có kết quả cho queryState A]
   │  người dùng sửa q hoặc asOf trong form (formState B ≠ A)
   ▼
[Kết quả vẫn hiển thị, nhưng:]
   ├─ hiện dải thông báo result.stale kèm asOf của A
   ├─ ResultContext vẫn hiển thị asOf của A
   └─ nút Tra cứu được làm nổi bật
   │
   ├─⟂ người dùng bấm Tra cứu → chạy lại flow mục 1 với B
   └─⟂ người dùng sửa về đúng A → bỏ nhãn stale
```

Không tự động search lại khi `asOf` đổi. Lý do: người dùng có thể đang đọc dở một điều khoản dài, và việc danh sách tự thay đổi dưới tay là mất ngữ cảnh. Việc gọi lại API phải là hành động có chủ ý.

## 6. Pagination — bao gồm nhánh `hasMore = null`

```
[Có kết quả, pagination = {limit, offset, hasMore}]
   │
   ├─⟂ hasMore === true   → "Trang sau" bật bình thường
   ├─⟂ hasMore === false  → "Trang sau" disable, hiện pager.end
   └─⟂ hasMore === null   → chỉ xảy ra khi limit = 100 (C-04 chưa đóng)
          │  "Trang sau" vẫn bật, kèm ghi chú pager.unknownMore
          ▼
        [Bấm Trang sau] → offset += limit → gọi search
          ├─⟂ items.length > 0 → hiển thị bình thường
          └─⟂ items.length = 0 → EmptyState end-of-results
                                  và lùi offset về giá trị trước
```

Khi C-04 được đóng theo hướng `hasMore` luôn là boolean, xóa toàn bộ nhánh `null` khỏi UI và khỏi `ui-copy.md` (`pager.unknownMore`, `search.limit.note100`).

## 7. Bàn phím

| Phím | Ngữ cảnh | Hành vi |
|---|---|---|
| `Enter` | Trong ô `q` hoặc `asOf` | Submit form |
| `Tab` | Toàn trang | Đi qua: q → asOf → limit → Tra cứu → từng card (Xem nguồn → Xem chi tiết) → pagination |
| `Esc` | Panel chi tiết đang mở | Đóng panel, trả focus về nút đã mở |
| `Tab` | Trong panel | Focus bị giữ trong panel (focus trap). Thứ tự: Đóng → Xem văn bản liên quan (nếu có cảnh báo) → Xem nguồn → Sao chép link nguồn → nguồn từng mục quan hệ → Thử lại / Sao chép mã (nếu lỗi quan hệ) → Sao chép mã phiên bản |
| `Enter` | Trên "Xem văn bản liên quan" | Cuộn tới mục "Văn bản liên quan", focus vào tiêu đề mục |

## 8. Thông báo cho screen reader

| Thời điểm | Thông báo |
|---|---|
| Bắt đầu tải | `loading.srAnnounce` |
| Tải xong có kết quả | `result.liveRegion` với số lượng và `asOf` |
| Không có kết quả | Tiêu đề của `empty.noResults` |
| Lỗi | Tiêu đề lỗi tương ứng |
| Cảnh báo văn bản bị bãi bỏ / sửa đổi xuất hiện trong panel | Tiêu đề `relations.alert.*.title` (qua `role="status"`) |
| Lỗi tải văn bản liên quan | `relations.error.*.title` |

Vùng kết quả là `aria-live="polite"`. Không dùng `assertive` — tra cứu không phải tình huống khẩn cấp và sẽ cắt ngang việc đọc nội dung.

## 9. Flow P2 — chưa build trong v0.1

Phác thảo để giữ hướng, **không** hiện thực cho tới khi conflict tương ứng đóng.

### 9.1 Timeline văn bản (`get_document_timeline`) — chặn bởi C-02, C-05

```
[ProvisionCard] → "Xem lịch sử hiệu lực"   ← nút này chưa tồn tại trong v0.1
   ▼
get_document_timeline { documentNumber }
   ├─⟂ 200 có versions → danh sách VersionSummary theo effectiveFrom tăng dần
   ├─⟂ 200 versions=[] → ??? CHƯA CHỐT
   └─⟂ 404             → ??? CHƯA CHỐT
```

C-05 chưa quyết giữa "200 với versions rỗng" và "404" cho văn bản chưa có version approved. Hai phương án cần hai empty state khác hẳn nhau về nghĩa: một bên là "văn bản có tồn tại nhưng chưa có nội dung công khai", một bên là "không có văn bản nào như vậy". Design không tự chọn thay Backend/Coordinator.

Lưu ý thêm cho khi build: timeline **không** nhận `asOf` và trả cả version tương lai. UI phải đánh dấu rõ version nào chứa `asOf` đang tra, nếu không người dùng sẽ hiểu nhầm cả danh sách đều đang áp dụng.

### 9.2 Danh sách văn bản (`list_tax_documents`) — chặn bởi C-03

Dự kiến là một trang riêng nhận `asOf` và phân trang, mỗi hàng là `DocumentSummary` kèm version đang áp dụng. Chưa có query Repository nên chưa thiết kế chi tiết. Việc thiếu tool này là lý do first-run state phải là hướng dẫn tĩnh (DA-07).

### 9.3 Toàn bộ điều khoản của một văn bản — chặn bởi C-01

`GET /documents/:number` không kèm `articleKey` cần query metadata theo `asOf` và query list provisions theo version; cả hai chưa có. Vì vậy v0.1 không có đường đi từ một điều khoản sang toàn văn bản.

## 10. Bảng đối chiếu trạng thái

| `status` | Điều kiện | Render |
|---|---|---|
| `idle` | Chưa submit lần nào | `EmptyState first-run` |
| `loading` | Request đang chạy | `LoadingState` (giữ kết quả cũ nếu có, làm mờ) |
| `success` | 200 và `items.length > 0` | `ResultList` + `Pagination` |
| `empty` | 200 và `items.length === 0` | `EmptyState no-results` hoặc `end-of-results` theo `offset` |
| `error` | Lỗi nghiệp vụ hoặc mạng | `ErrorState` + giữ kết quả cũ nếu có |

Frontend render theo `status`, không suy ra trạng thái bằng cách kiểm tra `items.length` rải rác ở nhiều component.
