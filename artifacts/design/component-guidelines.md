# Component Guidelines — Legal Lookup Mini Platform

Phiên bản: v0.1 (2026-09-24). Đối tượng: Frontend Agent.

Đây là guideline để code, không phải design system đầy đủ. Mọi tên field bám đúng `artifacts/backend/api-contract.md` v0.2. Frontend không đổi tên field, không thêm field, không suy ra field mới từ dữ liệu.

## 0. Quy ước chung bắt buộc

1. **Ngày là chuỗi, không phải `Date`.** `effectiveFrom`, `effectiveTo`, `asOf` là `YYYY-MM-DD` không timezone. Format bằng cách tách chuỗi (`"2026-01-01" -> "01/01/2026"`). Không dùng `new Date(str)` rồi `toLocaleDateString()` — sẽ lệch một ngày ở timezone âm. Chỉ dùng `Date` khi cần so sánh, và khi đó so sánh chuỗi `YYYY-MM-DD` bằng `<`/`>` cũng đã đúng thứ tự.
2. **`versionId` là string.** Không parse sang number (bigint sẽ mất chính xác). Dùng làm key, so sánh bằng `===` trên string.
3. **`effectiveTo === null` là hợp lệ**, nghĩa là không có ngày kết thúc. Không coi null là lỗi, không render "null", không render khoảng trống.
4. **Không tự thêm default cho `asOf`.** UI prefill ngày hôm nay vào ô nhập, nhưng request luôn mang `asOf` tường minh. Nếu ô trống thì chặn submit ở client, không gửi request thiếu param.
5. **Không gọi API khi chưa đủ input hợp lệ.** Validate `q` và `asOf` ở client trước, dùng đúng ràng buộc của contract để thông điệp lỗi client và server không mâu thuẫn.
6. **Không fetch `sourceUrl`.** Không proxy, không iframe, không preview.
7. **Escape mọi nội dung.** `heading`, `body`, `title` là dữ liệu, không phải HTML. Render dạng text. Nếu có highlight thì dựng bằng node React, không `dangerouslySetInnerHTML`.

## 1. Danh sách component

| Component | Vai trò | Input chính |
|---|---|---|
| `SearchBar` | Gom q + asOf + limit + submit | giá trị form, trạng thái disabled |
| `SearchInput` | Ô từ khóa `q` | value, error |
| `AsOfPicker` | Chọn ngày áp dụng | value (`YYYY-MM-DD`), error |
| `LimitSelect` | Chọn số kết quả/trang | value (10/20/50/100) |
| `ResultContext` | Dòng ngữ cảnh "áp dụng tại ngày…" | asOf đã dùng cho lần search hiện tại |
| `ResultList` | Danh sách kết quả + các state | status, items |
| `ProvisionCard` | Một `ProvisionResult` | provision, asOf |
| `EffectiveBadge` | Khoảng hiệu lực | effectiveFrom, effectiveTo, asOf |
| `SourceLink` | Link nguồn ngoài | sourceUrl |
| `Pagination` | Chuyển trang | limit, offset, hasMore, itemCount |
| `ProvisionDetailPanel` | Chi tiết một điều khoản | documentNumber, articleKey, asOf |
| `RelationAlert` | Cảnh báo văn bản bị bãi bỏ / sửa đổi (trong panel) | incoming, documentNumber, asOf |
| `RelatedDocuments` | Mục "Văn bản liên quan" + các state (trong panel) | documentNumber, asOf |
| `RelationItemRow` | Một `RelationItem` | item, direction |
| `LoadingState` | Skeleton | count |
| `EmptyState` | 3 biến thể | variant |
| `ErrorState` | Lỗi theo code | code, message, requestId, onRetry |

## 2. SearchBar

Một `<form>` thật, submit bằng Enter hoặc nút. Không auto-search.

```
SearchBarValue = { q: string; asOf: string; limit: 10|20|50|100 }
```

Validate trước khi submit, đúng ràng buộc contract:

| Field | Ràng buộc client | Nếu sai |
|---|---|---|
| `q` | trim rồi 1–300 ký tự | chặn submit, hiện lỗi dưới ô |
| `asOf` | khớp `^\d{4}-\d{2}-\d{2}$` và là ngày lịch có thật (31/02 không hợp lệ) | chặn submit, hiện lỗi dưới ô |
| `limit` | thuộc {10,20,50,100} | không thể sai vì là select |

Khi submit: gửi `q` đã trim, `asOf`, `limit`, `offset = 0`.

Trong lúc đang tải: nút submit vào trạng thái đang xử lý và bị disable; các input **không** disable để người dùng vẫn sửa được từ khóa.

## 3. SearchInput (`q`)

- `<input type="search">` có `<label>` thật.
- Không `autoFocus` trên mobile (bật bàn phím che mất hướng dẫn); có `autoFocus` trên desktop ở lần vào trang đầu.
- Hiện bộ đếm `x/300` chỉ khi độ dài ≥ 260.
- **Hint số hiệu văn bản (DA-06):** nếu `q` sau trim khớp heuristic số hiệu (chứa `/` và có cả chữ lẫn số, ví dụ `13/2008/QH12`), hiện hint dưới ô nói rằng tìm kiếm chỉ đọc nội dung điều khoản, không đọc số hiệu. Hint không chặn submit và không đổi giá trị gửi đi.
- Không tự bỏ dấu, không lowercase, không đổi khoảng trắng bên trong. Search phân biệt dấu nên mọi biến đổi phía client đều làm sai kết quả.

## 4. AsOfPicker

- `<input type="date">` là đủ cho demo: đã có sẵn định dạng và validation của trình duyệt, giá trị trả về đúng `YYYY-MM-DD`.
- Label: rõ đây là ngày muốn biết luật áp dụng.
- Giá trị khởi tạo: ngày hôm nay theo local timezone của client, lấy bằng cách ghép năm/tháng/ngày local, không dùng `toISOString()` (hàm đó trả UTC và có thể lệch ngày).
- Không đặt `min`/`max`.
- Có nút phụ "Hôm nay" để đưa về ngày hiện tại.
- Khi giá trị đổi mà danh sách kết quả đang là kết quả của `asOf` cũ, đánh dấu stale (mục 11).

## 5. LimitSelect

- `<select>` với 10 / 20 / 50 / 100, mặc định 20.
- Khi chọn 100, hiện dòng ghi chú nhỏ về việc không xác định được trang sau (DA-04).
- Đổi limit thì `offset = 0` và search lại ngay (đây là thao tác chủ động nên được phép tự gọi API).

## 6. ProvisionCard

Cấu trúc cố định, không cho phép bỏ bớt vùng:

```
<article>
  <header>
    <span class="article-key">{articleKey}</span>
    <h3>{heading}</h3>
  </header>
  <p class="doc-line">{documentNumber} · {title}</p>
  <EffectiveBadge from={effectiveFrom} to={effectiveTo} asOf={asOf} />
  <p class="body-clamp">{body}</p>
  <footer>
    <SourceLink url={sourceUrl} />
    <button>Xem chi tiết</button>
  </footer>
</article>
```

Quy tắc:

- `key` của React là `` `${versionId}:${articleKey}` `` — cặp này là duy nhất vì một version chỉ có một provision cho mỗi `articleKey`. Không dùng index mảng.
- `body` rút gọn bằng CSS (`-webkit-line-clamp: 3`, `<640px` là 2), không cắt chuỗi trong JS. Cắt trong JS sẽ làm rơi mất chữ khi người dùng copy và dễ cắt giữa từ tiếng Việt.
- `heading` có thể dài; cho xuống tối đa 2 dòng rồi ellipsis. `articleKey` không bao giờ bị cắt.
- Toàn card không phải là một nút. Chỉ "Xem chi tiết" và `SourceLink` là interactive, để người dùng bôi đen copy nội dung điều khoản mà không mở panel ngoài ý muốn.
- Không có nút "Xem cả văn bản" trong v0.1 (C-01 chưa đóng).

### Dữ liệu khuyết

`ProvisionResult` theo contract luôn đủ field. Nếu runtime vẫn thiếu, đó là lỗi dữ liệu chứ không phải trạng thái bình thường:

| Thiếu field | Xử lý |
|---|---|
| `sourceUrl` rỗng/không có | Không render link; render nhãn "Thiếu nguồn" ở trạng thái cảnh báo. Vẫn render card. |
| `effectiveFrom` rỗng/không có | Badge chuyển sang trạng thái cảnh báo với nhãn "Thiếu khoảng hiệu lực". |
| `body` rỗng | Render dòng "Điều khoản không có nội dung", không render khoảng trắng trống. |
| `heading` rỗng | Dùng `articleKey` làm tiêu đề. |

Không tự bịa giá trị thay thế và không im lặng bỏ qua card.

## 7. EffectiveBadge

Input: `from: string`, `to: string | null`, `asOf: string`.

Text:

- `to === null`: `"Từ {from} · không thời hạn kết thúc"`.
- ngược lại: `"Từ {from} đến hết {to}"`. Bắt buộc dùng chữ "đến hết" vì khoảng bao gồm cả `effectiveTo`.

Trạng thái (so sánh chuỗi `YYYY-MM-DD` trực tiếp):

| Điều kiện | Trạng thái | Ý nghĩa |
|---|---|---|
| `from <= asOf` và (`to === null` hoặc `asOf <= to`) | `applicable` (xanh) | Đúng như contract đảm bảo |
| khác | `mismatch` (hổ phách) | Bất thường dữ liệu; hiện thêm tooltip/nhãn "Không khớp ngày tra cứu" |

`mismatch` không nên xuất hiện với `search_tax_law` / `get_tax_provision`. Giữ nhánh này để lỗi lộ ra chứ không bị giấu.

Badge luôn có chữ, không chỉ dựa vào màu.

## 8. SourceLink

```
<a href={sourceUrl} target="_blank" rel="noopener noreferrer">
  Xem nguồn <Icon external /> <span class="host">{hostname}</span>
</a>
```

- `hostname` lấy bằng `new URL(sourceUrl).hostname`, bọc `try/catch`; URL không parse được thì hiển thị nhãn "Nguồn không hợp lệ" ở trạng thái cảnh báo và **không** render thẻ `<a>`.
- Chỉ cho phép `http:` và `https:`. Scheme khác thì xử lý như URL không hợp lệ.
- Icon external là trang trí, có `aria-hidden="true"`; text của link đã tự mô tả.

## 9. Pagination

Input: `limit`, `offset`, `hasMore: boolean | null`, `itemCount` (số item đang hiển thị).

- Nhãn giữa: `"Đang xem {offset+1}–{offset+itemCount}"`. Không có tổng (DA-01).
- "Trang trước": bật khi `offset > 0`. Bấm thì `offset = max(0, offset - limit)`.
- "Trang sau":
  - `hasMore === true`: bật, nhãn thường.
  - `hasMore === false`: disable.
  - `hasMore === null`: bật, nhưng kèm dòng ghi chú "Chưa xác định được còn kết quả hay không". Nếu trang kế trả `items: []` thì `EmptyState variant="end-of-results"` và lùi `offset` về giá trị trước để người dùng không kẹt ở trang rỗng.
- Đổi trang giữ nguyên `q`, `asOf`, `limit` và cuộn lên đầu danh sách.
- `itemCount === 0` ở trang đầu: không render Pagination, để `EmptyState` lo.

## 10. ProvisionDetailPanel

Mở bằng `get_tax_provision` với `documentNumber`, `articleKey`, `asOf` lấy từ card đã bấm (dùng đúng `asOf` của lần search, không dùng ngày hôm nay).

- Panel có `role="dialog"`, `aria-modal="true"`, `aria-labelledby` trỏ tới heading.
- Trap focus trong panel; Esc đóng; đóng thì trả focus về nút "Xem chi tiết" của card nguồn.
- Nội dung: cùng field của card nhưng `body` đầy đủ, giữ xuống dòng của nội dung gốc (`white-space: pre-wrap`).
- Khối "Thông tin phiên bản" ở cuối: `Mã phiên bản: {versionId}` (có nút copy), `Tra cứu tại ngày: {asOf}`.
- Panel có state riêng: loading (skeleton trong panel), error (dùng `ErrorState` thu nhỏ, `NOT_FOUND` có copy riêng — xem `ui-copy.md`).
- Không đóng panel khi kết quả list phía sau thay đổi; nếu người dùng search lại trong lúc panel mở, panel vẫn giữ nội dung cũ cho tới khi người dùng đóng.
- Panel chứa thêm `RelationAlert` (dưới `EffectiveBadge`, trên `body`) và `RelatedDocuments` (sau khối nguồn, trước "Thông tin phiên bản"). Xem mục 10a.

## 10a. Văn bản liên quan (`RelationAlert`, `RelatedDocuments`, `RelationItemRow`)

Đặc tả đầy đủ: `design-spec.md` mục 11. Copy: `ui-copy.md` mục 10.1.

### Gọi API

- Một request duy nhất khi panel mở: `GET /relations?documentNumber={provision.documentNumber}&asOf={selection.asOf}`. Hai tham số, không thêm gì khác (contract từ chối tham số lạ).
- `asOf` lấy từ `selection.asOf` (snapshot của lần tra), không từ `formState`, không ngày hôm nay.
- Request chạy **song song, độc lập** với phần nội dung điều khoản. Nội dung điều khoản render ngay, không chờ quan hệ.
- Đổi `selection` (mở điều khoản khác) thì hủy request cũ (`AbortController`) hoặc bỏ qua response không khớp `documentNumber + asOf` hiện tại. Đóng panel thì hủy request.
- Hai điều khoản cùng văn bản cùng `asOf` có thể dùng lại kết quả trong phiên (tùy chọn). Không dùng lại qua `asOf` khác.
- Không retry tự động.

State riêng, tách khỏi `resultState` của search:

```
relationsState = { status: "loading" | "success" | "error",
                   data?: { outgoing: RelationItem[], incoming: RelationItem[] },
                   error?: { code, requestId } }
```

Lỗi ở `relationsState` **không** được ghi vào `resultState`, không đổi state của panel, không đóng panel.

### RelationAlert

Input: `incoming: RelationItem[]`, `documentNumber`, `asOf`. Chỉ render khi `relationsState.status === "success"`.

```
const repeals = incoming.filter(i => i.relationType === "repeals");
const amends  = incoming.filter(i => i.relationType === "amends");
if (repeals.length + amends.length === 0) render nothing;
titleKey = repeals.length > 0 ? "relations.alert.repeals.title" : "relations.alert.amends.title";
bodyKey  = repeals.length > 0 ? "relations.alert.repeals.body"  : "relations.alert.amends.body";
lines    = [...repeals, ...amends];   // giữ thứ tự API trong từng nhóm
```

- Quyết định dựa trên `relationType` + việc nằm trong `incoming`. **Không** phân tích chuỗi `label` (DA-18).
- Markup: `<div class="banner banner-warning" role="status">`, thêm `border-left-width: 4px` (giống `.card-data-error`). Tiêu đề dùng `.banner-title`. Chỉ dùng `--warn-bg`, `--warn-text`, `--warn-border`.
- Mỗi dòng: `relations.alert.line` = `{label} {documentNumber}, {range}` với `{range}` là `relations.alert.range.open` (khi `effectiveTo === null`) hoặc `relations.alert.range.closed` (xem `ui-copy.md`).
- Cuối banner: `<a href="#detail-relations">` với chữ `relations.alert.jump`. Bấm thì cuộn tới mục và `focus()` vào `<h3 id="detail-relations-heading" tabindex="-1">`.
- Không có nút đóng/ẩn cảnh báo.
- Không đổi `EffectiveBadge` của điều khoản.

### RelatedDocuments

```
<section id="detail-relations" class="detail-relations" aria-labelledby="detail-relations-heading" aria-busy={loading}>
  <h3 id="detail-relations-heading" tabindex="-1">Văn bản liên quan</h3>
  … theo status …
</section>
```

- Vị trí: sau `.detail-source`, trước `.detail-meta`. Ngăn cách bằng `border-top: 1px solid var(--border-soft)`, `margin-top: 20px`, `padding-top: 12px` (giống `.detail-meta`). Tiêu đề 14px/700.

| status | Render |
|---|---|
| `loading` | `<p>` `relations.loading` (12px `--muted`) + 2 `.sk` (một thanh `.sk-short`). Không render dòng ngữ cảnh. |
| `success`, `incoming.length + outgoing.length > 0` | `<p>` `relations.context` (12px `--muted`) → nhóm `incoming` (nếu có) → nhóm `outgoing` (nếu có). |
| `success`, cả hai rỗng | `<p>` `relations.context` → `<p>` `relations.empty` (14px) → `<p>` `relations.empty.note` (12px `--muted`). |
| `error` | `<div class="banner banner-error">` theo bảng lỗi dưới. |

Nhóm: `<h4>` 13px/600 `--muted` (`relations.group.incoming` / `relations.group.outgoing`) + `<ul>` không bullet, `gap: 8px`. Nhóm rỗng: không render cả `<h4>`.

Bảng lỗi (copy ở `ui-copy.md` mục 10.1):

| code | Copy | requestId | Thử lại |
|---|---|---|---|
| `NOT_FOUND` (404) | `relations.error.notFound.*` | Có | Không |
| `DATA_INTEGRITY_ERROR` (409) | `relations.error.dataIntegrity.*` | Có | Không |
| `DEPENDENCY_UNAVAILABLE` (503), `INTERNAL_ERROR` (500) | `relations.error.generic.*` | Có | Có |
| `INVALID_ARGUMENT` (400) | `relations.error.generic.*` | Có | Không |
| Mất mạng / không parse được | `relations.error.generic.*` | Không (không có) | Có |

Banner lỗi dùng `.btn .btn-small` cho "Thử lại"; bấm thì `status = loading` và gọi lại chỉ `/relations`.

### RelationItemRow

```
<li class="relation-item">
  <span class="relation-label [warn-label nếu incoming && (repeals|amends)]">{label}</span>
  <p class="relation-doc"><strong>{documentNumber}</strong> · {title}</p>
  <p class="relation-range">{card.effective.open | card.effective.closed}</p>
  <SourceLink url={sourceUrl} />
</li>
```

- `.relation-item`: `background: var(--surface)`, `border: 1px solid var(--border-soft)`, `border-radius: 6px`, `padding: 12px`, flex dọc `gap: 4px`.
- `.relation-label` thường: 12px/600, `color: var(--muted)`, `border: 1px solid var(--border-soft)`, bo 4px, padding `2px 8px`, `align-self: flex-start`. Biến thể cảnh báo dùng lại `.warn-label` có sẵn.
- `.relation-doc`: 14px, `color: var(--text)`; `title` clamp 2 dòng. `documentNumber` không bị cắt.
- `.relation-range`: 12px `--muted`. Dùng đúng hàm format ngày của badge (tách chuỗi, không qua `Date`). **Không** dùng `.badge-applicable` (xanh) cho khoảng này.
- `documentNumber` không phải link, không phải nút (DA-15). Chỉ `SourceLink` là interactive.
- `label` render dạng text nguyên văn, không tự dịch/đổi.
- Dữ liệu khuyết (backend đảm bảo không xảy ra; nếu có): `sourceUrl` hỏng → `SourceLink` tự hiện "Nguồn không hợp lệ"/"Thiếu nguồn"; `effectiveTo === null` → `card.effective.open`; `title` rỗng → chỉ hiện `documentNumber`. Không bỏ qua mục.

## 11. LoadingState và stale results

**LoadingState**

- Skeleton `ProvisionCard`: số lượng `min(limit, 5)`.
- Container có `aria-busy="true"`.
- Không dùng spinner toàn trang. Không chặn tương tác SearchBar.
- Nếu request xong dưới ~150ms thì vẫn render skeleton ít nhất một frame — đừng cố nhấp nháy, nhưng cũng không cần delay nhân tạo.

**Stale results**

Khi người dùng đổi `q` hoặc `asOf` mà chưa submit, danh sách đang hiển thị thuộc về truy vấn cũ. Lúc này:

- Giữ nguyên kết quả, giảm opacity nhẹ hoặc thêm một dải thông báo phía trên danh sách.
- `ResultContext` vẫn hiển thị `asOf` **đã dùng để lấy kết quả**, không phải giá trị đang gõ trong ô. Đây là điểm dễ sai nhất và cũng là điểm nguy hiểm nhất về mặt nghiệp vụ: người dùng sẽ tưởng kết quả đã theo ngày mới.

**Race condition**

Search là thao tác thủ công nhưng người dùng vẫn có thể bấm liên tiếp. Bỏ qua response của request cũ: mỗi lần submit tăng một số thứ tự, khi response về mà số thứ tự không phải mới nhất thì drop. Hoặc dùng `AbortController` hủy request trước.

## 12. EmptyState

Ba biến thể, không dùng chung một copy:

| variant | Khi nào | Nội dung chính |
|---|---|---|
| `first-run` | Chưa search lần nào trong phiên | Hướng dẫn cách tra cứu + ví dụ từ khóa tĩnh (DA-05, DA-07) |
| `no-results` | Search thành công, `items: []` ở `offset = 0` | Nói rõ không có điều khoản khớp **tại ngày đang tra**, gợi ý đổi từ khóa hoặc đổi ngày, kèm giải thích giới hạn của tìm kiếm |
| `end-of-results` | `items: []` ở `offset > 0` | Đã hết kết quả, đưa nút quay lại trang trước |

`no-results` phải nhắc `asOf` hiện tại trong câu, vì "không có kết quả" ở đây luôn gắn với một ngày cụ thể.

## 13. ErrorState

Map theo `error.code` của contract:

| code | HTTP | Hiển thị | Có nút thử lại |
|---|---|---|---|
| `INVALID_ARGUMENT` | 400 | Lỗi ở ô nhập tương ứng nếu xác định được field từ `details`; nếu không thì banner trên danh sách | Không |
| `NOT_FOUND` | 404 | Chỉ xảy ra ở detail panel / tra cứu trực tiếp. Nói rõ không có điều khoản đó tại ngày này và không có fallback sang phiên bản khác | Không |
| `DATA_INTEGRITY_ERROR` | 409 | Banner lỗi dữ liệu, kèm `requestId` | Không |
| `DEPENDENCY_UNAVAILABLE` | 503 | Banner tạm thời, khuyến khích thử lại | Có |
| `INTERNAL_ERROR` | 500 | Banner lỗi chung, kèm `requestId` | Có |
| Không parse được response / mất mạng | — | Banner lỗi kết nối | Có |

Quy tắc:

- **Luôn hiện `requestId`** khi có, dạng chữ nhỏ có nút copy. Đây là cách duy nhất người dùng đối soát được với log.
- Không hiển thị `error.details` thô nếu nó không phải thông điệp dành cho người dùng; dùng `details` để định vị field, còn chữ hiện ra lấy từ `ui-copy.md`.
- Không hiển thị stack, SQL hay raw body — contract đã cấm backend trả những thứ đó, FE cũng không dựng lại.
- Lỗi không xóa kết quả đang có: giữ danh sách cũ và hiện banner phía trên, trừ khi lỗi thuộc chính lần search vừa rồi và danh sách trước đó cũng thuộc truy vấn khác — khi đó vẫn giữ, kèm nhãn stale.

## 14. Tổ chức state

Khuyến nghị tách hai khối state để không nhầm "đang gõ" với "đã tra":

```
formState   = { q, asOf, limit }                 // người dùng đang gõ
queryState  = { q, asOf, limit, offset }         // đã submit, dùng để gọi API
resultState = { status, items, pagination, error, requestId }
```

`ResultContext`, `EffectiveBadge` và `ProvisionDetailPanel` đọc `asOf` từ `queryState`, không bao giờ từ `formState`.

`status` là union: `idle | loading | success | empty | error`. Render theo `status`, không suy ra state bằng cách kiểm tra `items.length` rải rác trong component.

## 15. Gọi API

- REST theo `api-contract.md`; nếu FE đi qua MCP thì payload nghiệp vụ giống hệt (mcp-tools.md đảm bảo cùng Service).
- Gửi `limit`/`offset` tường minh, không dựa vào default của server, để UI và server luôn cùng hiểu một trang.
- Đọc `requestId` ở cả nhánh thành công và lỗi, lưu vào `resultState` để hiện khi cần.
- Không retry tự động. Retry là thao tác người dùng bấm, trừ khi sau này có yêu cầu khác.
- Timeout phía client nên dài hơn một chút so với kỳ vọng của server; hết timeout thì xử lý như lỗi kết nối.

## 16. Những điều Frontend không được làm

- Không thêm tham số không có trong contract (ví dụ `documentNumber` cho `/search` — contract nói rõ không nhận).
- Không tự bỏ `asOf` hoặc thay bằng ngày server.
- Không fallback sang version khác khi `NOT_FOUND`.
- Không tự điều hướng / tự tra điều khoản của văn bản liên quan; không đổi `EffectiveBadge` dựa trên dữ liệu `/relations`.
- Không gộp/ghép nội dung từ nhiều kết quả thành một card.
- Không cache kết quả qua các `asOf` khác nhau rồi tái sử dụng; mỗi `asOf` là một truy vấn riêng.
- Không viết SQL, không gọi DB, không tự dựng lại logic chọn version ở client.
