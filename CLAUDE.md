# Tra cứu luật thuế

Mini platform tra cứu điều khoản luật thuế theo ngày áp dụng (`asOf`). Có REST API cho web và MCP server cho AI. Yêu cầu gốc nằm ở `project/brief.md`.

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `src/taxlaw/` | Backend: `http/` (Fastify REST), `mcp/` (MCP server), `service/`, `repository/`. Xem `src/taxlaw/README.md` |
| `frontend/` | Vue 3 + Vite, gọi REST qua proxy `/api` |
| `artifacts/db/` | `schema.sql`, `seed.sql`, các query. Đây là nguồn chuẩn của SQL |
| `artifacts/backend/` | Contract: `api-contract.md`, `mcp-tools.md` |
| `artifacts/design/` | Design spec, UI copy |
| `artifacts/coordinator/`, `artifacts/conflicts/` | Lịch sử review và conflict của đợt làm trước (chỉ để tham khảo) |
| `.claude/agents/` | Subagent: `backend`, `db`, `frontend`, `design` |
| `.claude/skills/` | `backend-conventions`, `frontend-conventions`, `design-guidelines`, `tax-law-lookup` |

## Chạy local

```bash
docker compose up -d                 # PostgreSQL taxlaw@localhost:5432 (tự nạp schema + seed)
npm install; npm test                # backend test, không cần DB
npm run start:api                    # REST :3000 (cần biến môi trường DATABASE_URL)
cd frontend; npm install; npm run dev   # web :5173
```

MCP server `tax-law` được khai báo trong `.mcp.json`, Claude Code tự khởi động khi mở dự án. Postgres phải đang chạy.

## Quy tắc

- Ranh giới giữa các lớp và quy tắc nghiệp vụ: xem skill `backend-conventions`. Test sẽ fail nếu vi phạm.
- Đổi field API thì phải cập nhật contract trong `artifacts/backend/` trước, rồi mới sửa FE.
- Dữ liệu luật nằm ở `data/laws/*.json`, nạp vào DB bằng `npm run db:import`. Nội dung hiện là bản tóm tắt, đã duyệt dưới nhãn `demo-local`, chưa đối chiếu nguyên văn.
- Không tạo thêm file báo cáo trong `artifacts/` nếu người dùng không yêu cầu.

## Việc đang mở

- FR-01 / C-08 (frontend): response 200 thiếu nguồn hoặc sai khoảng hiệu lực không được ghi đè kết quả hợp lệ trước đó. Chi tiết ở `artifacts/coordinator/final-review-summary.md` mục 7.
- Tool chưa làm: `get_document_timeline`, `list_tax_documents`.
- Đối chiếu nguyên văn và bổ sung thêm văn bản trong `data/laws/`.
