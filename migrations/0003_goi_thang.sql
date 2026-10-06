-- =============================================================================
-- migrations/0003_goi_thang.sql — GÓI DỮ LIỆU DỰNG SẴN THEO THÁNG CHO /api/v2
-- =============================================================================
-- CHẠY:  npm run db:schema   (chạy cả 0001..0004; chạy lại được)
--
-- VÌ SAO CẦN: /api/v2/tk3 trả số liệu từ D1 thay cho bản KV. Nếu mỗi lần có người
-- mở trang lại dựng câu trả lời từ so_lieu, mỗi lượt sẽ đọc ~15.000 dòng -> vài
-- trăm lượt là cạn hạn mức 5 triệu dòng đọc/ngày của gói Free.
--
-- CÁCH LÀM: dựng sẵn THEO THÁNG ngay lúc đồng bộ (db/dong-bo-d1.mjs), chỉ dựng
-- lại tháng có ô đổi. Mỗi lượt mở trang chỉ đọc vài dòng của bảng này.
-- Cột json do chính SQLite dựng (json_group_array) -> Function chỉ nối chuỗi,
-- không tốn CPU dựng JSON (gói Free: 10 ms/lượt).
-- Dạng chi tiết của json: xem db/goi-v2.mjs (SQL_GOI_THANG).
-- =============================================================================

CREATE TABLE IF NOT EXISTS goi_thang (
    tuyen   TEXT    NOT NULL,       -- 'tk3' | 'tk4'
    thang   TEXT    NOT NULL,       -- 'YYYY-MM', hoặc 'nhan-su' cho danh sách nhân sự
    phien   INTEGER NOT NULL,       -- ms lúc dựng — /api/v2 dùng để tính ETag
    ds_cot  TEXT    NOT NULL,       -- vân tay danh mục cột lúc dựng; danh mục đổi
                                    -- (sheet thêm cột...) là phải dựng lại hết
    so_o    INTEGER NOT NULL,       -- số ô trong gói
    json    TEXT    NOT NULL,       -- [[số thứ tự cột, ngày trong tháng, stt, kip, giá trị], ...]
    PRIMARY KEY (tuyen, thang)
);
