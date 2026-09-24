# E2E local report — MVP search / detail-from-snapshot

Ngày chạy: 2026-09-24. Vai trò: E2E Local Test Agent. Phạm vi: nghiệm thu đường
**Browser (Vue/Vite) → REST `GET /search` → TaxLawService → PgTaxLawRepository →
PostgreSQL thật → UI**. Không sửa source code.

## 1. Kết luận

**E2E local: PASS cho luồng chính — 9/9 nhóm case đạt trên PostgreSQL thật.**

- Không dùng API mock, không dùng `InMemoryTaxLawRepository`: backend khởi động
  bằng `src/taxlaw/http/server.ts` (composition root nối `PgTaxLawRepository`),
  DB là container PostgreSQL 16.15.
- **Không có lỗi nghiêm trọng chặn E2E → không sửa file code nào.**
- **C-08 không chặn E2E local** (xem §5), nhưng vẫn **chưa đạt** và FR-01 vẫn mở.
- Đây chỉ là bằng chứng cho đường **local dev proxy**. Không chứng minh cấu hình
  deploy (CORS/reverse proxy), accessibility thật (screen reader, Tab trap),
  responsive hay ma trận timezone.

## 2. Môi trường đã dùng

| Thành phần | Giá trị |
|---|---|
| PostgreSQL | container `taxlaw-pg-test` (image `postgres:16`, 16.15), cổng host `5433` |
| Database E2E | `taxlaw_e2e` — **DB riêng**, tạo mới trong cùng container. Không dùng `taxlaw_test` vì suite integration `DROP SCHEMA public CASCADE` mỗi lần chạy. |
| Backend | `npm run start:api`, `PORT=3100`, `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/taxlaw_e2e` |
| Frontend | Vite 8.3.0 dev, `http://localhost:5180`, `TAXLAW_API_PROXY_TARGET=http://127.0.0.1:3100` |
| Browser | Browser pane của Claude desktop (Chromium), viewport 1280×720 |
| Node | v24.19.0 |

**Vì sao không dùng cổng mặc định 3000/5173:** tại thời điểm test, cổng 3000 đang
bị chiếm bởi `smoke-api.mts` của một phiên khác — server này dùng
`InMemoryTaxLawRepository`; cổng 5173 là một Vite dev khác proxy tới nó. **Mở
`http://localhost:5173` lúc đó sẽ KHÔNG phải E2E với PostgreSQL.** Tôi không tắt
các tiến trình đó (không phải của lượt này), mà chạy stack riêng ở 3100/5180.

### Dữ liệu test

1. `artifacts/db/schema.sql` + `artifacts/db/seed.sql` (nguyên bản): 2 documents,
   4 versions (-101 approved 2025, -102 approved từ 2026-01-01, -103 draft,
   -201 rejected), 7 provisions.
2. **Fixture phân trang bổ sung, chỉ nạp vào `taxlaw_e2e`** (không sửa `seed.sql`):
   seed gốc có tối đa 2 kết quả/truy vấn, không đủ để test phân trang với
   limit nhỏ nhất là 10. SQL đã dùng:

```sql
BEGIN;
INSERT INTO documents (id, document_number, title, issuing_body, issued_on, source_url) VALUES
 (-9, 'DEMO-E2E-009', 'Văn bản E2E phân trang', 'Cơ quan minh họa', '2025-12-01', 'https://example.invalid/tax/e2e');
INSERT INTO ingestion_snapshots (id, document_id, source_url, content_sha256, raw_payload) VALUES
 (-91, -9, 'https://example.invalid/tax/e2e/v1', repeat('e', 64), '{"fixture":true}');
INSERT INTO document_versions (id, document_id, version_number, title, source_url, ingestion_snapshot_id, status, approved_at, approved_by, effective_from, effective_to)
VALUES (-901, -9, 1, 'Văn bản E2E phân trang - v1', 'https://example.invalid/tax/e2e/v1', -91, 'approved', '2025-12-20T00:00:00Z', 'fixture-reviewer', '2026-01-01', NULL);
INSERT INTO provisions (id, document_version_id, article_key, heading, body, source_url)
SELECT -9000 - g, -901, lpad(g::text, 2, '0'), 'Điều E2E ' || g, 'Nội dung kiểm thử phân trang e2epage số ' || g || '.', 'https://example.invalid/tax/e2e/v1#article-' || g
FROM generate_series(1, 25) g;
COMMIT;
```

Sau khi nạp: 32 provisions (25 khớp token `e2epage`, approved, hiệu lực từ 2026-01-01).

## 3. Hướng dẫn chạy lại (Git Bash; PowerShell xem ghi chú)

```bash
# 1. PostgreSQL (bỏ qua nếu container taxlaw-pg-test đã chạy)
docker run -d --name taxlaw-pg-test -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=taxlaw_test -p 5433:5432 postgres:16
docker exec taxlaw-pg-test pg_isready -U postgres

# 2. DB E2E riêng + schema + seed (+ fixture phân trang ở §2, lưu ra e2e-fixture.sql)
docker exec taxlaw-pg-test psql -U postgres -c "DROP DATABASE IF EXISTS taxlaw_e2e;" -c "CREATE DATABASE taxlaw_e2e;"
docker exec -i taxlaw-pg-test psql -U postgres -d taxlaw_e2e -v ON_ERROR_STOP=1 < artifacts/db/schema.sql
docker exec -i taxlaw-pg-test psql -U postgres -d taxlaw_e2e -v ON_ERROR_STOP=1 < artifacts/db/seed.sql
docker exec -i taxlaw-pg-test psql -U postgres -d taxlaw_e2e -v ON_ERROR_STOP=1 < e2e-fixture.sql

# 3. Backend (thư mục gốc repo) — terminal 1
PORT=3100 DATABASE_URL="postgres://postgres:postgres@127.0.0.1:5433/taxlaw_e2e" npm run start:api

# 4. Frontend — terminal 2
cd frontend && npm install
TAXLAW_API_PROXY_TARGET=http://127.0.0.1:3100 npx vite --port 5180 --strictPort

# 5. Mở http://localhost:5180
```

PowerShell: đặt biến trước, ví dụ
`$env:PORT="3100"; $env:DATABASE_URL="postgres://postgres:postgres@127.0.0.1:5433/taxlaw_e2e"; npm run start:api`.
Với `psql < file`, dùng `Get-Content file -Raw | docker exec -i ...`.

Nếu cổng 3000/5173 trống thì có thể dùng mặc định (bỏ `PORT`,
`TAXLAW_API_PROXY_TARGET`, `--port`). **Luôn kiểm tra tiến trình đang giữ cổng**
trước khi tin kết quả — xem cảnh báo ở §2.

Kiểm tra nhanh proxy → backend → DB:
`curl "http://localhost:5180/api/search?q=e2epage&asOf=2026-03-01&limit=10&offset=0"`
phải trả 10 item `DEMO-E2E-009`, `hasMore: true`.

## 4. Kết quả từng case

Bằng chứng: text DOM (`innerText`), dialog DOM và log request mạng của browser;
đối chiếu với dữ liệu seed.

| # | Case | Thao tác | Kết quả quan sát | KQ |
|---|---|---|---|---|
| 1 | Mở trang lần đầu không auto-search | Mở `/` | 0 request `/api`. Ô ngày prefill `2026-09-24` (hôm nay local), limit 20, hiển thị hướng dẫn tĩnh "Bắt đầu tra cứu". | **PASS** |
| 2 | Search có kết quả | q=`thuế`, asOf=2025-06-01 | `GET /api/search?q=thu%E1%BA%BF&asOf=2025-06-01&limit=20&offset=0 → 200`. 2 card: Điều 1 "…nội dung cũ. oldonly" và Điều 3 "Điều đã bỏ", cả hai version -101, "Từ 01/01/2025 đến hết 31/12/2025", có link nguồn. "Kết quả áp dụng tại ngày 01/06/2025", "Đã hết kết quả". | **PASS** |
| 2b | Biên ngày (API qua proxy) | asOf 2025-12-31 / 2026-01-01 / 2024-12-31 | -101 (2 item) / -102 (1 item) / rỗng. effectiveTo inclusive, không fallback version. | **PASS** |
| 3 | Search không có kết quả | q=`draftonly` và `rejectedonly`, asOf=2026-03-01 | 200, trang rỗng: "Không có điều khoản nào khớp tại ngày 01/03/2026" + gợi ý. Nội dung draft/rejected **không lộ**. Không có pager/range 1–0. | **PASS** |
| 4 | q/asOf invalid | q=`"   "`; q hợp lệ + asOf rỗng | UI chặn: "Nhập từ khóa để tra cứu." / "Chọn ngày áp dụng." (`aria-invalid` trên asOf). **Không phát sinh request.** Phía server (curl qua proxy): asOf=`2026-02-30`, q trống, `limit=101`, tham số lạ `foo` → 400 `INVALID_ARGUMENT` có `details` + `requestId`. | **PASS** |
| 5 | Stale state | Có kết quả 01/06/2025 → đổi form asOf 2026-03-01, không bấm Tra cứu | Không auto-search. Banner "Bạn đã đổi điều kiện tra cứu. Kết quả bên dưới vẫn là của lần tra trước (ngày 01/06/2025)…"; card vẫn là A. Đổi form về 2025-06-01 → banner mất. | **PASS** |
| 6 | Pagination | q=`e2epage`, asOf 2026-03-01; đổi limit→10; sửa q form thành `thuế`; Next, Next, Prev; rồi limit=100, Next, Back | limit sau submit → search offset=0 (A-03). Trang 1–10 `hasMore=true`; **Next dùng q=e2epage của snapshot** dù form là `thuế` → offset=10 (Điều 11–20), offset=20 (21–25, "Đã hết kết quả", Next disabled). Prev → 11–20. limit=100 → 1–25, `hasMore=null`: "Chưa xác định được còn kết quả hay không…", Next bật; thăm dò offset=100 → "Đã hết kết quả / Quay lại trang trước"; Back khôi phục 1–25 **không gửi request**. Không hiển thị total. | **PASS** |
| 7 | Detail panel dùng result snapshot | Kết quả 01/06/2025 → "Xem chi tiết" Điều 1 | Dialog: nội dung "oldonly", interval 2025, Mã phiên bản `-101`, "Tra cứu tại ngày: 01/06/2025". Số request `/api` trước/sau mở panel: 13 → 13 (**không gọi mạng**). Focus trong dialog, nền `inert`. Esc đóng, focus trả về nút "Xem chi tiết". | **PASS** |
| 8 | Đổi form asOf không làm detail sai ngày | Form asOf → 2026-03-01 (không submit), mở lại detail Điều 1 | Panel vẫn `-101`, "Tra cứu tại ngày: 01/06/2025", nội dung cũ; form đang là 2026-03-01; 0 request mới. | **PASS** |
| 9a | Backend chết (proxy 502) | Tắt backend :3100, submit B (asOf 2026-03-01) | `→ 502 Bad Gateway`. UI: "Không kết nối được / Kiểm tra kết nối mạng rồi thử lại." + nút Thử lại; không bịa requestId. Card A (01/06/2025) giữ nguyên kèm "…kết quả của lần tra cứu thành công trước (ngày 01/06/2025)". Mở detail A sau lỗi B → vẫn `-101`, 01/06/2025. | **PASS** |
| 9b | Backend sống, DB không kết nối | Backend với `DATABASE_URL` trỏ cổng 5499 (không có DB), bấm Thử lại | `→ 503`. UI: "Hệ thống đang tạm thời không phản hồi / Chưa kết nối được tới nguồn dữ liệu…", **Mã yêu cầu `29f74317-…`** khớp log backend `{"errorCode":"DEPENDENCY_UNAVAILABLE"}`. Log backend không chứa query text/SQL. Card A vẫn giữ. | **PASS** |
| 9c | Khôi phục | Backend lại với DB thật, bấm Thử lại | Retry dùng input B đã lỗi (q=thuế, 2026-03-01) → 1 item version `-102` "Từ 01/01/2026 · không thời hạn kết thúc"; detail `-102`, "Tra cứu tại ngày: 01/03/2026". | **PASS** |

Phụ: `GET /api/documents/DEMO-TAX-001` → 404 `NOT_FOUND`, xác nhận REST detail
không tồn tại (đúng scope MVP; frontend không gọi nó).

## 5. C-08 là gì và có chặn E2E không

**C-08 là gì.** Mâu thuẫn giữa Design (design-spec: *không* render card thiếu
`sourceUrl`/`effectiveFrom`) và component-guidelines (giữ card kèm cảnh báo) về
cách xử lý item thiếu/sai provenance (nguồn hoặc khoảng hiệu lực). Coordinator
chốt: không được coi item đó là thành công hợp lệ; phải hiện lỗi dữ liệu rõ, giữ
snapshot hợp lệ trước nếu có, không âm thầm bỏ item. Frontend review phát hiện
**FR-01 (P2)**: `parseSearchSuccess` (`frontend/src/lib/taxLawApi.ts`) chỉ kiểm
identity/text, nên response 200 có item thiếu `sourceUrl` vẫn được commit thành
snapshot, status `success`, ghi đè snapshot A và phát thông báo "Đã tải…".

**Có chặn E2E local không: KHÔNG.** Lý do, kiểm chứng trên stack thật:

1. DB không thể chứa dữ liệu đó: `schema.sql` đặt `source_url NOT NULL` + CHECK
   `^https?://`, `effective_from NOT NULL`, `effective_to > effective_from`.
2. Backend chặn thêm một lớp: `TaxLawService` ném `DATA_INTEGRITY_ERROR` khi
   thiếu/sai nguồn, ngày bắt đầu, ngày kết thúc hoặc interval không chứa `asOf`
   (`src/taxlaw/service/tax-law-service.ts:107-136`), tức trả lỗi, không trả 200.
3. Vì vậy trong luồng Frontend → REST → PostgreSQL thật, payload 200 lỗi
   provenance không phát sinh; mọi item quan sát được ở §4 đều có nguồn/interval
   hợp lệ.

**Nhưng C-08/FR-01 vẫn chưa đạt.** Nhánh này chỉ lộ ra khi có lớp trung gian hoặc
backend tương lai vi phạm contract (proxy lỗi, bug mapper — xem R-01, deploy
khác phiên bản). E2E happy path xanh **không** đóng C-08: cần sửa frontend + test
"valid A → malformed B giữ A, hiện lỗi B, không success announcement" như đã nêu
trong frontend review. E2E với DB thật không tái hiện được ca này nếu không
chèn proxy/mock — ngoài phạm vi lượt này.

## 6. Phát hiện trong lượt E2E (không sửa)

| ID | Mức | Nội dung |
|---|---|---|
| E2E-01 | P3 / Docs | `frontend/README.md` ghi backend "cần DATABASE_URL trong .env", nhưng `server.ts`/`pool.ts` chỉ đọc `process.env`, không nạp `.env`. Chạy `npm run start:api` chỉ với file `.env` sẽ lỗi thiếu `DATABASE_URL`. Cần đặt biến môi trường (như §3) hoặc dùng `node --env-file`/`tsx --env-file`. Owner: Backend/Docs. |
| E2E-02 | P3 / Ops | Cổng mặc định 3000/5173 có thể đang bị server smoke **in-memory** chiếm; mở 5173 sẽ trông như chạy được nhưng không chạm PostgreSQL. Khuyến nghị kiểm tra tiến trình giữ cổng trước khi nghiệm thu. |
| E2E-03 | Ghi nhận UX | Khi B lỗi trong lúc form khác snapshot, cùng lúc hiện 3 thông điệp: banner stale, banner lỗi, dòng "kết quả của lần tra cứu thành công trước". Đúng logic nhưng dư; để Design cân nhắc, không phải lỗi. |
| — | Giới hạn | Client validation chặn mọi input sai nên UI không hiển thị được lỗi 400 của server qua thao tác bình thường; 400 được kiểm bằng curl qua proxy. Native `<input type=date>` không nhận ngày không tồn tại như 2026-02-30. |

FR-01…FR-03 và R-01…R-04 giữ nguyên trạng thái mở; E2E này không kiểm chứng
tương phản (FR-02) hay screen reader (FR-03).

## 7. Chưa nghiệm thu

- Deploy: CORS/reverse proxy (Vite proxy chỉ có ở dev/preview).
- Accessibility thật: Tab/Shift+Tab trap, screen reader, tương phản stale/loading.
- Responsive/mobile, ma trận timezone, trình duyệt khác Chromium.
- Loading state chậm/timeout client (10 s) và race nhiều request liên tiếp trên browser thật.
- REST detail / timeline / list documents: ngoài MVP.

## 8. File thay đổi và trạng thái môi trường

- **Code: không sửa file nào** (`src/**`, `frontend/**`, `tests/**`, `artifacts/db/**` nguyên vẹn).
- Tạo mới: `artifacts/coordinator/e2e-local-report.md` (file này).
- DB: tạo database `taxlaw_e2e` trong container `taxlaw-pg-test` (schema + seed +
  fixture §2). Không đụng `taxlaw_test`. Xóa: `docker exec taxlaw-pg-test psql -U postgres -c "DROP DATABASE taxlaw_e2e;"`.
- Tiến trình: backend :3100 và Vite :5180 của lượt này **vẫn chạy** để có thể xem
  lại; dừng bằng Ctrl+C / đóng tiến trình node tương ứng. Tiến trình :3000/:5173
  của phiên khác không bị động tới.
