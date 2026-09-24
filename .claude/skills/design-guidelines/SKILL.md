---
name: design-guidelines
description: Nguyên tắc UX/UI và UI copy cho trang tra cứu luật thuế. Dùng khi thiết kế, review giao diện, viết câu chữ hiển thị, hoặc code component có giao diện.
---

# Nguyên tắc thiết kế

Bản đầy đủ nằm ở `artifacts/design/`: `design-spec.md`, `component-guidelines.md`, `ui-copy.md`, `interaction-flow.md`. Đọc file liên quan trước khi thiết kế hay code.

## 5 nguyên tắc cốt lõi

1. **Nguồn phải kiểm chứng được.** Mỗi kết quả luôn hiện số hiệu văn bản, điều, khoảng hiệu lực và link nguồn.
2. **Ngày áp dụng (asOf) là ngữ cảnh chính.** Luôn hiện asOf cạnh kết quả, vì cùng một điều luật ở hai ngày khác nhau có thể có nội dung khác nhau.
3. **Không giả vờ có dữ liệu.** Không có kết quả thì nói rõ "không có tại ngày đó", không gợi ý bản gần nhất.
4. **Nói đúng khả năng tìm kiếm.** Tìm theo từ trong tiêu đề và nội dung điều khoản. Giải thích điều này ngay ở trạng thái rỗng.
5. **Đơn giản.** Một trang chính và một panel chi tiết. Không dashboard, không biểu đồ.

## Bố cục

- Nội dung 1 cột, rộng 720–880px, căn giữa.
- Panel chi tiết: nằm bên phải khi màn hình ≥1024px, thành sheet toàn màn hình trên mobile.
- Luôn thiết kế đủ các trạng thái: mặc định, loading, có kết quả, rỗng, lỗi (kèm requestId).

## Token (frontend/src/style.css)

`--accent #0b5cad` (hành động chính, focus) · `--ok-*` (còn hiệu lực) · `--warn-*` (cảnh báo) · `--error-*` (lỗi) · `--muted` (chữ phụ) · `--border-soft` (viền card).
Tương phản chữ tối thiểu 4.5:1. Focus ring 3px. Mọi thao tác đều làm được bằng bàn phím.

## Câu chữ

- Tiếng Việt, ngắn, trung tính, không dùng thuật ngữ kỹ thuật với người dùng.
- Ghi ngày theo dạng dd/mm/yyyy.
- Câu mẫu có sẵn trong `artifacts/design/ui-copy.md`. Dùng lại câu có sẵn trước khi viết câu mới.
