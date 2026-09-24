# Legal Lookup Mini Platform

## Mục tiêu

Xây dựng mini platform tra cứu luật có:

- Database
- Backend API
- MCP tools
- Frontend UI
- Design spec
- Multi-agent workflow

## Core features

1. Search điều khoản theo từ khóa.
2. Lọc theo ngày áp dụng `asOf`.
3. Chỉ trả dữ liệu đã `approved`.
4. Không trộn version.
5. Mỗi kết quả phải có:
   - documentNumber
   - title
   - articleKey
   - heading
   - body
   - sourceUrl
   - effectiveFrom
   - effectiveTo

## MCP tools cần có

- search_tax_law
- get_tax_provision
- get_document_timeline
- list_tax_documents

## Agents

- Coordinator Agent
- DB Agent
- Backend Agent
- Frontend Agent
- Design Agent

## Quy tắc

- SQL nằm trong Repository.
- Business logic nằm trong Service.
- MCP tool handler không viết SQL trực tiếp.
- FE không tự đổi API contract.
- Mỗi agent chỉ ghi artifact thuộc phạm vi của mình.