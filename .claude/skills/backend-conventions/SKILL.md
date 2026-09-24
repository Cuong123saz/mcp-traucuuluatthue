---
name: backend-conventions
description: Quy ước backend của dự án Tra cứu luật thuế (Fastify + PostgreSQL + MCP). Dùng khi viết hoặc sửa code trong src/taxlaw, thêm REST route, thêm MCP tool, hoặc đổi query SQL.
---

# Quy ước backend

## Kiến trúc: 3 lớp, 2 cửa vào

```
REST  src/taxlaw/http/app.ts   ─┐
                                ├─> service/tax-law-service.ts ─> repository/pg-tax-law-repository.ts ─> PostgreSQL
MCP   src/taxlaw/mcp/tools.ts  ─┘         (quy tắc nghiệp vụ)         (SQL, trong repository/sql.ts)
```

| Lớp | Được làm | Không được làm |
|---|---|---|
| `http/`, `mcp/` | validate hình dạng input, gọi Service, đóng gói response | viết SQL, import `pg`, lặp lại quy tắc nghiệp vụ |
| `service/` | kiểm tra asOf, phân trang, mã lỗi, kiểm tra dữ liệu trả về | viết SQL |
| `repository/` | SQL, bind tham số, dịch lỗi driver | quy tắc nghiệp vụ |

`tests/sql-artifact-parity.test.ts` sẽ fail nếu vi phạm các ranh giới trên.

## Quy tắc nghiệp vụ

- `asOf` bắt buộc, không bao giờ tự lấy ngày hôm nay.
- Chỉ trả version `approved`. Mỗi câu trả lời chỉ lấy từ một version, không ghép nội dung giữa các version.
- Mọi kết quả phải có `sourceUrl`, `effectiveFrom` và `effectiveTo` (`null` nghĩa là chưa hết hiệu lực).
- Response lỗi chỉ gồm `{code, message, details?}`. Không để lộ SQL hay stack trace.
- Log chỉ ghi requestId, tên thao tác, thời gian, mã lỗi, số kết quả. Không log nội dung câu hỏi hay nội dung luật.

## Thêm một MCP tool mới (checklist)

1. **DB**: viết query trong `artifacts/db/query-<tên>.sql`, rồi copy nguyên văn vào `repository/sql.ts`.
2. **Repository**: thêm method vào interface `tax-law-repository.ts` và cài đặt trong `pg-tax-law-repository.ts`. Cài thêm trong `tests/support/in-memory-repository.ts`.
3. **Service**: thêm method trong `tax-law-service.ts`, validate trong `validation.ts`.
4. **MCP**: `server.registerTool(...)` trong `mcp/tools.ts` và bọc trong `run(...)`. Viết `description` rõ ràng, vì AI đọc description để quyết định khi nào gọi tool.
5. **REST** (nếu cần): thêm route trong `http/app.ts`.
6. **Contract**: cập nhật `artifacts/backend/mcp-tools.md` và `api-contract.md`.
7. **Test**: `tests/mcp-tools.test.ts` (có kiểm tra danh sách tên tool), `tests/service-*.test.ts`.

## Lệnh

```bash
docker compose up -d          # Postgres dev (tự nạp schema + seed lần đầu)
npm run typecheck
npm test                      # không cần DB
npm run test:integration      # cần TEST_DATABASE_URL trỏ vào taxlaw_test
npm run start:api             # REST tại http://127.0.0.1:3000 (cần DATABASE_URL trong môi trường)
npm run inspect:mcp           # mở MCP Inspector để gọi tool bằng tay
```

Lưu ý: runtime chỉ đọc `process.env`, không tự nạp file `.env`. Trên PowerShell: `$env:DATABASE_URL="postgres://taxlaw:taxlaw@localhost:5432/taxlaw"`.
