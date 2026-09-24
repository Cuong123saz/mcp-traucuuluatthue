---
name: frontend-conventions
description: Quy ước frontend của dự án Tra cứu luật thuế (Vue 3 + Vite + TypeScript, thư mục frontend/). Dùng khi viết hoặc sửa component, store, hoặc code gọi REST API.
---

# Quy ước frontend

## Stack và cấu trúc

Vue 3 (Composition API, `<script setup lang="ts">`), Vite, Vitest + happy-dom. Không dùng Nuxt, không dùng thư viện UI.

```
frontend/src/
  lib/taxLawApi.ts       # lớp DUY NHẤT gọi REST. Parse, kiểm tra response, trả SearchOutcome {ok, value|error}
  lib/*.ts               # hàm thuần: ngày (calendarDate), sourceUrl, copy, errorPresentation
  stores/searchStore.ts  # trạng thái tìm kiếm: input, snapshot kết quả hợp lệ gần nhất, lỗi
  components/*.vue       # chỉ hiển thị, nhận props và emit event
  style.css              # design token (biến CSS)
```

Luồng dữ liệu: component → store → `taxLawApi` → `/api/*` (Vite proxy) → backend `:3000`.

## Quy tắc

- Chỉ `lib/taxLawApi.ts` được gọi `fetch`. Component không gọi API trực tiếp.
- Field API phải khớp đúng `artifacts/backend/api-contract.md`. Không tự đổi tên field hay thêm field.
- Nếu response 200 nhưng thiếu hoặc sai `sourceUrl`/`effectiveFrom`/`effectiveTo` thì coi là lỗi: giữ nguyên kết quả hợp lệ trước đó và hiện lỗi kèm requestId. Không lọc ngầm những item sai.
- Ngày là chuỗi `YYYY-MM-DD`. Không chuyển sang `Date` theo múi giờ (dùng `lib/calendarDate.ts`).
- Màu, viền, focus lấy từ biến trong `style.css`. Không hard-code mã màu.
- Mỗi thay đổi hành vi đều cần test trong `frontend/tests/`.

## Lệnh (chạy trong frontend/)

```bash
npm run dev        # http://localhost:5173, proxy /api -> 127.0.0.1:3000
npm run typecheck
npm test
```
