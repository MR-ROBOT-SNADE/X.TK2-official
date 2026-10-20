-- =============================================================================
-- migrations/0007_tk12.sql — CHO BẢNG so_lieu NHẬN THÊM TK1, TK2
-- =============================================================================
-- CHẠY MỘT LẦN, trên D1 đã có từ trước:   npm run db:mo-tk12
--   KHÔNG nằm trong npm run db:schema: mỗi lần chạy là chép lại cả bảng so_lieu
--   (~49.000 dòng ghi trong hạn mức 100.000/ngày của gói Free). D1 tạo mới từ đầu
--   thì không cần file này — 0001 đã bỏ CHECK.
--
-- VÌ SAO
--   0001 tạo so_lieu với CHECK (day_chuyen IN ('TK3', 'TK4')). SQLite không sửa
--   được CHECK của bảng đã có, nên phải dựng bảng mới không có CHECK, chép số
--   sang, xoá bảng cũ, đổi tên. Danh sách dây chuyền hợp lệ giờ kiểm trong code
--   (DAY_CHUYEN ở db/chuan-hoa.mjs), như van_tay_ngay / van_tay_thang (0006).
--   Các bảng khác còn CHECK (nhan_su, vat_tu_ton, vat_tu_phieu, ngay_nap) chưa
--   sửa: TK1/TK2 chưa có nhân sự, vật tư, nạp Excel.
--
-- AN TOÀN
--   - Chạy lại (lỡ tay) KHÔNG mất số: bảng tạm luôn được chép đủ từ so_lieu hiện
--     có trước khi so_lieu bị xoá — chỉ tốn thêm một lượt dòng ghi.
--   - DROP TABLE không xoá từng dòng (so_lieu không phải bảng cha của khoá ngoại
--     nào) nên không tốn thêm dòng ghi.
--   - Apps Script TK3/TK4 có thể đẩy ĐÚNG lúc đang chép: ô ghi vào bảng cũ sau khi
--     chép sẽ mất cùng bảng cũ, trong khi dấu vân tay khối-ngày vẫn còn -> Apps
--     Script tưởng máy chủ đã có. Vì vậy cuối file XOÁ hết dấu vân tay: lượt đẩy
--     khối-ngày kế tiếp của mỗi dây gửi lại toàn bộ (chia nhiều lượt, 1-2 phút;
--     ô không đổi thì D1 không ghi) — mọi ô lỡ mất được bù lại.
--   - Lỗi giữa chừng: D1 Time Travel khôi phục được về trước lúc chạy (7 ngày):
--     npx wrangler d1 time-travel restore xtk2-db --timestamp=<mốc trước khi chạy>
-- =============================================================================

CREATE TABLE IF NOT EXISTS so_lieu_moi (
    chi_tieu    TEXT    NOT NULL REFERENCES chi_tieu(ma),
    day_chuyen  TEXT    NOT NULL,       -- 'TK1'..'TK4' — danh sách kiểm trong code (DAY_CHUYEN)
    ngay        TEXT    NOT NULL,
    stt         INTEGER NOT NULL,
    ca          INTEGER NOT NULL,
    kip         TEXT    NOT NULL,
    gia_tri     REAL,
    chu         TEXT,
    cap_nhat    INTEGER NOT NULL,
    PRIMARY KEY (chi_tieu, day_chuyen, ngay, stt)
) WITHOUT ROWID;

INSERT OR IGNORE INTO so_lieu_moi (chi_tieu, day_chuyen, ngay, stt, ca, kip, gia_tri, chu, cap_nhat)
    SELECT chi_tieu, day_chuyen, ngay, stt, ca, kip, gia_tri, chu, cap_nhat FROM so_lieu;

DROP TABLE so_lieu;

ALTER TABLE so_lieu_moi RENAME TO so_lieu;

-- Quên dấu vân tay khối-ngày -> lượt đẩy kế tiếp gửi lại hết (xem AN TOÀN)
DELETE FROM van_tay_ngay;
DELETE FROM van_tay_thang;
