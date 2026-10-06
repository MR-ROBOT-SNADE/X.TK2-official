-- =============================================================================
-- migrations/0004_moc_khoi.sql — NGÀY CUỐI CÓ SỐ LIỆU CỦA TỪNG KHỐI
-- =============================================================================
-- CHẠY:  npm run db:schema   (chạy cả 0001..0004; chạy lại được)
--
-- VÌ SAO CẦN: trình duyệt KHÔNG tải hết lịch sử nữa — mặc định chỉ tháng này (và
-- tháng trước nếu đang ở 10 ngày đầu tháng); tháng cũ hơn tải khi cần. "Khi cần"
-- gồm cả lúc mở một khối biểu đồ mà số liệu của khối đó đã ngừng từ lâu: biểu đồ
-- mặc định vẽ 7 ngày CUỐI CÙNG CÓ SỐ, nên trình duyệt phải biết ngày đó để tải
-- đúng tháng. Ví dụ khối QTK của TK3 ngừng 25/08 -> mở khối là tải thêm tháng 8.
-- Tính từ so_lieu mỗi lần mở trang thì phải quét cả bảng; nên giữ sẵn ở đây.
--
-- AI GHI:
--   - db/dong-bo-d1.mjs mỗi lần đồng bộ — mốc chỉ TĂNG, không bao giờ lùi;
--   - scripts/nap-lich-su.mjs tính lại trọn vẹn mỗi lần nạp lịch sử.
-- Khoảng 15 dòng mỗi dây chuyền.
-- =============================================================================

CREATE TABLE IF NOT EXISTS moc_khoi (
    tuyen       TEXT NOT NULL,          -- 'tk3' | 'tk4'
    khoi        TEXT NOT NULL,          -- tên khối như chi_tieu.khoi, vd 'QTK'
    ngay_cuoi   TEXT NOT NULL,          -- 'YYYY-MM-DD': ngày cuối có số > 0 ở cột theo ca
    PRIMARY KEY (tuyen, khoi)
) WITHOUT ROWID;
