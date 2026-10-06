-- =============================================================================
-- migrations/0005_nap_excel.sql — NẠP SỐ LIỆU TỪ FILE EXCEL (trang /nap-lieu)
-- =============================================================================
-- CHẠY:  npm run db:schema   (chạy cả 0001..0005; chạy lại được)
--
-- VÌ SAO CẦN
--   Một số khối (chất lượng mẫu KCS...) không còn nhập trên Google Sheet mà có
--   sẵn trong file Excel. Trang nap-lieu.html đọc file NGAY TRÊN TRÌNH DUYỆT rồi
--   gửi các ô lên POST /api/nap (db/nap-excel.mjs). Ô được ghi thẳng vào so_lieu,
--   CÙNG mã chỉ tiêu với cột sheet -> gói tháng, biểu đồ, cảnh báo, dải chỉ số
--   hiện số Excel y như số sheet, không phải sửa gì thêm.
--
-- QUY TẮC "KHỐI-NGÀY"
--   Nạp khối X cho ngày D = THAY TOÀN BỘ số liệu của khối X trong ngày D (cột
--   nào file không có thì ngày đó để trống). Từ đó khối-ngày (X, D) thuộc về
--   Excel: Google Sheet không được ghi đè hay xoá nữa —
--     - db/dong-bo-d1.mjs bỏ qua các ô sheet của khối-ngày có trong ngay_nap;
--     - scripts/nap-lich-su.mjs (db:nap) cũng bỏ qua.
--   Huỷ một lần nạp (trên trang) = xoá số liệu của các khối-ngày lần đó đang giữ
--   và trả các khối-ngày đó lại cho sheet.
--
-- Nhật ký chung nhat_ky_nap (0001) ghi thêm nguon = 'excel' / 'huy-excel'.
-- =============================================================================

-- MỖI LẦN NẠP (một file) MỘT DÒNG
CREATE TABLE IF NOT EXISTS lan_nap (
    id          INTEGER PRIMARY KEY,    -- = mốc nạp (ms): vừa là mã, vừa xếp theo thời gian
    nguoi       TEXT,                   -- tên người nạp TỰ KHAI trên trang (không xác thực —
                                        -- ai có khoá nạp cũng ghi được tên bất kỳ)
    ten_file    TEXT,
    mau         TEXT    NOT NULL,       -- dạng file: 'chuan' (file mẫu của trang)...
    so_o        INTEGER NOT NULL,       -- số ô đã gửi lên (kể cả ô kíp)
    so_ghi      INTEGER,                -- số dòng D1 thực sự đổi (ghi mới + sửa + xoá)
    tom_tat     TEXT    NOT NULL,       -- JSON [[dây chuyền, khối, từ ngày, đến ngày, số ngày], ...]
    huy_luc     INTEGER                 -- ms lúc bị huỷ; NULL = còn hiệu lực
);

-- KHỐI-NGÀY ĐANG DO EXCEL GIỮ (xem quy tắc ở trên).
-- Ví dụ ('TK3', 'QTK', '2026-09-15', 1790000000000): ngày 15/09 khối QTK của TK3
-- lấy theo lần nạp 1790000000000; sheet có gì ở khối-ngày đó cũng bỏ qua.
-- Không thêm chỉ mục phụ theo lan_nap: mỗi chỉ mục tính thêm một dòng ghi (gói
-- Free 100.000 dòng/ngày), mà bảng chỉ vài nghìn dòng — quét cả bảng khi huỷ
-- một lần nạp vẫn rẻ.
CREATE TABLE IF NOT EXISTS ngay_nap (
    day_chuyen  TEXT    NOT NULL CHECK (day_chuyen IN ('TK3', 'TK4')),
    khoi        TEXT    NOT NULL,       -- như chi_tieu.khoi, vd 'QTK'
    ngay        TEXT    NOT NULL,       -- 'YYYY-MM-DD'
    lan_nap     INTEGER NOT NULL,       -- lan_nap.id của lần nạp GẦN NHẤT phủ khối-ngày này
    PRIMARY KEY (day_chuyen, khoi, ngay)
) WITHOUT ROWID;
