-- =============================================================================
-- migrations/0006_khoi_ngay.sql — DẤU VÂN TAY KHỐI-NGÀY CHO ĐƯỜNG ĐẨY MỚI
-- =============================================================================
-- Đường đẩy mới (POST /api/day/<tuyến>, db/day-khoi-ngay.mjs) chỉ gửi những
-- KHỐI-NGÀY đã đổi trong sheet thay vì cả sheet 3 MB. Apps Script (file
-- apps-script/khoi-ngay.gs) tính một dấu vân tay (MD5) cho từng khối-ngày; máy
-- chủ giữ dấu của lần ghi gần nhất ở đây để hai bên so:
--   van_tay_thang  một dấu cho cả (khối, tháng) — so cái này trước, rẻ (~130 dòng)
--   van_tay_ngay   dấu từng ngày — chỉ đọc cho những tháng lệch
-- Dấu được ghi CÙNG giao dịch với số liệu (db.batch), nên dấu luôn khớp với số
-- đang có trong so_lieu. Mọi đường KHÁC ghi số sheet vào so_lieu (đồng bộ dự
-- phòng của đường đẩy cũ, db:nap) phải XOÁ dấu của dây chuyền đó -> lần đẩy sau
-- Apps Script gửi lại hết và hai bên khớp lại.
--
-- Không có CHECK trên day_chuyen: danh sách dây chuyền kiểm trong code
-- (DAY_CHUYEN ở db/chuan-hoa.mjs) — thêm TK1/TK2 không phải sửa bảng này.
-- Chạy lại được (IF NOT EXISTS).
-- =============================================================================

CREATE TABLE IF NOT EXISTS van_tay_ngay (
    day_chuyen  TEXT NOT NULL,          -- 'TK3', 'TK4'...
    khoi        TEXT NOT NULL,          -- tên khối như chi_tieu.khoi, vd 'QTK'
    ngay        TEXT NOT NULL,          -- 'YYYY-MM-DD'
    van_tay     TEXT NOT NULL,          -- MD5 (base64) của các hàng khối-ngày đó trong sheet
    PRIMARY KEY (day_chuyen, khoi, ngay)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS van_tay_thang (
    day_chuyen  TEXT NOT NULL,
    khoi        TEXT NOT NULL,          -- tên khối; '(nhân sự)' = danh sách nhân sự
    thang       TEXT NOT NULL,          -- 'YYYY-MM'; nhân sự dùng '-'
    van_tay     TEXT NOT NULL,          -- MD5 của các cặp ngày=dấu trong tháng
    luc         INTEGER NOT NULL,       -- ms, lần ghi gần nhất
    PRIMARY KEY (day_chuyen, khoi, thang)
) WITHOUT ROWID;
