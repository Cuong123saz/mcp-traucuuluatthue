# Page plan — Frontend MVP

Ngày cập nhật: 2026-09-24. Stack theo phân công: Nuxt/Vue. Đây là kế hoạch hiện thực, chưa phải UI chạy được.

## 1. Phạm vi và căn cứ

Đã đối chiếu `project/brief.md`, `agents/frontend-agent.md`, bốn tài liệu design (`design-spec.md`, `component-guidelines.md`, `ui-copy.md`, `interaction-flow.md`) và hai contract backend v0.2 (`api-contract.md`, `mcp-tools.md`). Đường dẫn người giao việc ghi `interaction-flow\.md` được hiểu là file thực tế `artifacts/design/interaction-flow.md`.

MVP chỉ có một trang tra cứu và panel chi tiết, phục vụ `search_tax_law` và `get_tax_provision`. Không tạo timeline, list documents, toàn văn bản, nút điều hướng tới các màn này hay gọi API cho chúng. Không cần dựng sẵn các tính năng P2 sau feature flag. Không viết backend, SQL hay thay đổi artifacts design/backend/db.

Giữ nguyên thứ tự `items` do API trả; không sort control, tổng kết quả, số trang, autocomplete hay highlight giả định. Mọi nội dung UI dùng key và chuỗi nguyên văn trong `ui-copy.md`; các ngoại lệ cần thống nhất nằm trong `integration-notes.md`.

## 2. Bố cục trang

Một cột nội dung rộng tối đa 720–880px, căn giữa, gồm:

1. Header: `app.title`, `app.subtitle`.
2. SearchBar: `q`, `asOf`, `limit`, nút Tra cứu và hướng dẫn phạm vi tìm kiếm.
3. Vùng kết quả: ResultContext, thông báo stale/loading/error, ResultList hoặc EmptyState, Pagination.
4. ProvisionDetailPanel: hiển thị độc lập khi mở một điều khoản.

| Kích thước | SearchBar | Detail |
|---|---|---|
| ≥1024px | Ba control cùng hàng | Panel phải rộng 480px; vẫn nhìn thấy danh sách phía sau |
| 640–1023px | q một hàng; ngày, limit, submit hàng sau | Sheet toàn màn hình |
| <640px | Mỗi control một hàng; submit toàn chiều rộng | Sheet toàn màn hình; body card chỉ 2 dòng; hai nút phân trang chia đều chiều rộng |

Giữ font sans hệ thống, card padding 16px, gap 12px; heading 16px/600, title 14px/500, body 14px/1.6, meta 12px. Body card desktop clamp 3 dòng. Không tự đổi design system. Chữ đạt tương phản 4.5:1, biên control 3:1; trạng thái có chữ, không chỉ màu.

## 3. Form và tương tác ban đầu

- Vào trang: q rỗng, limit 20, asOf là hôm nay theo lịch địa phương của client; không gọi API. Nuxt chỉ khởi tạo ngày local ở client, tránh lấy ngày của server khi SSR.
- `q`: input search có label; trim trước validate/gửi; dài 1–300 ký tự. Không bỏ dấu, lowercase hoặc đổi khoảng trắng bên trong. Bộ đếm xuất hiện từ 260 ký tự. Heuristic giống số hiệu chỉ hiện `search.hint.docNumber`, không chặn hay sửa request.
- `asOf`: input date có label, helper, nút Hôm nay; kiểm tra định dạng YYYY-MM-DD và ngày có thật, gồm năm nhuận. Không giới hạn quá khứ/tương lai. Trống hoặc sai thì chặn request.
- `limit`: select 10/20/50/100, mặc định 20; mức 100 hiện `search.limit.note100`.
- Enter hoặc Tra cứu: validate form, gửi q đã trim, asOf tường minh, limit và offset=0. Focus ô sai đầu tiên khi validation thất bại.
- Sửa q/asOf hoặc bấm Hôm nay chỉ thay form và tính stale, không tự search.
- Đổi limit sau một lần tra cứu: nếu form hợp lệ thì coi là submit toàn bộ form hiện tại, offset=0; nếu sai thì báo lỗi, giữ kết quả cũ. Trước lần tra cứu đầu chỉ cập nhật lựa chọn. Đây là giả định FE được ghi ở FE-05.
- Khi tải: input vẫn sửa được, submit hiển thị đang xử lý và disable theo component guideline. Tầng state vẫn phải hủy/bỏ response cũ nếu phát sinh request thay thế, ví dụ đổi limit.

## 4. Nội dung kết quả và chi tiết

Card có đủ chín field của ProvisionResult: `articleKey`, `heading`, `documentNumber`, `title`, `body`, `sourceUrl`, `effectiveFrom`, `effectiveTo`, `versionId`. Tám field đầu hiển thị trên card; versionId dùng làm phần của key và hiển thị trong detail. Không thêm nhãn chất lượng, trạng thái duyệt hoặc điểm relevance do API không trả các field đó.

- Badge: “Từ {from} đến hết {to}”; null dùng “Từ {from} · không thời hạn kết thúc”. Ngày kết thúc bao gồm chính ngày đó.
- Body rút gọn bằng CSS; không cắt chuỗi dữ liệu. Toàn card không phải nút để người đọc bôi đen/copy được.
- Nguồn: link http/https, hiện hostname, mở tab mới với `noopener noreferrer`; không fetch, proxy hoặc preview nguồn.
- Detail: lấy documentNumber/articleKey từ card và **asOf từ snapshot đã tạo ra danh sách đang hiển thị**. Không lấy ngày trong form hoặc ngày của request đang chờ.
- Detail có loading/error riêng, body đầy đủ với `white-space: pre-wrap`, nguồn và copy link, khối “Thông tin phiên bản” gồm versionId dạng string và asOf của request detail.
- NOT_FOUND hiển thị copy nghiệp vụ tại ngày đã tra; không fallback ngày/version, không tự retry.
- Panel giữ ngữ cảnh riêng nếu danh sách được cập nhật. Khi đóng rồi mở card khác, tạo request detail mới; response panel cũ không được ghi đè.

## 5. Ma trận trạng thái

`status` của thao tác search là `idle | loading | success | empty | error`; stale là thuộc tính độc lập, không thay thế status.

| Trạng thái | Điều kiện | Hiển thị / hành vi |
|---|---|---|
| idle | Chưa submit | EmptyState first-run; ví dụ từ khóa tĩnh |
| loading lần đầu | Chưa có snapshot thành công | Skeleton min(limit,5), aria-busy, thông báo polite |
| loading tiếp | Có snapshot trước | Giữ nguyên card và ngày cũ, chỉ báo đang tải; không đổi label sang ngày request mới |
| success | Trang hợp lệ có items | Card theo đúng thứ tự API, ngữ cảnh ngày, số điều khoản trên trang, pagination |
| empty no-results | Thành công, offset=0, items=[] | Dùng ngày response đã xác nhận; đủ bốn gợi ý từ ui-copy §7.2; ẩn pagination |
| empty end-of-results | Thành công, offset>0, items=[] | Thông báo hết trang và nút quay lại; xử lý snapshot ở mục 6 |
| error | Lỗi API/kết nối/envelope | Banner đúng mã, requestId nếu có; giữ snapshot cũ có nhãn rõ; retry chỉ các mã được phép |
| stale | Form chuẩn hóa khác snapshot đang hiển thị | `result.stale` với ngày cũ; context/card/detail vẫn dùng ngày cũ. Sửa form về đúng snapshot thì bỏ nhãn đổi điều kiện |

Nếu refresh cùng tham số bị lỗi, vẫn giữ banner lỗi cho biết lần tải mới thất bại; không dùng câu “Bạn đã đổi điều kiện” khi thực tế không đổi. Có request đang chờ thì nhãn tải còn nguyên kể cả người dùng đã sửa form trở lại. Chi tiết copy còn thiếu được ghi FE-08.

## 6. Phân trang ba giá trị

Phân trang luôn dùng q/asOf/limit của snapshot kết quả đang hiển thị, kể cả form đã sửa. Không vô tình submit bản nháp khi chuyển trang. Trong lúc tải trang mới, khóa Prev/Next để tránh yêu cầu trùng; form vẫn chỉnh được.

| hasMore | Trang sau | Copy |
|---|---|---|
| true | Bật, offset tiếp = offset + limit | `pager.next` |
| false | Tắt | `pager.end` |
| null | Bật để thăm dò, chỉ hợp lệ khi limit=100 | `pager.unknownMore`; không suy ra boolean từ items.length |

Trang trước bật khi offset>0, request offset=max(0,offset-limit). Chỉ hiện “Đang xem {offset+1}–{offset+items.length}” nếu có items; không hiện khoảng 1–0, tổng hay số trang. Cuộn/focus về tiêu đề danh sách sau chuyển trang thành công.

Khi trang kế rỗng: giữ snapshot trang có dữ liệu trước đó nhưng tạm ẩn cards; ghi riêng request/response rỗng và hiện EmptyState end-of-results. Không ghi offset trang trước lên response rỗng. Nút “Quay lại trang trước” khôi phục snapshot cùng q/asOf/limit trước đó, rồi hiển thị lại card và pager; không tự request lặp. Trong màn hết trang ẩn range/Next. Chỉ khôi phục từ chính chuỗi phân trang hiện tại, không từ truy vấn khác. Đây là cách làm rõ yêu cầu “lùi offset” đang mơ hồ, xem FE-04.

## 7. Bàn phím và trợ năng

Label thật, lỗi có aria-describedby/aria-invalid; focus ring luôn thấy và không bị panel che. Không autofocus ô q trên mobile. Một live region polite ngắn thông báo loading, số items trên trang và asOf; skeleton aria-hidden, container aria-busy; không đọc lại toàn bộ body.

Detail dùng role=dialog, aria-modal=true, aria-labelledby, focus trap, Esc/Đóng và trả focus về nút nguồn. Nếu card đã mất sau cập nhật, focus tiêu đề kết quả. Nền inert khi modal mở; không cho tương tác SearchBar xuyên qua modal (FE-06). Nút copy chỉ báo “Đã sao chép” khi clipboard thực sự thành công.

## 8. Tình huống nghiệm thu khi hiện thực

1. Không request lúc vào trang; chặn q trắng/quá dài, ngày thiếu/ngày 31/02; không tự bỏ dấu.
2. Tìm A tại ngày A, sửa form sang ngày B rồi mở detail: request detail vẫn mang ngày A.
3. Submit B trong khi còn cards A: mọi nhãn/card vẫn ngày A đến khi B thành công; B lỗi giữ A; response A đến muộn không ghi đè B.
4. Phân trang khi form bẩn dùng truy vấn đã hiển thị; đổi limit reset offset=0 theo quy tắc mục 3.
5. hasMore true/false/null, null + trang đầy/thiếu/rỗng, Prev tại offset=0; không bao giờ đoán total.
6. Empty đầu trang và empty vượt trang có copy khác nhau; quay về snapshot trước không sai offset hay ngày.
7. Detail 404 không fallback; retry 503/500/mạng giữ nguyên input đã thất bại; đóng panel trước response về không làm panel tự mở.
8. Ngày ở timezone âm/dương không lệch; effectiveTo=null và effectiveTo=asOf đúng copy; versionId lớn không bị làm tròn.
9. Dữ liệu thiếu nguồn, URL nguy hiểm, hiệu lực lệch ngày có cảnh báo; nội dung HTML chỉ hiển thị text.
10. Tab/Enter/Esc, focus restore, screen reader, responsive ba breakpoint; không có sort, timeline hoặc list documents.

Đây là checklist bàn giao, chưa có ứng dụng để chạy các ca kiểm thử này.
