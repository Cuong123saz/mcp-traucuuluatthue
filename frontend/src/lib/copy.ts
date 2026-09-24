/**
 * Strings copied verbatim from artifacts/design/ui-copy.md, keyed the same way.
 * Keys under `fe.` are NOT in ui-copy.md: they cover situations Design has not
 * written copy for yet (integration-notes.md FE-08, FE-16) and must be
 * replaced once Design supplies wording.
 */
export const COPY = {
    "app.title": "Tra cứu luật thuế",
    "app.subtitle": "Tìm điều khoản theo từ khóa và xem nội dung đang áp dụng tại một ngày cụ thể.",

    "search.q.label": "Từ khóa",
    "search.q.placeholder": "Ví dụ: thu nhập chịu thuế, khấu trừ, hoàn thuế",
    "search.q.counter": "{length}/300",
    "search.asOf.label": "Ngày áp dụng",
    "search.asOf.help": "Ngày bạn muốn biết luật đang áp dụng, không phải ngày ban hành văn bản.",
    "search.asOf.today": "Hôm nay",
    "search.limit.label": "Số kết quả mỗi trang",
    "search.limit.note100": "Ở mức 100, hệ thống chưa xác định được còn kết quả ở trang sau hay không.",
    "search.submit": "Tra cứu",
    "search.submit.loading": "Đang tra cứu…",
    "search.hint.scope":
        "Tìm kiếm đọc nội dung và tiêu đề của điều khoản. Các từ trong ô đều phải xuất hiện, có phân biệt dấu.",
    "search.hint.docNumber": "Tìm kiếm không nhận số hiệu văn bản. Hãy nhập từ khóa trong nội dung điều khoản.",

    "validation.q.required": "Nhập từ khóa để tra cứu.",
    "validation.q.tooLong": "Từ khóa tối đa 300 ký tự.",
    "validation.asOf.required": "Chọn ngày áp dụng.",
    "validation.asOf.invalid": "Ngày không hợp lệ. Dùng định dạng ngày/tháng/năm.",

    "result.context": "Kết quả áp dụng tại ngày {asOf}",
    "result.count": "{count} điều khoản trên trang này",
    "result.stale":
        "Bạn đã đổi điều kiện tra cứu. Kết quả bên dưới vẫn là của lần tra trước (ngày {asOf}). Bấm Tra cứu để cập nhật.",
    "result.liveRegion": "Đã tải {count} điều khoản áp dụng tại ngày {asOf}.",

    "card.effective.open": "Từ {from} · không thời hạn kết thúc",
    "card.effective.closed": "Từ {from} đến hết {to}",
    "card.effective.mismatch": "Không khớp ngày tra cứu",
    "card.effective.mismatch.help":
        "Khoảng hiệu lực của điều khoản này không chứa ngày {asOf}. Đây là dấu hiệu sai dữ liệu, vui lòng báo lại kèm mã yêu cầu.",
    "card.source": "Xem nguồn",
    "card.source.invalid": "Nguồn không hợp lệ",
    "card.source.missing": "Thiếu nguồn",
    "card.detail": "Xem chi tiết",
    "card.body.empty": "Điều khoản không có nội dung.",
    "card.effective.missing": "Thiếu khoảng hiệu lực",

    "pager.prev": "Trang trước",
    "pager.next": "Trang sau",
    "pager.range": "Đang xem {from}–{to}",
    "pager.unknownMore": "Chưa xác định được còn kết quả hay không. Bấm Trang sau để kiểm tra.",
    "pager.end": "Đã hết kết quả.",

    "empty.firstRun.title": "Bắt đầu tra cứu",
    "empty.firstRun.body":
        "Nhập từ khóa xuất hiện trong nội dung điều khoản, chọn ngày áp dụng rồi bấm Tra cứu. Hệ thống chỉ trả về nội dung đã được duyệt và đang có hiệu lực tại ngày bạn chọn.",
    "empty.firstRun.examplesLabel": "Thử với",
    "empty.firstRun.examples": "thu nhập chịu thuế · khấu trừ thuế · hoàn thuế · người nộp thuế",

    "empty.noResults.title": "Không có điều khoản nào khớp tại ngày {asOf}",
    "empty.noResults.body":
        "Không tìm thấy điều khoản đã duyệt nào chứa các từ khóa bạn nhập và có hiệu lực tại ngày này.",
    "empty.noResults.tipsLabel": "Gợi ý",
    "empty.noResults.tip1": "Giảm bớt từ khóa — mọi từ bạn nhập đều phải xuất hiện trong điều khoản.",
    "empty.noResults.tip2": "Kiểm tra dấu tiếng Việt, vì tìm kiếm phân biệt dấu.",
    "empty.noResults.tip3":
        "Thử một ngày áp dụng khác; cùng một nội dung có thể chỉ có hiệu lực trong một khoảng thời gian.",
    "empty.noResults.tip4": "Tìm kiếm không đọc số hiệu và tên văn bản, chỉ đọc nội dung điều khoản.",

    "empty.endOfResults.title": "Đã hết kết quả",
    "empty.endOfResults.body": "Không còn điều khoản nào ở trang này.",
    "empty.endOfResults.action": "Quay lại trang trước",

    "loading.results": "Đang tải kết quả…",
    "loading.detail": "Đang tải nội dung điều khoản…",
    "loading.srAnnounce": "Đang tra cứu, vui lòng đợi.",

    "error.requestId": "Mã yêu cầu: {requestId}",
    "error.requestId.copy": "Sao chép mã",
    "error.retry": "Thử lại",
    "error.invalidArgument.title": "Điều kiện tra cứu chưa hợp lệ",
    "error.invalidArgument.body": "Kiểm tra lại từ khóa và ngày áp dụng rồi tra cứu lại.",
    "error.dataIntegrity.title": "Dữ liệu không nhất quán",
    "error.dataIntegrity.body":
        "Hệ thống phát hiện dữ liệu không hợp lệ cho yêu cầu này và đã dừng lại thay vì trả kết quả có thể sai. Vui lòng báo lại kèm mã yêu cầu.",
    "error.dependencyUnavailable.title": "Hệ thống đang tạm thời không phản hồi",
    "error.dependencyUnavailable.body": "Chưa kết nối được tới nguồn dữ liệu. Thử lại sau ít phút.",
    "error.internal.title": "Đã xảy ra lỗi",
    "error.internal.body": "Yêu cầu không hoàn tất. Thử lại, nếu vẫn lỗi vui lòng báo kèm mã yêu cầu.",
    "error.network.title": "Không kết nối được",
    "error.network.body": "Kiểm tra kết nối mạng rồi thử lại.",

    "detail.title": "Chi tiết điều khoản",
    "detail.close": "Đóng",
    "detail.meta.heading": "Thông tin phiên bản",
    "detail.meta.versionId": "Mã phiên bản",
    "detail.meta.asOf": "Tra cứu tại ngày",
    "detail.copyLink": "Sao chép link nguồn",
    "detail.copied": "Đã sao chép",

    // --- FE-local, pending Design (integration-notes.md FE-08 / FE-16) ---
    "fe.result.previous": "Danh sách bên dưới là kết quả của lần tra cứu thành công trước (ngày {asOf}).",
    "fe.dataError.title": "Lỗi dữ liệu trong kết quả",
    "fe.dataError.body":
        "{count} điều khoản trên trang này thiếu nguồn hoặc khoảng hiệu lực hợp lệ. Hệ thống không tự điền nguồn hay ngày thay thế; vui lòng báo lại kèm mã yêu cầu.",
    "fe.copy.failed": "Không sao chép được. Hãy chọn và sao chép thủ công."
} as const;

export type CopyKey = keyof typeof COPY;

export function t(key: CopyKey, vars: Record<string, string | number> = {}): string {
    return COPY[key].replace(/\{(\w+)\}/g, (whole, name: string) =>
        name in vars ? String(vars[name]) : whole
    );
}
