# Frontend MVP — Tra cứu luật thuế

Vue 3 + Vite. Gọi REST `GET /search` của backend; không gọi MCP từ browser.

## Chạy

```bash
# 1. Backend (thư mục gốc repo, cần DATABASE_URL trong .env)
npm run start:api

# 2. Frontend
cd frontend
npm install
npm run dev        # http://localhost:5173
```

## Cấu hình backend URL

Copy `.env.example` → `.env.local`:

- `TAXLAW_API_PROXY_TARGET` — địa chỉ backend mà Vite proxy chuyển `/api/*` tới (mặc định `http://127.0.0.1:3000`).
- `VITE_TAXLAW_API_BASE_URL` — base URL browser dùng (mặc định `/api`, đi qua proxy). Chỉ đặt URL tuyệt đối nếu server đó bật CORS; backend hiện tại chưa bật.
- `VITE_TAXLAW_API_TIMEOUT_MS` — timeout phía client (mặc định 10000).

## Lệnh khác

- `npm test` — Vitest + happy-dom
- `npm run typecheck` — vue-tsc
- `npm run build` / `npm run preview`

Quyết định và điểm còn mở: `artifacts/frontend/integration-notes.md` mục 8.
