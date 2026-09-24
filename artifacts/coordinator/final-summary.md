# Coordinator Summary — Nghiệm thu MVP mới nhất

Cập nhật: 2026-09-24. Chi tiết: [final-review-summary.md](final-review-summary.md). Bằng chứng mới: [e2e-local-report.md](e2e-local-report.md).

| Hạng mục | Trạng thái |
|---|---|
| Backend/MCP search/get-provision | Đã nghiệm thu kỹ thuật cơ bản; R-01…R-04 vẫn mở. |
| PostgreSQL integration | PASS; 8/8 ca thật. No PostgreSQL integration blocker remains trong suite hiện có. |
| Backend suite | 106 tests passed, 0 skipped; typecheck PASS theo integration report. |
| Frontend review | Pass luồng chính có điều kiện; 55 tests passed, build PASS theo frontend review. FR-01…FR-03 vẫn mở. |
| E2E local | **PASS — 9 nhóm case browser đều đạt.** |
| Stack thật đã dùng | **Frontend Vite 5180 → REST Backend 3100 → PostgreSQL container 5433**; DB taxlaw_e2e, không mock/in-memory. |
| C-07 | **Closed for MVP** — Frontend dùng REST. |
| C-08 | **Open** — không chặn E2E local nhưng cần sửa FR-01. |
| Mốc tiếp theo | **Sửa FR-01 để đóng C-08, sau đó review lại Frontend nhỏ.** Chỉ đóng sau kiểm chứng đạt. |

**E2E local: PASS. Không sửa code để E2E pass.** Chín nhóm gồm first-run, search có kết quả, search rỗng, validation, stale, pagination, detail snapshot, đổi form không đổi ngày detail, lỗi backend/DB và khôi phục. Detail dùng provision/asOf từ result snapshot, không request mới.

E2E PASS không đóng C-08: nhánh response 200 lỗi provenance chưa được kiểm chứng trên stack thật. FR-01 vẫn có thể ghi đè snapshot hợp lệ/chuyển success. Cần regression valid A → malformed B giữ A, hiện lỗi/requestId B, không success announcement; sau đó review nhỏ trước khi đóng.

**E2E-01/E2E-02/E2E-03 là follow-up**: hướng dẫn env (Backend/Docs), tránh nhầm cổng smoke in-memory (Ops), giảm thông báo dư (Design). Không chặn PASS, chưa được coi đã xử lý.

CORS/reverse proxy deploy chưa chốt; accessibility đầy đủ, responsive/mobile/timezone, browser khác Chromium, loading chậm/timeout và race nhiều request chưa nghiệm thu. REST detail/timeline/list documents ngoài MVP. MCP stdio chỉ cho AI Client/Inspector/local testing; không MCP-over-HTTP trong MVP.

**P2 issues remain non-blocking** ở mức nghiệm thu cơ bản/E2E local đã đạt; không tự đóng R-01…R-04 hoặc FR-01…FR-03. Không tuyên bố toàn hệ thống hoàn thiện hay sẵn sàng production.

Lượt này chỉ cập nhật final-summary.md, final-review-summary.md và conflict-log.md; không sửa source/tests hoặc DB/Backend/Design/Frontend artifacts, không chạy lại E2E/test và không thay đổi môi trường.
