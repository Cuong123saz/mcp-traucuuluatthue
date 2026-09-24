# Integration report — PostgreSQL, MVP search/get-provision

Ngày chạy: 2026-09-24. Vai trò: Integration Agent. Phạm vi: **chỉ** nghiệm thu
PostgreSQL integration cho hai use case MVP (`search_tax_law`,
`get_tax_provision`). Không thay đổi scope MVP, không thêm timeline / list /
document detail.

## 1. Kết quả

**Integration: PASS — 8/8 ca chạy thật, không còn ca nào skip.**

Đây là lần đầu suite `tests/integration-postgres.test.ts` thực sự chạy; lượt
review trước (`artifacts/coordinator/implementation-review.md` §4) cả tám ca
đều skip vì thiếu `TEST_DATABASE_URL`, nên mục "PostgreSQL và tích hợp chưa
nghiệm thu" nay đã có bằng chứng runtime.

| Lệnh | Kết quả |
|---|---|
| `TEST_DATABASE_URL=... npm run test:integration` | **1 file passed, 8 tests passed**, 0 skipped |
| `npm test` (không có `TEST_DATABASE_URL`) | 5 passed / 1 skipped; 98 passed / 8 skipped |
| `TEST_DATABASE_URL=... npm test` | **6 files passed; 106 tests passed, 0 skipped** |
| `npm run typecheck` | pass |

Tám ca đã chạy và pass:

1. search trả provision đã approved đang hiệu lực tại `asOf`
2. search trả trang rỗng khi không khớp
3. search ẩn version `draft` và `rejected`
4. search bind `q`, SQL marker chỉ là literal (bảng `provisions` còn nguyên sau đó)
5. get provision trả đúng version chứa `asOf`
6. `effectiveTo` inclusive (2025-12-31 → `-101`; 2026-01-01 → `-102`)
7. article không có trong version đang hiệu lực → `NOT_FOUND`
8. cột `date` đọc ra chuỗi `YYYY-MM-DD`, không lệch timezone

Bằng chứng schema/seed đã nạp thật (kiểm tra trực tiếp trên DB sau khi chạy):
`documents=2`, `document_versions=4`, `provisions=7`; `pg_extension` chứa
`btree_gist` và `plpgsql`. Nghĩa là `DROP SCHEMA public CASCADE` →
`artifacts/db/schema.sql` → `artifacts/db/seed.sql` đều thực thi thành công,
gồm cả `CREATE EXTENSION btree_gist` và ràng buộc EXCLUDE
`approved_versions_do_not_overlap`.

## 2. Môi trường đã dùng

- PostgreSQL **16.15** (Debian), image `postgres:16`, `btree_gist` 1.7 có sẵn.
- Container dùng một lần: `taxlaw-pg-test`, publish `5433:5432`, DB `taxlaw_test`.
- Cổng 5433 (không phải 5432) để không đụng PostgreSQL cài sẵn nếu có.

Container **vẫn đang chạy** sau lượt nghiệm thu này để có thể chạy lại; xóa
bằng `docker rm -f taxlaw-pg-test` khi không cần.

## 3. Cách chuẩn bị PostgreSQL local (nếu chưa có)

Yêu cầu: PostgreSQL **15+** và extension **btree_gist**. Database phải là loại
**dùng một lần** — suite chạy `DROP SCHEMA IF EXISTS public CASCADE` ở
`tests/integration-postgres.test.ts:38` trước khi nạp schema.

### Cách A — Docker (đã dùng cho lượt này)

```bash
docker run -d --name taxlaw-pg-test \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=taxlaw_test \
  -p 5433:5432 postgres:16
```

Đợi sẵn sàng: `docker exec taxlaw-pg-test pg_isready -U postgres -d taxlaw_test`.

Chuỗi kết nối: `postgres://postgres:postgres@127.0.0.1:5433/taxlaw_test`.

Dọn dẹp: `docker rm -f taxlaw-pg-test`.

### Cách B — PostgreSQL cài sẵn trên máy

```bash
createdb -h 127.0.0.1 -p 5432 -U postgres taxlaw_test
psql -h 127.0.0.1 -p 5432 -U postgres -d taxlaw_test -c "CREATE EXTENSION IF NOT EXISTS btree_gist;"
```

Tài khoản cần quyền tạo extension (superuser, hoặc btree_gist là trusted
extension trên PostgreSQL 13+ với owner của database). Suite tự chạy
`CREATE EXTENSION IF NOT EXISTS btree_gist` trong `schema.sql`, bước trên chỉ
để kiểm tra trước rằng extension nạp được.

Không cần nạp `schema.sql` / `seed.sql` bằng tay: `beforeAll` của suite tự nạp
cả hai mỗi lần chạy.

## 4. Lệnh chạy chính xác

bash / Git Bash:

```bash
TEST_DATABASE_URL="postgres://postgres:postgres@127.0.0.1:5433/taxlaw_test" npm run test:integration
```

PowerShell (không có cú pháp `VAR=... cmd`):

```powershell
$env:TEST_DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:5433/taxlaw_test"; npm run test:integration
```

Chạy toàn bộ suite kèm integration: thay `npm run test:integration` bằng `npm test`.

Nếu `TEST_DATABASE_URL` không được đặt, vitest báo `1 skipped / 8 skipped` —
đó là **chưa chạy**, không phải pass.

## 5. Lỗi và file đã sửa

- **Lỗi: không có.** Không ca nào fail, không cần sửa lỗi PostgreSQL integration.
- **File đã sửa: không có.** Lượt này chỉ tạo mới
  `artifacts/coordinator/integration-report.md`. Không chạm vào `src/**`,
  `tests/**`, `artifacts/db/**`, `package.json`, `.env.example`.

## 6. Blocker còn lại

Không còn blocker cho riêng PostgreSQL integration. Các mục dưới đây nằm ngoài
nhiệm vụ lượt này, giữ nguyên trạng thái từ implementation-review:

- **R-01…R-04 vẫn mở** (P2, owner là Backend). Không mục nào làm fail integration
  hiện tại: schema đúng cùng query đúng alias chặn dữ liệu khuyết trên DB thật, và
  tám ca hiện có không chạm tới cancellation hay biên offset.
- **Coverage integration vẫn chưa đầy đủ.** Còn thiếu **ca test** (khác với "có ca
  nhưng chưa chạy") cho: FK / EXCLUDE overlap, pagination limit=99 và order ổn định
  trên dữ liệu đủ lớn, bigint > 2^53, timeout / cancellation / connection release,
  ma trận biên ngày đầy đủ, get trên version draft/rejected. Việc bổ sung thuộc
  Backend, không thuộc lượt nghiệm thu này.
- **C-07 vẫn mở** (đường gọi Frontend cho search → get). Không liên quan PostgreSQL.
- Ghi chú: repo **không có `README.md` ở thư mục gốc**; tài liệu chạy nằm ở
  `src/taxlaw/README.md` §Running, nội dung khớp với lệnh ở mục 4.
