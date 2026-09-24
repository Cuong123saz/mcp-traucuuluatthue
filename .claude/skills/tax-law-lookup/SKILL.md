---
name: tax-law-lookup
description: Trả lời câu hỏi về luật thuế Việt Nam bằng cách tra cứu qua MCP server tax-law (search_tax_law, get_tax_provision). Dùng khi người dùng hỏi quy định, mức thuế, hiệu lực của một văn bản thuế.
---

# Tra cứu luật thuế qua MCP

## Quy trình

1. **Xác định ngày áp dụng (asOf).** Nếu người dùng không nói ngày nào thì dùng ngày hôm nay và ghi rõ trong câu trả lời là đang dùng ngày hôm nay.
2. **Tìm kiếm:** gọi `search_tax_law` với `q` là 1–3 từ khóa chính (ví dụ "giảm trừ gia cảnh") và `asOf`.
   - Nếu không có kết quả thì thử lại một lần với từ đồng nghĩa hoặc từ ngắn hơn.
3. **Lấy nguyên văn:** gọi `get_tax_provision` với `documentNumber`, `articleKey`, `asOf` cho điều khoản cần trích dẫn.
4. **Trả lời:**
   - Câu trả lời ngắn gọn trước.
   - Căn cứ: `Điều <articleKey>, <documentNumber>`, hiệu lực `<effectiveFrom>` đến `<effectiveTo hoặc "nay">`, kèm link `sourceUrl`.
   - Ghi rõ ngày asOf đã dùng để tra.

## Không được

- Trả lời từ trí nhớ khi tool không trả về căn cứ. Khi đó phải nói "không tìm thấy trong cơ sở dữ liệu tại ngày …".
- Ghép nội dung từ hai version hoặc hai ngày khác nhau thành một câu trả lời.
- Bỏ qua lỗi tool. Nếu tool báo lỗi thì báo lại mã lỗi và requestId.

## Lưu ý dữ liệu

Nội dung điều khoản trong DB là **bản tóm tắt** (bắt đầu bằng `[Tóm tắt]`), không phải nguyên văn. Luôn nói rõ điều này và gửi kèm `sourceUrl` để người dùng đối chiếu văn bản gốc.
